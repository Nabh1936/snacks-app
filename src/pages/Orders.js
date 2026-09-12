import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [credit, setCredit] = useState(null);
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
            </div>
          ))}
        </div>
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
};
