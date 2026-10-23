import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import bundledProducts from '../data/products.json';

const PRODUCT_FETCH_TIMEOUT_MS = 5000;

// ---------- helpers for the Reorder sheet ----------

let liveProductsCache = null;

// Reads the live catalogue once per page visit (same read Checkout does), so
// reorder prices/stock are current. Falls back to the saved overlay, then the
// bundled catalogue, so it never hangs. The server re-verifies everything
// again when the order is actually placed.
async function loadLiveProducts() {
  if (liveProductsCache) return liveProductsCache;
  try {
    const snapshot = await Promise.race([
      getDocs(collection(db, 'products')),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), PRODUCT_FETCH_TIMEOUT_MS)
      ),
    ]);
    const live = snapshot.docs.map(d => d.data());
    if (live.length > 0) {
      liveProductsCache = live;
      return live;
    }
  } catch (e) {}
  try {
    const overlay = JSON.parse(localStorage.getItem('mdProductOverlay'));
    if (overlay && Array.isArray(overlay.data) && overlay.data.length) return overlay.data;
  } catch (e) {}
  return bundledProducts;
}

function indexProducts(list) {
  const imageById = {};
  bundledProducts.forEach(p => { imageById[p.id] = p.image; });
  const byId = {};
  list.forEach(p => { byId[p.id] = { ...p, image: p.image || imageById[p.id] }; });
  return byId;
}

function makeOrderNumber() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MDF-${yy}${mm}${dd}-${rand}`;
}

function calcTotals(lines) {
  const active = lines.filter(l => l.available);
  const subtotal = active.reduce((s, l) => s + l.price * l.qty, 0);
  const gst = active.reduce((s, l) => s + Math.round(l.price * l.qty * (l.gst || 0) / 100), 0);
  return { subtotal, gst, grandTotal: subtotal + gst, count: active.length };
}

function ItemImage({ line }) {
  const [failed, setFailed] = useState(false);
  if (!line.image || failed) {
    return <div style={styles.itemEmoji}>🥜</div>;
  }
  return (
    <img
      src={`/product-images/${line.image}`}
      alt={line.name}
      style={styles.itemPhoto}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

// ---------- the Reorder sheet ----------

function ReorderSheet({ order, credit, onClose }) {
  const navigate = useNavigate();
  const [lines, setLines] = useState(null);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  // One order number per opened sheet: if the network drops and the retailer
  // presses Place Order again, the same number is reused (no duplicate order).
  const [orderNumber] = useState(() => makeOrderNumber());

  const savedDelivery = (() => {
    try { return JSON.parse(localStorage.getItem('mdDelivery')); } catch (e) { return null; }
  })();
  const delivery = order.delivery || savedDelivery;
  const deliveryOk = !!(delivery && delivery.shopName && delivery.address && delivery.city && delivery.pincode);

  const availableCredit = credit ? Math.max(0, credit.limit - credit.balance) : 0;
  const creditEligible = !!credit && credit.limit > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadLiveProducts();
      const byId = indexProducts(list);
      const built = (order.items || []).map(item => {
        const live = byId[item.id];
        const available = !!live && live.stock !== false;
        return {
          id: item.id,
          name: (live && live.name) || item.name,
          unit: (live && live.unit) || item.unit,
          category: live && live.category,
          image: live && live.image,
          price: available ? live.price : item.price,
          gst: available ? (live.gst || 0) : (item.gst || 0),
          origPrice: item.price,
          qty: Number(item.qty) || 1,
          available,
        };
      });
      if (cancelled) return;
      setLines(built);
      // Default to the payment method used last time, if it still works.
      const wasCredit = (order.paymentMethod || '').startsWith('Credit');
      if (wasCredit && creditEligible && calcTotals(built).grandTotal <= availableCredit) {
        setPaymentMethod('Credit');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const changeQty = (id, delta) => {
    setLines(prev => prev
      .map(l => l.id === id ? { ...l, qty: Math.min(999, l.qty + delta) } : l)
      .filter(l => l.qty > 0));
  };

  const totals = lines ? calcTotals(lines) : { subtotal: 0, gst: 0, grandTotal: 0, count: 0 };
  const creditCoversOrder = totals.grandTotal <= availableCredit;
  const priceChanged = !!lines && lines.some(l => l.available && l.price !== l.origPrice);
  const unavailableCount = lines ? lines.filter(l => !l.available).length : 0;

  const canPlace =
    !!lines && !placing && totals.count > 0 && deliveryOk &&
    !(paymentMethod === 'Credit' && !creditCoversOrder);

  const placeNow = async () => {
    if (!canPlace) return;
    setError('');
    if (!auth.currentUser) {
      setError('Your session has expired. Please go back and log in again.');
      return;
    }
    setPlacing(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const cleanDelivery = {
        shopName: String(delivery.shopName).trim(),
        contactPhone: String(delivery.contactPhone || '').trim(),
        address: String(delivery.address).trim(),
        city: String(delivery.city).trim(),
        pincode: String(delivery.pincode).trim(),
      };
      const response = await fetch('/api/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          items: lines.filter(l => l.available).map(l => ({ id: l.id, qty: l.qty, name: l.name })),
          delivery: cleanDelivery,
          notes: notes.trim(),
          paymentMethod,
          orderNumber,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Could not place the order. Please try again.');
        setPlacing(false);
        return;
      }
      localStorage.setItem('mdDelivery', JSON.stringify(cleanDelivery));
      localStorage.setItem('mdLastOrder', JSON.stringify({ ...result.order, id: result.order.orderNumber }));
      navigate('/order-confirmed');
    } catch (err) {
      console.error('Reorder error:', err);
      setError('Could not place the order. Please check your connection and try again — it is safe to press Place Order again, it will not create a duplicate.');
      setPlacing(false);
    }
  };

  // For when the retailer wants a different address or to add more items:
  // load these items into the cart and continue in the normal checkout.
  const editInCheckout = () => {
    if (!lines) return;
    const active = lines.filter(l => l.available);
    if (active.length === 0) return;
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem('mdCart')) || []; } catch (e) {}
    if (existing.length > 0 &&
        !window.confirm('This will replace the items currently in your cart with this order. Continue?')) {
      return;
    }
    const cartItems = active.map(l => ({
      id: l.id, name: l.name, price: l.price, unit: l.unit,
      gst: l.gst, image: l.image, category: l.category, qty: l.qty,
    }));
    localStorage.setItem('mdCart', JSON.stringify(cartItems));
    if (deliveryOk) localStorage.setItem('mdDelivery', JSON.stringify(delivery));
    navigate('/checkout');
  };

  return (
    <div style={styles.overlay} onClick={() => { if (!placing) onClose(); }}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()}>
        <div style={styles.sheetHeader}>
          <div>
            <p style={styles.sheetTitle}>🔁 Reorder</p>
            <p style={styles.sheetSub}>
              From {order.orderNumber || `Order #${order.id?.slice(-6)}`}
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose} disabled={placing}>✕</button>
        </div>

        {!lines ? (
          <p style={styles.sheetLoading}>Loading items…</p>
        ) : (
          <div style={styles.sheetBody}>
            {priceChanged && (
              <div style={styles.notice}>
                ℹ️ Some prices have changed since your last order. Totals below use today's prices.
              </div>
            )}
            {unavailableCount > 0 && (
              <div style={styles.notice}>
                ⚠️ {unavailableCount} item{unavailableCount > 1 ? 's are' : ' is'} out of stock and will be left out.
              </div>
            )}

            {lines.length === 0 ? (
              <p style={styles.sheetLoading}>No items left in this order.</p>
            ) : (
              lines.map(line => (
                <div key={line.id} style={{ ...styles.line, ...(line.available ? {} : styles.lineDisabled) }}>
                  <ItemImage line={line} />
                  <div style={styles.lineInfo}>
                    <p style={styles.lineName}>{line.name}</p>
                    <p style={styles.linePrice}>
                      ₹{line.price}/{line.unit}
                      {line.available && line.price !== line.origPrice && (
                        <span style={styles.wasPrice}> (was ₹{line.origPrice})</span>
                      )}
                    </p>
                    {!line.available && <p style={styles.lineOut}>Out of stock — skipped</p>}
                  </div>
                  {line.available ? (
                    <div style={styles.lineRight}>
                      <div style={styles.qtyControl}>
                        <button style={styles.qtyBtn} onClick={() => changeQty(line.id, -1)}>−</button>
                        <span style={styles.qty}>{line.qty}</span>
                        <button style={styles.qtyBtn} onClick={() => changeQty(line.id, 1)}>+</button>
                      </div>
                      <p style={styles.lineTotal}>₹{line.price * line.qty}</p>
                    </div>
                  ) : (
                    <button style={styles.removeBtn} onClick={() => changeQty(line.id, -9999)}>Remove</button>
                  )}
                </div>
              ))
            )}

            <div style={styles.box}>
              <p style={styles.boxLabel}>Delivering to</p>
              {deliveryOk ? (
                <>
                  <p style={styles.boxStrong}>{delivery.shopName}</p>
                  <p style={styles.boxText}>
                    {delivery.address}, {delivery.city} - {delivery.pincode}
                  </p>
                </>
              ) : (
                <p style={styles.boxText}>
                  No delivery address found for this order. Use "Change address or add items" below.
                </p>
              )}
            </div>

            <div style={styles.box}>
              <p style={styles.boxLabel}>Payment</p>
              <div
                style={{ ...styles.payOption, ...(paymentMethod === 'COD' ? styles.payOptionActive : {}) }}
                onClick={() => setPaymentMethod('COD')}
              >
                <div style={styles.radioOuter}>
                  {paymentMethod === 'COD' && <div style={styles.radioInner} />}
                </div>
                <span style={styles.payText}>Cash on Delivery</span>
              </div>
              {creditEligible && (
                <div
                  style={{
                    ...styles.payOption,
                    ...(paymentMethod === 'Credit' ? styles.payOptionActive : {}),
                    ...(!creditCoversOrder ? styles.payOptionDisabled : {}),
                  }}
                  onClick={() => creditCoversOrder && setPaymentMethod('Credit')}
                >
                  <div style={styles.radioOuter}>
                    {paymentMethod === 'Credit' && <div style={styles.radioInner} />}
                  </div>
                  <span style={styles.payText}>
                    Credit (Udhar){' '}
                    <span style={styles.paySub}>
                      {creditCoversOrder
                        ? `— ₹${availableCredit} available`
                        : `— exceeds your available ₹${availableCredit}`}
                    </span>
                  </span>
                </div>
              )}
              {paymentMethod === 'Credit' && !creditCoversOrder && (
                <p style={styles.warn}>Credit no longer covers this total. Choose Cash on Delivery or reduce the quantities.</p>
              )}
            </div>

            <input
              style={styles.notesInput}
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes for this order (optional)"
            />

            <div style={styles.totalBox}>
              <div style={styles.totalRow}><span>Subtotal</span><span>₹{totals.subtotal}</span></div>
              <div style={styles.totalRow}><span>GST</span><span>₹{totals.gst}</span></div>
              <div style={{ ...styles.totalRow, fontWeight: 'bold', fontSize: '17px', marginTop: '8px' }}>
                <span>Total</span><span>₹{totals.grandTotal}</span>
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button
              style={{ ...styles.placeBtn, ...(canPlace ? {} : styles.placeBtnDisabled) }}
              onClick={placeNow}
              disabled={!canPlace}
            >
              {placing ? 'Placing Order…' : `Place Order — ₹${totals.grandTotal}`}
            </button>
            <button style={styles.editBtn} onClick={editInCheckout} disabled={placing || totals.count === 0}>
              Change address or add items
            </button>
            <p style={styles.footNote}>
              Final prices and availability are confirmed when the order is placed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- the Orders page ----------

export default function Orders() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [credit, setCredit] = useState(null);
  const [reorderOrder, setReorderOrder] = useState(null);
  const autoOpened = useRef(false);
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('mdUser')); } catch (e) { return null; }
  })();

  useEffect(() => {
    // Orders are now looked up by the signed-in Firebase uid, not the phone
    // number in localStorage — that's what the Firestore rules check too,
    // so this has to wait for the real auth state rather than assuming
    // auth.currentUser is already populated on first render.
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      fetchOrders(fbUser?.uid);
    });
    fetchCredit();
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Reorder your last order" shortcut on Home lands here and opens the
  // newest order's reorder sheet straight away.
  useEffect(() => {
    const wantsAuto = location.state && location.state.autoReorder;
    if (!loading && wantsAuto && !autoOpened.current && orders.length > 0) {
      autoOpened.current = true;
      setReorderOrder(orders[0]);
    }
  }, [loading, orders, location.state]);

  const fetchOrders = async (uid) => {
    try {
      if (!uid) {
        setOrders([]);
        return;
      }
      const q = query(
        collection(db, 'orders'),
        where('uid', '==', uid)
      );
      const snapshot = await getDocs(q);
      const orderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      orderList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(orderList);
    } catch (error) {
      console.error('Error fetching orders:', error);
      const localOrders = JSON.parse(localStorage.getItem('mdOrders')) || [];
      setOrders(localOrders.reverse());
    } finally {
      setLoading(false);
    }
  };

  const fetchCredit = async () => {
    try {
      if (!user?.phone) return;
      const snap = await getDoc(doc(db, 'retailers', user.phone));
      if (snap.exists()) {
        const data = snap.data();
        if ((data.creditLimit || 0) > 0) {
          setCredit({
            limit: data.creditLimit || 0,
            balance: data.balanceOwed || 0,
            blocked: !!data.creditBlocked,
          });
        }
      }
    } catch (error) {
      // silently skip — this is a nice-to-have, not essential
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/home')}>← Back</button>
        <h2 style={styles.headerTitle}>My Orders</h2>
        <div />
      </div>

      {credit && (
        <div style={styles.creditBanner}>
          <div style={styles.creditBannerRow}>
            <span>Credit balance owed</span>
            <span style={styles.creditBannerAmount}>
              ₹{credit.balance.toLocaleString('en-IN')} <span style={styles.creditBannerLimit}>/ ₹{credit.limit.toLocaleString('en-IN')} limit</span>
            </span>
          </div>
          {credit.blocked && (
            <p style={styles.creditBlockedNote}>
              🔒 Credit is on hold until your balance is fully cleared.
            </p>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>📦 No orders yet</p>
          <button style={styles.shopBtn} onClick={() => navigate('/home')}>
            Start Shopping
          </button>
        </div>
      ) : (
        <div style={styles.ordersList}>
          {orders.map(order => (
            <div key={order.id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <span style={styles.orderId}>
                  {order.orderNumber || `Order #${order.id?.slice(-6)}`}
                </span>
                <span style={{
                  ...styles.orderStatus,
                  background: order.status === 'Dispatched' ? '#e8f5e9' : '#FFF6D9',
                  color: order.status === 'Dispatched' ? '#2e7d32' : '#8A6D00',
                }}>{order.status || 'Pending'}</span>
              </div>
              <p style={styles.orderDate}>{order.date}</p>

              {order.items?.map((item, i) => (
                <div key={i} style={styles.orderItem}>
                  <span>{item.name} x{item.qty}</span>
                  <span>₹{item.price * item.qty}</span>
                </div>
              ))}

              <div style={styles.orderTotal}>
                <span>Total</span>
                <span>₹{order.grandTotal}</span>
              </div>

              {order.paymentMethod && (
                <div style={styles.payRow}>
                  <span style={styles.payLabel}>{order.paymentMethod}</span>
                  <span style={{
                    ...styles.payBadge,
                    background: order.paymentStatus === 'Paid' ? '#e8f5e9' : '#FDEAEA',
                    color: order.paymentStatus === 'Paid' ? '#2e7d32' : '#B02D2F',
                  }}>
                    {order.paymentStatus || 'Unpaid'}
                  </span>
                </div>
              )}

              {order.delivery && (
                <p style={styles.address}>
                  📍 {order.delivery.address}, {order.delivery.city} - {order.delivery.pincode}
                </p>
              )}

              {order.items && order.items.length > 0 && (
                <button style={styles.reorderBtn} onClick={() => setReorderOrder(order)}>
                  🔁 Reorder
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {reorderOrder && (
        <ReorderSheet
          key={reorderOrder.id}
          order={reorderOrder}
          credit={credit}
          onClose={() => setReorderOrder(null)}
        />
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  header: {
    background: 'linear-gradient(135deg, #6E1F21 0%, #B02D2F 100%)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: { background: 'transparent', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer' },
  headerTitle: { color: 'white', margin: 0, fontSize: '20px' },
  creditBanner: {
    margin: '14px 16px 0',
    padding: '12px 14px',
    background: '#FDF4F4',
    border: '1px solid #E8C4C4',
    borderRadius: '12px',
    fontSize: '13px',
    color: '#6E1F21',
  },
  creditBannerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  creditBannerAmount: { fontWeight: 'bold', fontSize: '15px' },
  creditBannerLimit: { fontWeight: 'normal', fontSize: '11px', color: '#999' },
  creditBlockedNote: { margin: '8px 0 0', fontSize: '12px', color: '#B02D2F', fontWeight: 'bold' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  emptyText: { fontSize: '20px', color: '#999', marginBottom: '20px' },
  shopBtn: { padding: '12px 24px', background: '#B02D2F', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px' },
  ordersList: { padding: '16px' },
  orderCard: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' },
  orderId: { fontWeight: 'bold', fontSize: '14px', color: '#6E1F21' },
  orderStatus: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
  orderDate: { color: '#999', fontSize: '12px', marginBottom: '12px' },
  orderItem: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' },
  orderTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' },
  payRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' },
  payLabel: { fontSize: '13px', color: '#666' },
  payBadge: { padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
  address: { fontSize: '12px', color: '#888', marginTop: '10px', lineHeight: '1.45' },
  reorderBtn: { width: '100%', marginTop: '14px', padding: '11px', background: 'white', color: '#B02D2F', border: '1px solid #B02D2F', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },

  // reorder sheet
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { background: '#f5f5f5', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '18px 18px 0 0' },
  sheetHeader: { background: 'linear-gradient(135deg, #6E1F21 0%, #B02D2F 100%)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1, borderRadius: '18px 18px 0 0' },
  sheetTitle: { color: 'white', margin: 0, fontSize: '18px', fontWeight: 'bold' },
  sheetSub: { color: '#eecfcf', margin: '2px 0 0', fontSize: '12px' },
  closeBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: 'white', borderRadius: '8px', padding: '6px 11px', fontSize: '14px', cursor: 'pointer' },
  sheetLoading: { textAlign: 'center', color: '#999', padding: '40px 16px' },
  sheetBody: { padding: '14px 16px 24px' },
  notice: { background: '#FFF9E0', border: '1px solid #F0DE8C', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#7A6100', marginBottom: '10px' },
  line: { background: 'white', borderRadius: '12px', padding: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  lineDisabled: { opacity: 0.55 },
  itemEmoji: { fontSize: '26px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemPhoto: { width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, background: '#f5f5f5' },
  lineInfo: { flex: 1, minWidth: 0 },
  lineName: { margin: '0 0 3px', fontWeight: 'bold', fontSize: '13px' },
  linePrice: { margin: 0, color: '#999', fontSize: '12px' },
  wasPrice: { color: '#B02D2F' },
  lineOut: { margin: '4px 0 0', color: '#B02D2F', fontSize: '11px', fontWeight: 'bold' },
  lineRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' },
  qtyControl: { display: 'flex', alignItems: 'center', gap: '10px' },
  qtyBtn: { width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#B02D2F', color: 'white', fontSize: '17px', cursor: 'pointer', lineHeight: 1 },
  qty: { fontWeight: 'bold', fontSize: '15px', minWidth: '22px', textAlign: 'center' },
  lineTotal: { margin: 0, fontWeight: 'bold', color: '#6E1F21', fontSize: '13px' },
  removeBtn: { background: 'white', border: '1px solid #B02D2F', color: '#B02D2F', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  box: { background: 'white', borderRadius: '12px', padding: '14px', marginTop: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  boxLabel: { margin: '0 0 8px', fontSize: '11px', color: '#999', letterSpacing: '1px', textTransform: 'uppercase' },
  boxStrong: { margin: '0 0 3px', fontWeight: 'bold', fontSize: '14px' },
  boxText: { margin: 0, fontSize: '13px', color: '#666', lineHeight: '1.45' },
  payOption: { display: 'flex', alignItems: 'center', gap: '10px', border: '2px solid #e0e0e0', borderRadius: '10px', padding: '11px 12px', marginBottom: '8px', cursor: 'pointer' },
  payOptionActive: { border: '2px solid #B02D2F', background: '#FDF4F4' },
  payOptionDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  radioOuter: { width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #B02D2F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioInner: { width: '9px', height: '9px', borderRadius: '50%', background: '#B02D2F' },
  payText: { fontSize: '13px', fontWeight: 'bold' },
  paySub: { fontWeight: 'normal', color: '#999', fontSize: '12px' },
  warn: { margin: '2px 0 0', fontSize: '12px', color: '#B02D2F', fontWeight: 'bold' },
  notesInput: { width: '100%', marginTop: '10px', padding: '12px', fontSize: '14px', border: '2px solid #e0e0e0', borderRadius: '10px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: 'white' },
  totalBox: { background: 'white', borderRadius: '12px', padding: '14px', marginTop: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' },
  error: { color: '#B02D2F', background: '#FDEAEA', margin: '12px 0 0', padding: '12px', borderRadius: '10px', fontSize: '13px' },
  placeBtn: { width: '100%', marginTop: '14px', padding: '15px', background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
  placeBtnDisabled: { background: '#ccc', cursor: 'not-allowed' },
  editBtn: { width: '100%', marginTop: '10px', padding: '12px', background: 'white', color: '#B02D2F', border: '1px solid #B02D2F', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' },
  footNote: { textAlign: 'center', color: '#999', fontSize: '11px', marginTop: '10px' },
};