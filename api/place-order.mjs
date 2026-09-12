import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

function makeOrderNumber() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MDF-${yy}${mm}${dd}-${rand}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { idToken, items, delivery, notes, paymentMethod, orderNumber: requestedOrderNumber } = req.body || {};

    if (!idToken) {
      return res.status(401).json({ error: 'Not signed in. Please refresh and try again.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    if (!delivery || !delivery.shopName || !delivery.address || !delivery.city || !delivery.pincode) {
      return res.status(400).json({ error: 'Delivery details are incomplete.' });
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: 'Your session has expired. Please refresh and log in again.' });
    }

    const firestore = getFirestore();

    const userDoc = await firestore.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return res.status(400).json({ error: 'Account not set up. Please log in again from the login page.' });
    }
    const phone = userDoc.data().phone;
    const name = userDoc.data().name || delivery.shopName;

    if (!phone) {
      return res.status(400).json({ error: 'No phone number on this account. Please log in again.' });
    }

    const productsSnap = await firestore.collection('products').get();
    const byId = {};
    productsSnap.forEach(doc => {
      const data = doc.data();
      byId[data.id] = data;
    });

    let subtotal = 0;
    let gst = 0;
    const finalItems = [];
    const removedItems = [];

    for (const requested of items) {
      const live = byId[requested.id];
      const qty = Number(requested.qty) || 0;
      if (!live || live.stock === false || qty <= 0) {
        removedItems.push(requested.name || `item ${requested.id}`);
        continue;
      }
      const lineSubtotal = live.price * qty;
      const lineGst = Math.round(lineSubtotal * (live.gst || 0) / 100);
      subtotal += lineSubtotal;
      gst += lineGst;
      finalItems.push({
        id: live.id,
        name: live.name,
        price: live.price,
        unit: live.unit,
        gst: live.gst,
        qty,
      });
    }

    if (finalItems.length === 0) {
      return res.status(400).json({ error: 'None of the items in your cart are currently available.' });
    }

    const grandTotal = subtotal + gst;

    let finalPaymentMethod = 'Cash on Delivery';
    if (paymentMethod === 'Credit') {
      const retailerDoc = await firestore.collection('retailers').doc(phone).get();
      const creditLimit = retailerDoc.exists ? Number(retailerDoc.data().creditLimit) || 0 : 0;
      const balanceOwed = retailerDoc.exists ? Number(retailerDoc.data().balanceOwed) || 0 : 0;
      const available = Math.max(0, creditLimit - balanceOwed);

      if (creditLimit <= 0) {
        return res.status(400).json({ error: 'Credit is not enabled for your account. Please choose Cash on Delivery.' });
      }
      if (grandTotal > available) {
        return res.status(400).json({ error: `This order exceeds your available credit (₹${available}). Please choose Cash on Delivery or reduce the order.` });
      }
      finalPaymentMethod = 'Credit (Udhar)';
    }

    const orderNumber = requestedOrderNumber || makeOrderNumber();

    const order = {
      orderNumber,
      name,
      phone,
      delivery: {
        shopName: String(delivery.shopName).trim(),
        contactPhone: String(delivery.contactPhone || phone).trim(),
        address: String(delivery.address).trim(),
        city: String(delivery.city).trim(),
        pincode: String(delivery.pincode).trim(),
      },
      notes: notes ? String(notes).trim() : '',
      items: finalItems,
      subtotal,
      gst,
      grandTotal,
      paymentMethod: finalPaymentMethod,
      paymentStatus: 'Unpaid',
      status: 'Pending',
      date: new Date().toLocaleString(),
      createdAt: Date.now(),
    };

    await firestore.collection('orders').doc(orderNumber).set(order);

    if (finalPaymentMethod.startsWith('Credit')) {
      await firestore.collection('retailers').doc(phone).set({
        phone,
        name,
        balanceOwed: FieldValue.increment(grandTotal),
        updatedAt: Date.now(),
      }, { merge: true });
    }

    try {
      const tokensSnap = await firestore.collection('adminTokens').get();
      const title = 'New Order Received';
      const body = `${name} placed order ${orderNumber} — ₹${grandTotal}`;
      for (const tokenDoc of tokensSnap.docs) {
        const token = tokenDoc.data().token;
        if (!token) continue;
        getMessaging().send({
          token,
          notification: { title, body },
          webpush: { fcmOptions: { link: '/admin' } },
        }).catch(() => {});
      }
    } catch (e) {
      // notification failure never affects the order
    }

    const removedNote = removedItems.length > 0
      ? `${removedItems.length} item(s) were removed — no longer available: ${removedItems.join(', ')}`
      : '';

    res.status(200).json({ ok: true, order, removedNote });
  } catch (error) {
    console.error('place-order error:', error);
    res.status(500).json({ error: 'Something went wrong placing your order. Please try again.' });
  }
}