import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Cart() {
  const [cart, setCart] = useState(JSON.parse(localStorage.getItem('mdCart')) || []);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('mdUser'));

  const updateQty = (id, delta) => {
    let newCart = cart.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0);
    setCart(newCart);
    localStorage.setItem('mdCart', JSON.stringify(newCart));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const totalGst = cart.reduce((sum, c) => {
    const gstRate = c.gst || 0;
    return sum + Math.round(c.price * c.qty * gstRate / 100);
  }, 0);
  const grandTotal = subtotal + totalGst;

  const placeOrder = async () => {
    if (cart.length === 0) return;
    const order = {
      name: user?.name || '',
      phone: user?.phone,
      items: cart,
      subtotal,
      gst: totalGst,
      grandTotal,
      status: 'Pending',
      date: new Date().toLocaleString(),
    };
    try {
      await addDoc(collection(db, 'orders'), order);
    } catch (error) {
      const orders = JSON.parse(localStorage.getItem('mdOrders')) || [];
      orders.push({ ...order, id: Date.now() });
      localStorage.setItem('mdOrders', JSON.stringify(orders));
    }
    localStorage.removeItem('mdCart');
    navigate('/orders');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/home')}>← Back</button>
        <h2 style={styles.headerTitle}>Your Cart</h2>
        <div />
      </div>

      {cart.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>🛒 Your cart is empty</p>
          <button style={styles.shopBtn} onClick={() => navigate('/home')}>
            Start Shopping
          </button>
        </div>
      ) : (
        <div>
          <div style={styles.items}>
            {cart.map(item => (
              <div key={item.id} style={styles.cartItem}>
                <div style={styles.itemInfo}>
                  <p style={styles.itemName}>{item.name}</p>
                  <p style={styles.itemPrice}>₹{item.price}/{item.unit}</p>
                  {item.gst === 0 && <span style={styles.gstFree}>GST Free</span>}
                </div>
                <div style={styles.qtyControl}>
                  <button style={styles.qtyBtn} onClick={() => updateQty(item.id, -1)}>−</button>
                  <span style={styles.qty}>{item.qty}</span>
                  <button style={styles.qtyBtn} onClick={() => updateQty(item.id, 1)}>+</button>
                </div>
                <p style={styles.itemTotal}>₹{item.price * item.qty}</p>
              </div>
            ))}
          </div>

          <div style={styles.bill}>
            <h3 style={styles.billTitle}>Bill Summary</h3>
            <div style={styles.billRow}>
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            <div style={styles.billRow}>
              <span>GST (5% on applicable items)</span>
              <span>₹{totalGst}</span>
            </div>
            <div style={styles.divider} />
            <div style={{ ...styles.billRow, fontWeight: 'bold', fontSize: '18px' }}>
              <span>Total</span>
              <span>₹{grandTotal}</span>
            </div>
          </div>

          <div style={styles.footer}>
            <button style={styles.orderBtn} onClick={placeOrder}>
              Place Order — ₹{grandTotal}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: {
    background: 'linear-gradient(135deg, #6E1F21 0%, #B02D2F 100%)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: { background: 'transparent', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer' },
  headerTitle: { color: 'white', margin: 0, fontSize: '20px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  emptyText: { fontSize: '20px', color: '#999', marginBottom: '20px' },
  shopBtn: { padding: '12px 24px', background: '#B02D2F', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px' },
  items: { padding: '16px' },
  cartItem: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  itemInfo: { flex: 1 },
  itemName: { margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px' },
  itemPrice: { margin: 0, color: '#999', fontSize: '12px' },
  gstFree: { fontSize: '10px', color: '#2e7d32', background: '#e8f5e9', padding: '2px 6px', borderRadius: '8px' },
  qtyControl: { display: 'flex', alignItems: 'center', gap: '12px' },
  qtyBtn: { width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#B02D2F', color: 'white', fontSize: '18px', cursor: 'pointer' },
  qty: { fontWeight: 'bold', fontSize: '16px', minWidth: '20px', textAlign: 'center' },
  itemTotal: { fontWeight: 'bold', color: '#6E1F21', minWidth: '70px', textAlign: 'right' },
  bill: { background: 'white', margin: '0 16px', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  billTitle: { margin: '0 0 16px', fontSize: '16px' },
  billRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '15px' },
  divider: { height: '1px', background: '#eee', margin: '12px 0' },
  footer: { padding: '20px 16px' },
  orderBtn: { width: '100%', padding: '16px', background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
};
