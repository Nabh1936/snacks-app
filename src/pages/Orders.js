import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('mdUser'));

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('phone', '==', user?.phone)
      );
      const snapshot = await getDocs(q);
      const orderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(orderList.reverse());
    } catch (error) {
      console.error('Error fetching orders:', error);
      const localOrders = JSON.parse(localStorage.getItem('mdOrders')) || [];
      setOrders(localOrders.reverse());
    } finally {
      setLoading(false);
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
                <span style={styles.orderId}>Order #{order.id?.slice(-6)}</span>
                <span style={styles.orderStatus}>{order.status || 'Pending'}</span>
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
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: { background: 'transparent', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer' },
  headerTitle: { color: 'white', margin: 0, fontSize: '20px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  emptyText: { fontSize: '20px', color: '#999', marginBottom: '20px' },
  shopBtn: { padding: '12px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px' },
  ordersList: { padding: '16px' },
  orderCard: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  orderId: { fontWeight: 'bold', fontSize: '14px' },
  orderStatus: { background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' },
  orderDate: { color: '#999', fontSize: '12px', marginBottom: '12px' },
  orderItem: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' },
  orderTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' },
};