import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders'); // 'orders' | 'stock'
  const [searchPhone, setSearchPhone] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all | today | week
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
      setOrders(orderList.reverse());

      const prodSnap = await getDocs(collection(db, 'products'));
      const prodList = prodSnap.docs.map(d => ({ firebaseId: d.id, ...d.data() }));
      prodList.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(prodList);
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

  const isSameDay = (dateStr, ref) => {
    const d = new Date(dateStr);
    return d.toDateString() === ref.toDateString();
  };

  const isWithinDays = (dateStr, days) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff <= days;
  };

  const filteredOrders = orders.filter(o => {
    const matchPhone = !searchPhone || (o.phone || '').includes(searchPhone.trim());
    let matchDate = true;
    if (dateFilter === 'today') matchDate = isSameDay(o.date, new Date());
    if (dateFilter === 'week') matchDate = isWithinDays(o.date, 7);
    return matchPhone && matchDate;
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(stockSearch.toLowerCase())
  );

  const totalRevenue = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;
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
          <p style={styles.statLabel}>Revenue</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statNumber, color: outOfStockCount > 0 ? '#B02D2F' : '#2e7d32' }}>
            {outOfStockCount}
          </p>
          <p style={styles.statLabel}>Out of Stock</p>
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
          <div style={styles.filterRow}>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="Search by phone number..."
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
          </div>

          <p style={styles.resultCount}>{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}</p>

          {filteredOrders.length === 0 ? (
            <p style={styles.noOrders}>No orders match this filter</p>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} style={styles.orderCard}>
                <div style={styles.orderHeader}>
                  <div>
                  {order.name && <span style={styles.orderName}>{order.name}</span>}
                  <span style={order.name ? styles.orderPhoneSub : styles.orderId}>📱 {order.phone}</span>
                </div>
                  <span style={{
                    ...styles.orderStatus,
                    background: order.status === 'Dispatched' ? '#e8f5e9' : '#FFF6D9',
                    color: order.status === 'Dispatched' ? '#2e7d32' : '#8A6D00',
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
          <p style={styles.resultCount}>{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</p>

          {filteredProducts.map(product => (
            <div key={product.firebaseId} style={styles.stockRow}>
              <div style={styles.stockInfo}>
                <p style={styles.stockName}>{product.name}</p>
                <p style={styles.stockMeta}>{product.category} · ₹{product.price}/{product.unit}</p>
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
  statNumber: { fontSize: '20px', fontWeight: 'bold', color: '#B02D2F', margin: '0 0 4px' },
  statLabel: { color: '#999', margin: 0, fontSize: '11px' },
  tabs: { display: 'flex', gap: '8px', padding: '0 16px 12px' },
  tabBtn: { flex: 1, padding: '12px', border: '1px solid #ddd', background: 'white', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', color: '#666' },
  tabBtnActive: { background: '#B02D2F', color: 'white', border: '1px solid #B02D2F' },
  section: { padding: '0 16px 40px' },
  filterRow: { marginBottom: '8px' },
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
  resultCount: { color: '#999', fontSize: '13px', margin: '4px 0 12px' },
  noOrders: { color: '#999', textAlign: 'center', padding: '40px' },
  orderCard: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  orderId: { fontWeight: 'bold', fontSize: '14px' },
  orderName: { display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#1a1a1a' },
  orderPhoneSub: { display: 'block', fontSize: '12px', color: '#999' },
  orderStatus: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
  orderDate: { color: '#999', fontSize: '12px', marginBottom: '12px' },
  orderItem: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' },
  orderTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' },
  dispatchBtn: { width: '100%', marginTop: '12px', padding: '10px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  stockRow: { background: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  stockInfo: { flex: 1 },
  stockName: { margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px' },
  stockMeta: { margin: 0, color: '#999', fontSize: '12px' },
  stockToggle: { border: 'none', borderRadius: '20px', padding: '8px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
};
