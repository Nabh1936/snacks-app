import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import bundledProducts from '../data/products.json';

const OVERLAY_KEY = 'mdProductOverlay';
const OVERLAY_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

// Shows the real product photo if one exists in /public/product-images/,
// and automatically falls back to the emoji if it doesn't (e.g. this
// product's photo hasn't been taken yet). No code changes are ever
// needed when new photos arrive — just drop the file in the folder.
function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  if (!product.image || failed) {
    return <div style={styles.productEmoji}>🥜</div>;
  }
  return (
    <img
      src={`/product-images/${product.image}`}
      alt={product.name}
      style={styles.productPhoto}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

export default function Home() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('mdUser')); } catch (e) { return null; } })();
  const navigate = useNavigate();

  const [products, setProducts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OVERLAY_KEY));
      if (saved && Array.isArray(saved.data) && saved.data.length) return saved.data;
    } catch (e) {}
    return bundledProducts;
  });

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState(JSON.parse(localStorage.getItem('mdCart')) || []);
  const [toast, setToast] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let stale = true;
    try {
      const saved = JSON.parse(localStorage.getItem(OVERLAY_KEY));
      if (saved && Date.now() - saved.time < OVERLAY_TTL_MS) stale = false;
    } catch (e) {}
    if (stale) syncFromFirebase(false);
  }, []);

  const syncFromFirebase = async (showFeedback) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const fetchPromise = getDocs(collection(db, 'products'));
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS)
      );
      const snapshot = await Promise.race([fetchPromise, timeout]);

      const live = snapshot.docs.map(d => ({ firebaseId: d.id, ...d.data() }));
      if (live.length > 0) {
        // Firestore products may not carry the "image" field (it's set
        // in the bundled catalogue). Fill it in from the bundled data by
        // matching id, so photos keep working even after a live sync.
        const imageById = {};
        bundledProducts.forEach(p => { imageById[p.id] = p.image; });
        live.forEach(p => {
          if (!p.image && imageById[p.id]) p.image = imageById[p.id];
        });

        live.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        setProducts(live);
        try {
          localStorage.setItem(OVERLAY_KEY, JSON.stringify({ data: live, time: Date.now() }));
        } catch (e) {}
        if (showFeedback) {
          setToast('Products updated');
          setTimeout(() => setToast(''), 2000);
        }
      }
    } catch (error) {
      console.warn('Product sync skipped:', error.message);
      if (showFeedback) {
        setToast('Could not refresh — showing saved list');
        setTimeout(() => setToast(''), 2500);
      }
    } finally {
      setSyncing(false);
    }
  };

  const categories = ['All', ...new Set(products.map(p => p.category))].sort();

  const filtered = products.filter(p => {
    const matchSearch = String(p.name).toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'All' || p.category === category;
    return matchSearch && matchCategory;
  });

  const addToCart = (product) => {
    if (product.stock === false) return;
    const existing = cart.find(c => c.id === product.id);
    let newCart;
    if (existing) {
      newCart = cart.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
    } else {
      newCart = [...cart, { ...product, qty: 1 }];
    }
    setCart(newCart);
    localStorage.setItem('mdCart', JSON.stringify(newCart));
    setToast(`${product.name} added to cart!`);
    setTimeout(() => setToast(''), 2000);
  };

  const getCartQty = (id) => {
    const item = cart.find(c => c.id === id);
    return item ? item.qty : 0;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <img src="/logo-header.png" alt="MDF HealthPlus" style={styles.headerLogo} />
          <p style={styles.headerSub}>Welcome, {user?.phone}</p>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.cartBtn} onClick={() => navigate('/cart')}>
            🛒 {cart.reduce((sum, c) => sum + c.qty, 0)}
          </button>
          <button style={styles.ordersBtn} onClick={() => navigate('/orders')}>
            📦
          </button>
          <button style={styles.logoutBtn} onClick={() => {
            localStorage.removeItem('mdUser');
            window.location.href = '/login';
          }}>Logout</button>
        </div>
      </div>

      <div style={styles.searchBox}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="🔍 Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={styles.categories}>
        {categories.map(cat => (
          <button
            key={cat}
            style={{ ...styles.catBtn, ...(category === cat ? styles.catBtnActive : {}) }}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={styles.resultRow}>
        <p style={styles.resultCount}>
          {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
        </p>
        <button style={styles.refreshBtn} onClick={() => syncFromFirebase(true)} disabled={syncing}>
          {syncing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <div style={styles.grid}>
        {filtered.map(product => {
          const outOfStock = product.stock === false;
          return (
            <div key={product.id} style={{ ...styles.productCard, ...(outOfStock ? styles.productCardDisabled : {}) }}>
              <ProductImage product={product} />
              <p style={styles.productName}>{product.name}</p>
              <p style={styles.productCategory}>{product.category}</p>
              <p style={styles.productPrice}>₹{product.price}/{product.unit}</p>
              {product.gst === 0 && <p style={styles.gstFree}>GST Free</p>}
              {outOfStock ? (
                <p style={styles.outOfStockLabel}>Out of Stock</p>
              ) : getCartQty(product.id) > 0 ? (
                <div style={styles.qtyBadge}>In cart: {getCartQty(product.id)}</div>
              ) : null}
              <button
                style={{ ...styles.addBtn, ...(outOfStock ? styles.addBtnDisabled : {}) }}
                onClick={() => addToCart(product)}
                disabled={outOfStock}
              >
                {outOfStock ? 'Unavailable' : 'Add to Cart'}
              </button>
            </div>
          );
        })}
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5', paddingBottom: '40px' },
  header: {
    background: 'linear-gradient(135deg, #6E1F21 0%, #B02D2F 100%)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLogo: { height: '38px', width: 'auto', display: 'block' },
  headerSub: { color: '#eecfcf', margin: '4px 0 0', fontSize: '12px' },
  headerRight: { display: 'flex', gap: '8px', alignItems: 'center' },
  cartBtn: { background: '#FFF112', color: '#6E1F21', border: 'none', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
  ordersBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: 'white', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', cursor: 'pointer' },
  logoutBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
  searchBox: { padding: '12px 16px' },
  searchInput: { width: '100%', padding: '12px 16px', fontSize: '16px', border: '2px solid #e0e0e0', borderRadius: '12px', outline: 'none', boxSizing: 'border-box' },
  categories: { display: 'flex', gap: '8px', padding: '0 16px 12px', overflowX: 'auto', whiteSpace: 'nowrap' },
  catBtn: { padding: '8px 16px', borderRadius: '20px', border: '1px solid #ddd', background: 'white', fontSize: '13px', cursor: 'pointer', flexShrink: 0 },
  catBtnActive: { background: '#B02D2F', color: 'white', border: '1px solid #B02D2F' },
  resultRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', marginBottom: '8px' },
  resultCount: { color: '#999', fontSize: '13px', margin: 0 },
  refreshBtn: { background: 'none', border: 'none', color: '#B02D2F', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: '4px 8px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', padding: '0 16px' },
  productCard: { background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  productCardDisabled: { opacity: 0.6 },
  productEmoji: { fontSize: '40px', marginBottom: '8px' },
  productPhoto: { width: '100%', height: '96px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px', background: '#f5f5f5' },
  productName: { fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px', minHeight: '36px' },
  productCategory: { fontSize: '11px', color: '#999', margin: '0 0 8px' },
  productPrice: { fontSize: '16px', fontWeight: 'bold', color: '#B02D2F', margin: '0 0 4px' },
  gstFree: { fontSize: '10px', color: '#2e7d32', fontWeight: 'bold', margin: '0 0 8px', background: '#e8f5e9', display: 'inline-block', padding: '2px 8px', borderRadius: '10px' },
  qtyBadge: { fontSize: '11px', color: '#B02D2F', fontWeight: 'bold', marginBottom: '6px' },
  outOfStockLabel: { fontSize: '11px', color: '#B02D2F', fontWeight: 'bold', marginBottom: '6px' },
  addBtn: { width: '100%', padding: '8px', background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '4px' },
  addBtnDisabled: { background: '#ccc', cursor: 'not-allowed' },
  toast: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#333', color: 'white', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', zIndex: 1000 },
};