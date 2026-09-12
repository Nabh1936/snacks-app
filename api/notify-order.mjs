import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderNumber, name, grandTotal } = req.body || {};
    const firestore = getFirestore();
    const snap = await firestore.collection('adminTokens').get();

    if (snap.empty) {
      return res.status(200).json({ ok: true, sent: 0, note: 'No admin device registered yet' });
    }

    const title = 'New Order Received';
    const body = `${name || 'A retailer'} placed order ${orderNumber || ''} — ₹${grandTotal || ''}`;

    let sent = 0;
    for (const docSnap of snap.docs) {
      const token = docSnap.data().token;
      if (!token) continue;
      try {
        await getMessaging().send({
          token,
          notification: { title, body },
          webpush: { fcmOptions: { link: '/admin' } },
        });
        sent++;
      } catch (err) {
        console.error('Send failed for a token:', err.message);
      }
    }

    res.status(200).json({ ok: true, sent });
  } catch (error) {
    console.error('notify-order error:', error);
    res.status(500).json({ error: error.message });
  }
}