import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders');
  const [searchPhone, setSearchPhone] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const orderSnap = await getDocs(collection(db, 'orders'));
      const orderList = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      orderList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(orderList);

      const prodSnap = await getDocs(collection(db, 'products'));
      const prodList = prodSnap.docs.map(d => ({ firebaseId: d.id, ...d.data() }));
      prodList.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(prodList);
    } catch (error) {
      console.error('Error:', error);
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

  const markPaid = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { paymentStatus: 'Paid' });
      setOrders(orders.map(o => o.id === orderId ? { ...o, paymentStatus: 'Paid' } : o));
    } catch (error) {
      console.error('Error marking paid:', error);
    }
  };

  const toggleStock = async (product) => {
    const newStock = !product.stock;
    try {
      await updateDoc(doc(db, 'products', product.firebaseId), { stock: newStock });
      setProducts(products.map(p =>
        p.firebaseId === product.firebaseId ? { ...p, stock: newStock } : p
      ));
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const clearAllOrders = async () => {
    setClearing(true);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'orders', d.id));
      }
      localStorage.removeItem('mdOrders');
      setOrders([]);
    } catch (error) {
      console.error('Error clearing orders:', error);
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  // Date filters now use the reliable numeric createdAt timestamp instead of
  // re-parsing the human-readable date string. Orders placed before this
  // field existed won't match Today/This Week (they'll still show under All).
  const isSameDay = (timestamp, ref) => {
    if (!timestamp) return false;
    const d = new Date(timestamp);
    return d.toDateString() === ref.toDateString();
  };

  const isWithinDays = (timestamp, days) => {
    if (!timestamp) return false;
    const d = new Date(timestamp);
    const now = new Date();
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff <= days;
  };

  const filteredOrders = orders.filter(o => {
    const term = searchPhone.trim().toLowerCase();
    const matchSearch = !term
      || (o.phone || '').includes(term)
      || (o.name || '').toLowerCase().includes(term)
      || (o.orderNumber || '').toLowerCase().includes(term);
    let matchDate = true;
    if (dateFilter === 'today') matchDate = isSameDay(o.createdAt, new Date());
    if (dateFilter === 'week') matchDate = isWithinDays(o.createdAt, 7);
    return matchSearch && matchDate;
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(stockSearch.toLowerCase())
  );

  const totalRevenue = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;
  const cashToCollect = orders
    .filter(o => o.paymentStatus !== 'Paid')
    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const outOfStockCount = products.filter(p => !p.stock).length;

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <img src="/logo-header.png" alt="MDF HealthPlus" style={styles.headerLogo} />
        <button style={styles.logoutBtn} onClick={() => {
          localStorage.removeItem('mdUser');
          window.location.href = '/login';
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
          <p style={styles.statNumber}>₹{totalRevenue.toLocaleString('en-IN')}</p>
          <p style={styles.statLabel}>Total Value</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statNumber, color: cashToCollect > 0 ? '#E67E00' : '#2e7d32' }}>
            ₹{cashToCollect.toLocaleString('en-IN')}
          </p>
          <p style={styles.statLabel}>Cash to Collect</p>
        </div>
      </div>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tabBtn, ...(tab === 'orders' ? styles.tabBtnActive : {}) }}
          onClick={() => setTab('orders')}
        >
          📦 Orders
        </button>
        <button
          style={{ ...styles.tabBtn, ...(tab === 'stock' ? styles.tabBtnActive : {}) }}
          onClick={() => setTab('stock')}
        >
          🏷️ Manage Stock
        </button>
      </div>

      {tab === 'orders' && (
        <div style={styles.section}>
          {orders.length > 0 && (
            <div style={styles.clearBox}>
              {!confirmClear ? (
                <button style={styles.clearBtn} onClick={() => setConfirmClear(true)}>
                  🗑️ Clear All Orders
                </button>
              ) : (
                <div style={styles.confirmBox}>
                  <p style={styles.confirmText}>
                    This will permanently delete all {orders.length} orders. This cannot be undone.
                  </p>
                  <div style={styles.confirmActions}>
                    <button style={styles.cancelBtn} onClick={() => setConfirmClear(false)} disabled={clearing}>
                      Cancel
                    </button>
                    <button style={styles.confirmDeleteBtn} onClick={clearAllOrders} disabled={clearing}>
                      {clearing ? 'Deleting...' : 'Yes, Delete All'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search by name, phone or order number..."
            value={searchPhone}
            onChange={e => setSearchPhone(e.target.value)}
          />
          <div style={styles.dateFilters}>
            {['all', 'today', 'week'].map(f => (
              <button
                key={f}
                style={{ ...styles.dateBtn, ...(dateFilter === f ? styles.dateBtnActive : {}) }}
                onClick={() => setDateFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
          </div>

          <p style={styles.resultCount}>
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </p>

          {filteredOrders.length === 0 ? (
            <p style={styles.noOrders}>No orders match this filter</p>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} style={styles.orderCard}>
                <div style={styles.orderHeader}>
                  <div>
                    <span style={styles.orderNum}>
                      {order.orderNumber || `#${order.id?.slice(-6)}`}
                    </span>
                    {order.name && <span style={styles.orderName}>{order.name}</span>}
                    <span style={styles.orderPhoneSub}>📱 {order.phone}</span>
                  </div>
                  <span style={{
                    ...styles.orderStatus,
                    background: order.status === 'Dispatched' ? '#e8f5e9' : '#FFF6D9',
                    color: order.status === 'Dispatched' ? '#2e7d32' : '#8A6D00',
                  }}>{order.status}</span>
                </div>

                <p style={styles.orderDate}>{order.date}</p>

                {order.delivery && (
                  <div style={styles.addressBox}>
                    <p style={styles.addressText}>
                      📍 {order.delivery.address}, {order.delivery.city} - {order.delivery.pincode}
                    </p>
                    {order.delivery.contactPhone !== order.phone && (
                      <p style={styles.addressText}>☎️ {order.delivery.contactPhone}</p>
                    )}
                  </div>
                )}

                {order.notes && (
                  <p style={styles.notes}>📝 {order.notes}</p>
                )}

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

                <div style={styles.payRow}>
                  <span style={styles.payLabel}>
                    {order.paymentMethod || 'Cash on Delivery'}
                  </span>
                  <span style={{
                    ...styles.payBadge,
                    background: order.paymentStatus === 'Paid' ? '#e8f5e9' : '#FDEAEA',
                    color: order.paymentStatus === 'Paid' ? '#2e7d32' : '#B02D2F',
                  }}>
                    {order.paymentStatus === 'Paid' ? 'Cash Received' : 'Cash Pending'}
                  </span>
                </div>

                <div style={styles.actionRow}>
                  {order.status === 'Pending' && (
                    <button
                      style={styles.dispatchBtn}
                      onClick={() => updateStatus(order.id, 'Dispatched')}
                    >
                      Mark Dispatched
                    </button>
                  )}
                  {order.paymentStatus !== 'Paid' && (
                    <button
                      style={styles.cashBtn}
                      onClick={() => markPaid(order.id)}
                    >
                      💵 Cash Received
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'stock' && (
        <div style={styles.section}>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search product name or category..."
            value={stockSearch}
            onChange={e => setStockSearch(e.target.value)}
          />
          <p style={styles.resultCount}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            {outOfStockCount > 0 && ` · ${outOfStockCount} out of stock`}
          </p>

          {filteredProducts.map(product => (
            <div key={product.firebaseId} style={styles.stockRow}>
              <div style={styles.stockInfo}>
                <p style={styles.stockName}>{product.name}</p>
                <p style={styles.stockMeta}>
                  {product.category} · ₹{product.price}/{product.unit}
                </p>
              </div>
              <button
                style={{
                  ...styles.stockToggle,
                  background: product.stock ? '#e8f5e9' : '#FDEAEA',
                  color: product.stock ? '#2e7d32' : '#B02D2F',
                }}
                onClick={() => toggleStock(product)}
              >
                {product.stock ? 'In Stock' : 'Out of Stock'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5', paddingBottom: '40px' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  header: {
    background: 'linear-gradient(135deg, #6E1F21 0%, #B02D2F 100%)',
    padding: '14px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLogo: { height: '36px', width: 'auto' },
  logoutBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '16px' },
  statCard: { background: 'white', borderRadius: '12px', padding: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  statNumber: { fontSize: '19px', fontWeight: 'bold', color: '#B02D2F', margin: '0 0 4px' },
  statLabel: { color: '#999', margin: 0, fontSize: '11px' },
  tabs: { display: 'flex', gap: '8px', padding: '0 16px 12px' },
  tabBtn: { flex: 1, padding: '12px', border: '1px solid #ddd', background: 'white', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', color: '#666' },
  tabBtnActive: { background: '#B02D2F', color: 'white', border: '1px solid #B02D2F' },
  section: { padding: '0 16px 40px' },
  clearBox: { marginBottom: '14px' },
  clearBtn: { width: '100%', padding: '10px', background: 'white', border: '1px solid #B02D2F', color: '#B02D2F', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },
  confirmBox: { background: '#FDEAEA', border: '1px solid #B02D2F', borderRadius: '10px', padding: '14px' },
  confirmText: { color: '#6E1F21', fontSize: '13px', margin: '0 0 12px' },
  confirmActions: { display: 'flex', gap: '10px' },
  cancelBtn: { flex: 1, padding: '10px', background: 'white', border: '1px solid #ccc', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  confirmDeleteBtn: { flex: 1, padding: '10px', background: '#B02D2F', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },
  searchInput: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '10px',
  },
  dateFilters: { display: 'flex', gap: '8px' },
  dateBtn: { flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', fontSize: '13px', cursor: 'pointer' },
  dateBtnActive: { background: '#FFF112', border: '1px solid #E6D900', color: '#6E1F21', fontWeight: 'bold' },
  resultCount: { color: '#999', fontSize: '13px', margin: '10px 0 12px' },
  noOrders: { color: '#999', textAlign: 'center', padding: '40px' },
  orderCard: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  orderNum: { display: 'block', fontSize: '12px', color: '#B02D2F', fontWeight: 'bold', letterSpacing: '0.5px' },
  orderName: { display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#1a1a1a' },
  orderPhoneSub: { display: 'block', fontSize: '12px', color: '#999' },
  orderStatus: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', height: 'fit-content', whiteSpace: 'nowrap' },
  orderDate: { color: '#999', fontSize: '12px', marginBottom: '10px' },
  addressBox: { background: '#fafafa', borderRadius: '8px', padding: '10px', marginBottom: '10px' },
  addressText: { margin: '0 0 3px', fontSize: '12px', color: '#666', lineHeight: '1.45' },
  notes: { fontSize: '12px', color: '#8A6D00', background: '#FFF9E0', padding: '8px', borderRadius: '8px', marginBottom: '10px' },
  orderItem: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' },
  orderTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' },
  payRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' },
  payLabel: { fontSize: '13px', color: '#666' },
  payBadge: { padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
  actionRow: { display: 'flex', gap: '8px', marginTop: '12px' },
  dispatchBtn: { flex: 1, padding: '10px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  cashBtn: { flex: 1, padding: '10px', background: '#E67E00', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  stockRow: { background: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  stockInfo: { flex: 1 },
  stockName: { margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px' },
  stockMeta: { margin: 0, color: '#999', fontSize: '12px' },
  stockToggle: { border: 'none', borderRadius: '20px', padding: '8px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
};