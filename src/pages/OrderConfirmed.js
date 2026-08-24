import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function OrderConfirmed() {
  const navigate = useNavigate();
  const order = (() => {
    try { return JSON.parse(localStorage.getItem('mdLastOrder')); } catch (e) { return null; }
  })();

  if (!order) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.emptyText}>No recent order found.</p>
          <button style={styles.primaryBtn} onClick={() => navigate('/home')}>
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.tick}>✅</div>
        <h1 style={styles.title}>Order Placed!</h1>
        <p style={styles.sub}>Thank you. Your order has been received.</p>

        <div style={styles.orderNumBox}>
          <p style={styles.orderNumLabel}>Order Number</p>
          <p style={styles.orderNum}>{order.orderNumber}</p>
        </div>

        <div style={styles.detailBox}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Payment</span>
            <span style={styles.detailValue}>Cash on Delivery</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Amount Payable</span>
            <span style={{ ...styles.detailValue, fontWeight: 'bold', fontSize: '17px' }}>
              ₹{order.grandTotal}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Items</span>
            <span style={styles.detailValue}>{order.items?.length || 0}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Placed On</span>
            <span style={styles.detailValue}>{order.date}</span>
          </div>
        </div>

        {order.delivery && (
          <div style={styles.addressBox}>
            <p style={styles.addressLabel}>Delivering to</p>
            <p style={styles.addressName}>{order.delivery.shopName}</p>
            <p style={styles.addressText}>
              {order.delivery.address}, {order.delivery.city} - {order.delivery.pincode}
            </p>
            <p style={styles.addressText}>📱 {order.delivery.contactPhone}</p>
          </div>
        )}

        <p style={styles.note}>
          Please keep ₹{order.grandTotal} ready in cash at the time of delivery.
        </p>

        <button style={styles.primaryBtn} onClick={() => navigate('/orders')}>
          View My Orders
        </button>
        <button style={styles.secondaryBtn} onClick={() => navigate('/home')}>
          Continue Shopping
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    background: 'white',
    borderRadius: '18px',
    padding: '28px 22px',
    width: '100%',
    maxWidth: '440px',
    textAlign: 'center',
    boxShadow: '0 6px 26px rgba(0,0,0,0.08)',
  },
  tick: { fontSize: '52px', marginBottom: '6px' },
  title: { fontSize: '24px', color: '#6E1F21', margin: '0 0 6px' },
  sub: { color: '#666', fontSize: '14px', margin: '0 0 20px' },
  emptyText: { color: '#999', fontSize: '16px', marginBottom: '18px' },
  orderNumBox: {
    background: '#FDF4F4',
    border: '1px dashed #B02D2F',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '18px',
  },
  orderNumLabel: { margin: '0 0 4px', fontSize: '11px', color: '#999', letterSpacing: '1px' },
  orderNum: { margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#6E1F21', letterSpacing: '1px' },
  detailBox: { textAlign: 'left', marginBottom: '16px' },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '9px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  detailLabel: { color: '#888', fontSize: '13px' },
  detailValue: { color: '#222', fontSize: '14px' },
  addressBox: {
    textAlign: 'left',
    background: '#fafafa',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '16px',
  },
  addressLabel: { margin: '0 0 6px', fontSize: '11px', color: '#999', letterSpacing: '1px' },
  addressName: { margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px' },
  addressText: { margin: '0 0 3px', fontSize: '13px', color: '#666', lineHeight: '1.45' },
  note: {
    background: '#FFF9E0',
    border: '1px solid #F0DE8C',
    borderRadius: '10px',
    padding: '11px',
    fontSize: '13px',
    color: '#7A6100',
    marginBottom: '18px',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginBottom: '10px',
  },
  secondaryBtn: {
    width: '100%',
    padding: '13px',
    background: 'white',
    color: '#B02D2F',
    border: '1px solid #B02D2F',
    borderRadius: '10px',
    fontSize: '15px',
    cursor: 'pointer',
  },
};
