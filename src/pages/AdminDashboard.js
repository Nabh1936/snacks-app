import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, increment } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { enableOrderNotifications } from '../notifications';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [tab, setTab] = useState('orders');
  const [searchPhone, setSearchPhone] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notifStatus, setNotifStatus] = useState('idle');

  const [newCreditPhone, setNewCreditPhone] = useState('');
  const [newCreditName, setNewCreditName] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [savingCredit, setSavingCredit] = useState(false);
  const [editingLimits, setEditingLimits] = useState({});

  const user = (() => { try { return JSON.parse(localStorage.getItem('mdUser')); } catch (e) { return null; } })();

  // Real access gate: being signed in isn't enough — this checks that the
  // signed-in Firebase account's users/{uid} doc actually has role 'admin'.
  // That doc can only be set by hand in Firebase Console (client code is
  // blocked by the Firestore rules from ever setting role to 'admin'), so
  // this can't be bypassed by editing localStorage in the browser console.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        window.location.replace('/admin-login');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists() && snap.data().role === 'admin') {
          setCheckingAccess(false);
          fetchAll();
        } else {
          await signOut(auth);
          window.location.replace('/admin-login');
        }
      } catch (error) {
        console.error('Access check failed:', error);
        window.location.replace('/admin-login');
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const retailerSnap = await getDocs(collection(db, 'retailers'));
      const retailerList = retailerSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      retailerList.sort((a, b) => (b.balanceOwed || 0) - (a.balanceOwed || 0));
      setRetailers(retailerList);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    setNotifStatus('working');
    const result = await enableOrderNotifications(user?.phone || 'admin');
    setNotifStatus(result.ok ? 'on' : 'error');
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const markPaid = async (order) => {
    try {
      await updateDoc(doc(db, 'orders', order.id), { paymentStatus: 'Paid' });
      setOrders(orders.map(o => o.id === order.id ? { ...o, paymentStatus: 'Paid' } : o));

      if (order.paymentMethod && order.paymentMethod.startsWith('Credit') && order.phone) {
        const retailer = retailers.find(r => r.id === order.phone);
        const currentBalance = retailer ? (retailer.balanceOwed || 0) : order.grandTotal;
        const predictedNewBalance = currentBalance - order.grandTotal;

        const updates = {
          balanceOwed: increment(-order.grandTotal),
          updatedAt: Date.now(),
        };
        // Only lift the hold once the balance is fully cleared — a partial
        // payment does not reopen credit, per how this is meant to work.
        if (predictedNewBalance <= 0) {
          updates.creditBlocked = false;
        }

        await setDoc(doc(db, 'retailers', order.phone), updates, { merge: true });
        setRetailers(retailers.map(r =>
          r.id === order.phone
            ? { ...r, balanceOwed: predictedNewBalance, ...(predictedNewBalance <= 0 ? { creditBlocked: false } : {}) }
            : r
        ));
      }
    } catch (error) {
      console.error('Error marking paid:', error);
    }
  };

  const manuallyUnblockCredit = async (retailerId) => {
    try {
      await updateDoc(doc(db, 'retailers', retailerId), {
        creditBlocked: false,
        updatedAt: Date.now(),
      });
      setRetailers(retailers.map(r => r.id === retailerId ? { ...r, creditBlocked: false } : r));
    } catch (error) {
      console.error('Error unblocking credit:', error);
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

  const saveNewCredit = async () => {
    const phone = newCreditPhone.trim();
    const limit = Number(newCreditLimit);
    if (phone.length !== 10 || isNaN(phone)) {
      alert('Enter a valid 10 digit phone number.');
      return;
    }
    if (!newCreditLimit || isNaN(limit) || limit < 0) {
      alert('Enter a valid credit limit.');
      return;
    }
    setSavingCredit(true);
    try {
      await setDoc(doc(db, 'retailers', phone), {
        phone,
        name: newCreditName.trim(),
        creditLimit: limit,
        updatedAt: Date.now(),
      }, { merge: true });
      await fetchAll();
      setNewCreditPhone('');
      setNewCreditName('');
      setNewCreditLimit('');
    } catch (error) {
      console.error('Error saving credit:', error);
      alert('Could not save. Please try again.');
    } finally {
      setSavingCredit(false);
    }
  };

  const saveEditedLimit = async (retailerId) => {
    const newLimit = Number(editingLimits[retailerId]);
    if (isNaN(newLimit) || newLimit < 0) {
      alert('Enter a valid credit limit.');
      return;
    }
    try {
      await updateDoc(doc(db, 'retailers', retailerId), {
        creditLimit: newLimit,
        updatedAt: Date.now(),
      });
      setRetailers(retailers.map(r => r.id === retailerId ? { ...r, creditLimit: newLimit } : r));
      setEditingLimits(prev => {
        const next = { ...prev };
        delete next[retailerId];
        return next;
      });
    } catch (error) {
      console.error('Error updating limit:', error);
    }
  };

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
    .filter(o => o.paymentStatus !== 'Paid' && (!o.paymentMethod || !o.paymentMethod.startsWith('Credit')))
    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const totalCreditOutstanding = retailers.reduce((sum, r) => sum + (r.balanceOwed || 0), 0);
  const outOfStockCount = products.filter(p => !p.stock).length;

  if (checkingAccess) {
    return (
      <div style={styles.loading}>
        <p>Checking access...</p>
      </div>
    );
  }

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
        <button style={styles.logoutBtn} onClick={async () => {
          localStorage.removeItem('mdUser');
          try { await signOut(auth); } catch (e) {}
          window.location.href = '/admin-login';
        }}>Logout</button>
      </div>

      {notifStatus !== 'on' && (
        <div style={styles.notifBanner}>
          <div>
            <p style={styles.notifTitle}>🔔 Get notified instantly when an order arrives</p>
            <p style={styles.notifSub}>
              {notifStatus === 'error'
                ? 'Something went wrong — try again, or check that notifications are allowed for this site in your phone settings.'
                : 'Turn this on once and your phone will alert you the moment a retailer places an order.'}
            </p>
          </div>
          <button style={styles.notifBtn} onClick={handleEnableNotifications} disabled={notifStatus === 'working'}>
            {notifStatus === 'working' ? 'Enabling…' : 'Enable Notifications'}
          </button>
        </div>
      )}
      {notifStatus === 'on' && (
        <div style={styles.notifBannerOn}>
          ✅ Order notifications are on for this device
        </div>
      )}

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
          <p style={{ ...styles.statNumber, color: cashToCollect > 0 ? '#E67E00' : '#2e7d32' }}>
            ₹{cashToCollect.toLocaleString('en-IN')}
          </p>
          <p style={styles.statLabel}>Cash to Collect</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statNumber, color: totalCreditOutstanding > 0 ? '#6E1F21' : '#2e7d32' }}>
            ₹{totalCreditOutstanding.toLocaleString('en-IN')}
          </p>
          <p style={styles.statLabel}>Credit Outstanding</p>
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
          🏷️ Stock
        </button>
        <button
          style={{ ...styles.tabBtn, ...(tab === 'credit' ? styles.tabBtnActive : {}) }}
          onClick={() => setTab('credit')}
        >
          💳 Credit
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
            filteredOrders.map(order => {
              const isCredit = order.paymentMethod && order.paymentMethod.startsWith('Credit');
              return (
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
                      background: order.paymentStatus === 'Paid' ? '#e8f5e9' : (isCredit ? '#FDF4F4' : '#FDEAEA'),
                      color: order.paymentStatus === 'Paid' ? '#2e7d32' : (isCredit ? '#6E1F21' : '#B02D2F'),
                    }}>
                      {order.paymentStatus === 'Paid' ? (isCredit ? 'Credit Settled' : 'Cash Received') : (isCredit ? 'On Credit' : 'Cash Pending')}
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
                        style={isCredit ? styles.creditBtn : styles.cashBtn}
                        onClick={() => markPaid(order)}
                      >
                        {isCredit ? '💳 Mark Credit Paid' : '💵 Cash Received'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
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

      {tab === 'credit' && (
        <div style={styles.section}>
          <div style={styles.creditFormBox}>
            <h3 style={styles.sectionTitle}>Set Credit for a Retailer</h3>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              inputMode="numeric"
              value={newCreditPhone}
              onChange={e => setNewCreditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10 digit number"
            />
            <label style={styles.label}>Name (optional)</label>
            <input
              style={styles.input}
              type="text"
              value={newCreditName}
              onChange={e => setNewCreditName(e.target.value)}
              placeholder="Shop or retailer name"
            />
            <label style={styles.label}>Credit Limit (₹)</label>
            <input
              style={styles.input}
              type="number"
              value={newCreditLimit}
              onChange={e => setNewCreditLimit(e.target.value)}
              placeholder="e.g. 20000"
            />
            <button style={styles.saveCreditBtn} onClick={saveNewCredit} disabled={savingCredit}>
              {savingCredit ? 'Saving...' : 'Save Credit Limit'}
            </button>
            <p style={styles.creditFormNote}>
              If this phone number already has a credit limit set, this updates it. Their current balance owed is not affected.
            </p>
          </div>

          <h3 style={styles.sectionTitle}>Retailers on Credit</h3>
          {retailers.length === 0 ? (
            <p style={styles.noOrders}>No retailers have a credit limit set yet</p>
          ) : (
            retailers.map(r => {
              const limit = r.creditLimit || 0;
              const balance = r.balanceOwed || 0;
              const available = Math.max(0, limit - balance);
              const isEditing = editingLimits[r.id] !== undefined;
              const isBlocked = !!r.creditBlocked;
              return (
                <div key={r.id} style={styles.creditRow}>
                  <div style={styles.creditRowTop}>
                    <div>
                      <p style={styles.creditName}>
                        {r.name || 'Unnamed'}
                        {isBlocked && <span style={styles.holdBadge}>🔒 On Hold</span>}
                      </p>
                      <p style={styles.creditPhone}>📱 {r.phone || r.id}</p>
                    </div>
                    <div style={styles.creditBalanceBox}>
                      <p style={{ ...styles.creditBalanceNum, color: balance > 0 ? '#B02D2F' : '#2e7d32' }}>
                        ₹{balance.toLocaleString('en-IN')}
                      </p>
                      <p style={styles.creditBalanceLabel}>owed</p>
                    </div>
                  </div>
                  <div style={styles.creditMetaRow}>
                    <span>Limit: ₹{limit.toLocaleString('en-IN')}</span>
                    <span>Available: {isBlocked ? '₹0 (on hold)' : `₹${available.toLocaleString('en-IN')}`}</span>
                  </div>
                  {isEditing ? (
                    <div style={styles.editLimitRow}>
                      <input
                        style={styles.editLimitInput}
                        type="number"
                        value={editingLimits[r.id]}
                        onChange={e => setEditingLimits(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="New limit"
                      />
                      <button style={styles.editSaveBtn} onClick={() => saveEditedLimit(r.id)}>Save</button>
                      <button
                        style={styles.editCancelBtn}
                        onClick={() => setEditingLimits(prev => { const n = { ...prev }; delete n[r.id]; return n; })}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={styles.creditRowActions}>
                      <button
                        style={styles.editLimitBtn}
                        onClick={() => setEditingLimits(prev => ({ ...prev, [r.id]: String(limit) }))}
                      >
                        Edit Limit
                      </button>
                      {isBlocked && (
                        <button
                          style={styles.unblockBtn}
                          onClick={() => {
                            if (window.confirm(`Manually restore credit for ${r.name || r.phone} even though ₹${balance} is still owed?`)) {
                              manuallyUnblockCredit(r.id);
                            }
                          }}
                        >
                          Manually Restore Credit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
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
  notifBanner: {
    margin: '14px 16px 0',
    padding: '14px',
    background: '#FFF9E0',
    border: '1px solid #F0DE8C',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  notifBannerOn: {
    margin: '14px 16px 0',
    padding: '12px 14px',
    background: '#e8f5e9',
    border: '1px solid #b7e0ba',
    borderRadius: '12px',
    color: '#2e7d32',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  notifTitle: { margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: '#6E1F21' },
  notifSub: { margin: 0, fontSize: '12px', color: '#8A6D00' },
  notifBtn: {
    alignSelf: 'flex-start',
    padding: '10px 16px',
    background: '#B02D2F',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '16px' },
  statCard: { background: 'white', borderRadius: '12px', padding: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  statNumber: { fontSize: '17px', fontWeight: 'bold', color: '#B02D2F', margin: '0 0 4px' },
  statLabel: { color: '#999', margin: 0, fontSize: '11px' },
  tabs: { display: 'flex', gap: '8px', padding: '0 16px 12px' },
  tabBtn: { flex: 1, padding: '12px', border: '1px solid #ddd', background: 'white', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', color: '#666' },
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
  creditBtn: { flex: 1, padding: '10px', background: '#6E1F21', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  stockRow: { background: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  stockInfo: { flex: 1 },
  stockName: { margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px' },
  stockMeta: { margin: 0, color: '#999', fontSize: '12px' },
  stockToggle: { border: 'none', borderRadius: '20px', padding: '8px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
  creditFormBox: { background: 'white', borderRadius: '12px', padding: '18px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  label: { display: 'block', fontSize: '12px', color: '#777', marginBottom: '5px', fontWeight: 'bold' },
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    marginBottom: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  saveCreditBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
  creditFormNote: { fontSize: '11px', color: '#999', marginTop: '10px', marginBottom: 0 },
  creditRow: { background: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  creditRowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  creditName: { margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px' },
  creditPhone: { margin: 0, fontSize: '12px', color: '#999' },
  creditBalanceBox: { textAlign: 'right' },
  creditBalanceNum: { margin: '0 0 2px', fontWeight: 'bold', fontSize: '16px' },
  creditBalanceLabel: { margin: 0, fontSize: '10px', color: '#999' },
  creditMetaRow: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0f0f0' },
  editLimitBtn: { marginTop: '10px', padding: '8px 14px', background: 'white', border: '1px solid #B02D2F', color: '#B02D2F', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  creditRowActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  holdBadge: { marginLeft: '8px', fontSize: '10px', fontWeight: 'bold', color: '#B02D2F', background: '#FDEAEA', padding: '2px 8px', borderRadius: '10px' },
  unblockBtn: { marginTop: '10px', padding: '8px 14px', background: '#6E1F21', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  editLimitRow: { display: 'flex', gap: '8px', marginTop: '10px' },
  editLimitInput: { flex: 1, padding: '8px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' },
  editSaveBtn: { padding: '8px 14px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  editCancelBtn: { padding: '8px 14px', background: 'white', border: '1px solid #ccc', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' },
};
