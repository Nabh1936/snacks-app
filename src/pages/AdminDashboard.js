import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '../firebase';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllOrders();
  }, []);

  const fetchAllOrders = async () => {
    try {
      const q = query(collection(db, 'orders'));
      const snapshot = await getDocs(q);
      const orderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(orderList.reverse());
    } catch (error) {
      console.error('Error:', error);
      const localOrders = JSON.parse(localStorage.getItem('mdOrders')) || [];
      setOrders(localOrders.reverse());
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;

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
        <h2 style={styles.headerTitle}>🌰 Admin Dashboard</h2>
        <button style={styles.logoutBtn} onClick={() => {
          localStorage.removeItem('mdUser');
          navigate('/login');
        }}>Logout</button>
      </div>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <p style={styles.statNumber}>{orders.length}</p>
          <p style={styles.statLabel}>Total Orders</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statNumber}>{pendingOrders}</p>
          <p style={styles.statLabel}>Pending</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statNumber}>₹{totalRevenue}</p>
          <p style={styles.statLabel}>Revenue</p>
        </div>
      </div>

      <div style={styles.ordersList}>
        <h3 style={styles.sectionTitle}>All Orders</h3>
        {orders.length === 0 ? (
          <p style={styles.noOrders}>No orders yet</p>
        ) : (
          orders.map(order => (
            <div key={order.id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <span style={styles.orderId}>📱 {order.phone}</span>
                <span style={{
                  ...styles.orderStatus,
                  background: order.status === 'Dispatched' ? '#e8f5e9' : '#fff3e0',
                  color: order.status === 'Dispatched' ? '#2e7d32' : '#e65100',
                }}>{order.status}</span>
              </div>
              <p style={styles.orderDate}>{order.date}</p>
              {order.items?.map((item, i) => (
                <div key={i} style={styles.orderItem}>
                  <span>{item.name} x{item.qty}</span>
                  <span>₹{item.price * item.qty}</span>
                </div>
              ))}
              <div style={styles.orderTotal}>
                <span>Grand Total</span>
                <span>₹{order.grandTotal}</span>
              </div>
              {order.status === 'Pending' && (
                <button
                  style={styles.dispatchBtn}
                  onClick={() => updateStatus(order.id, 'Dispatched')}
                >
                  Mark as Dispatched ✅
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  header: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: 'white', margin: 0, fontSize: '20px' },
  logoutBtn: { background: 'transparent', border: '1px solid #aaa', color: '#aaa', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
  stats: { display: 'flex', gap: '12px', padding: '16px' },
  statCard: { flex: 1, background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  statNumber: { fontSize: '22px', fontWeight: 'bold', color: '#667eea', margin: '0 0 4px' },
  statLabel: { color: '#999', margin: 0, fontSize: '11px' },
  ordersList: { padding: '0 16px 40px' },
  sectionTitle: { fontSize: '18px', marginBottom: '12px' },
  noOrders: { color: '#999', textAlign: 'center', padding: '40px' },
  orderCard: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  orderId: { fontWeight: 'bold', fontSize: '14px' },
  orderStatus: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px' },
  orderDate: { color: '#999', fontSize: '12px', marginBottom: '12px' },
  orderItem: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' },
  orderTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' },
  dispatchBtn: { width: '100%', marginTop: '12px', padding: '10px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
};