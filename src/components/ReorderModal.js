import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import bundledProducts from '../data/products.json';
import { fetchPacking, getCachedPacking, cartTotals } from '../packing';

function makeOrderNumber() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MDF-${yy}${mm}${dd}-${rand}`;
}

// One-tap reorder: rebuilds the old order with today's prices and
// places it with the same delivery details and payment method.
export default function ReorderModal({ order, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState([]);
  const [packing, setPacking] = useState(getCachedPacking);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [orderNumber] = useState(makeOrderNumber);

  useEffect(() => {
    (async () => {
      const cfg = await fetchPacking();
      setPacking(cfg);
      let live = null;
      try {
        const snap = await getDocs(collection(db, 'products'));
        live = snap.docs.map(d => ({ firebaseId: d.id, ...d.data() }));
      } catch (e) {
        try { live = JSON.parse(localStorage.getItem('mdProductOverlay'))?.data; } catch (e2) {}
      }
      if (!live || !live.length) live = bundledProducts;
      const byId = {};
      live.forEach(p => { byId[p.id] = p; });
      const imageById = {};
      bundledProducts.forEach(p => { imageById[p.id] = p.image; });

      setLines((order.items || []).map(item => {
        const p = byId[item.id];
        let pack = null;
        let unavailable = !p || p.stock === false;
        if (item.packing && !unavailable) {
          const opt = cfg.options.find(o => o.id === item.packing.id);
          if (!opt || p.packingEligible !== true) unavailable = true;
          else pack = { id: opt.id, label: opt.label, charge: opt.charge };
        }
        return {
          ...(p || item),
          image: (p && p.image) || imageById[item.id],
          qty: item.qty,
          packing: pack || (item.packing ? { ...item.packing } : null),
          unavailable,
        };
      }));
      setLoading(false);
    })();
  }, [order]);

  const available = lines.filter(l => !l.unavailable);
  const totals = cartTotals(available, packing);
  const wasCredit = String(order.paymentMethod || '').startsWith('Credit');

  const placeNow = async () => {
    if (placing) return;
    setError('');
    if (!available.length) { setError('None of these items are available right now.'); return; }
    if (!order.delivery) { setError('This order has no saved delivery details. Please use "Edit in cart".'); return; }
    if (!auth.currentUser) { setError('Your session has expired. Please log in again.'); return; }
    setPlacing(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          items: available.map(l => ({ id: l.id, qty: l.qty, name: l.name, packingId: l.packing?.id || null })),
          delivery: order.delivery,
          notes: '',
          paymentMethod: wasCredit ? 'Credit' : 'COD',
          orderNumber,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Could not place the order. Please try again.');
        setPlacing(false);
        return;
      }
      localStorage.setItem('mdLastOrder', JSON.stringify({ ...result.order, id: result.order.orderNumber }));
      navigate('/order-confirmed');
    } catch (e) {
      setError('Could not place the order. Check your connection and try again — it will not create a duplicate.');
      setPlacing(false);
    }
  };

  const editInCart = () => {
    const cart = available.map(({ unavailable, ...rest }) => rest);
    localStorage.setItem('mdCart', JSON.stringify(cart));
    navigate('/cart');
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()}>
        <p style={styles.title}>Reorder {order.orderNumber || ''}</p>
        {loading ? (
          <p style={styles.muted}>Checking today's prices…</p>
        ) : (
          <>
            <div style={styles.list}>
              {lines.map((l, i) => (
                <div key={i} style={{ ...styles.row, ...(l.unavailable ? styles.rowOff : {}) }}>
                  <div style={{ flex: 1 }}>
                    <span>{l.name} x{l.qty}</span>
                    {l.packing && <div style={styles.packing}>📦 {l.packing.label}</div>}
                  </div>
                  <span>{l.unavailable ? 'Unavailable' : `₹${l.price * l.qty}`}</span>
                </div>
              ))}
            </div>
            {totals.packingTotal > 0 && (
              <div style={styles.row}><span>Packing charges</span><span>₹{totals.packingTotal}</span></div>
            )}
            <div style={styles.row}><span>GST</span><span>₹{totals.gst}</span></div>
            <div style={{ ...styles.row, fontWeight: 'bold', fontSize: '16px' }}>
              <span>Total</span><span>₹{totals.grandTotal}</span>
            </div>
            {order.delivery && (
              <p style={styles.muted}>
                📍 {order.delivery.shopName}, {order.delivery.address}, {order.delivery.city} - {order.delivery.pincode}
                <br />💳 {wasCredit ? 'Credit (Udhar)' : 'Cash on Delivery'}
              </p>
            )}
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.primary} onClick={placeNow} disabled={placing || !available.length}>
              {placing ? 'Placing order…' : `Place order — ₹${totals.grandTotal}`}
            </button>
            <div style={styles.actions}>
              <button style={styles.secondary} onClick={editInCart} disabled={!available.length}>Edit in cart</button>
              <button style={styles.secondary} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 },
  sheet: { background: 'white', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '18px 18px 0 0', padding: '20px 18px 24px', boxSizing: 'border-box' },
  title: { margin: '0 0 12px', fontWeight: 'bold', fontSize: '18px', color: '#6E1F21' },
  list: { borderBottom: '1px solid #eee', marginBottom: '10px', paddingBottom: '6px' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', gap: '10px' },
  rowOff: { color: '#aaa', textDecoration: 'line-through' },
  packing: { fontSize: '12px', color: '#6E1F21' },
  muted: { color: '#777', fontSize: '12px', lineHeight: 1.5, margin: '10px 0' },
  error: { color: '#B02D2F', fontSize: '13px', fontWeight: 'bold' },
  primary: { width: '100%', padding: '15px', border: 'none', background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)', color: 'white', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '6px' },
  actions: { display: 'flex', gap: '10px', marginTop: '10px' },
  secondary: { flex: 1, padding: '12px', border: '1px solid #ddd', background: 'white', borderRadius: '12px', fontSize: '14px', cursor: 'pointer' },
};
