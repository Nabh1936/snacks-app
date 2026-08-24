import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('mdUser')); } catch (e) { return null; }
  })();

  useEffect(() => {
    fetchOrders();
  }, [user?.phone]);

  const fetchOrders = async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('phone', '==', user?.phone)
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
