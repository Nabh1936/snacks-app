import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const CACHE_KEY = 'mdProductsCache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export default function Home() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('mdUser')); } catch (e) { return null; } })();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState(JSON.parse(localStorage.getItem('mdCart')) || []);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async (force = false) => {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
          setProducts(cached.data);
          setLoading(false);
          return;
        }
      } catch (e) {
        // ignore bad cache, fall through to fetch
      }
    }

    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const productList = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
      productList.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(productList);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: productList, time: Date.now() }));
      } catch (e) {
        // storage full or unavailable — app still works, just won't cache
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      // if fetch fails, fall back to whatever is cached even if stale
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached) setProducts(cached.data);
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...new Set(products.map(p => p.category))].sort();

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
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

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading products...</p>
      </div>
    );
  }

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
            style={{
              ...styles.catBtn,
              ...(category === cat ? styles.catBtnActive : {}),
            }}
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
        <button style={styles.refreshBtn} onClick={() => { setLoading(true); loadProducts(true); }}>
          ↻ Refresh
        </button>
      </div>

      <div style={styles.grid}>
        {filtered.map(product => {
          const outOfStock = product.stock === false;
          return (
            <div key={product.id} style={{ ...styles.productCard, ...(outOfStock ? styles.productCardDisabled : {}) }}>
              <div style={styles.productEmoji}>🥜</div>
              <p style={styles.productName}>{product.name}</p>
              <p style={styles.productCategory}>{product.category}</p>
              <p style={styles.productPrice}>
                ₹{product.price}/{product.unit}
              </p>
              {product.gst === 0 && (
                <p style={styles.gstFree}>GST Free</p>
              )}
              {outOfStock ? (
                <p style={styles.outOfStockLabel}>Out of Stock</p>
              ) : getCartQty(product.id) > 0 ? (
                <div style={styles.qtyBadge}>
                  In cart: {getCartQty(product.id)}
                </div>
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

      {toast && (
        <div style={styles.toast}>{toast}</div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5', paddingBottom: '40px' },
  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  loadingText: { fontSize: '18px', color: '#666' },
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
  cartBtn: {
    background: '#FFF112',
    color: '#6E1F21',
    border: 'none',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  ordersBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.6)',
    color: 'white',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.6)',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  searchBox: { padding: '12px 16px' },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  categories: {
    display: 'flex',
    gap: '8px',
    padding: '0 16px 12px',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
  catBtn: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #ddd',
    background: 'white',
    fontSize: '13px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  catBtnActive: {
    background: '#B02D2F',
    color: 'white',
    border: '1px solid #B02D2F',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px',
    marginBottom: '8px',
  },
  resultCount: {
    color: '#999',
    fontSize: '13px',
    margin: 0,
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    color: '#B02D2F',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px',
    padding: '0 16px',
  },
  productCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  productCardDisabled: { opacity: 0.6 },
  productEmoji: { fontSize: '40px', marginBottom: '8px' },
  productName: { fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px', minHeight: '36px' },
  productCategory: { fontSize: '11px', color: '#999', margin: '0 0 8px' },
  productPrice: { fontSize: '16px', fontWeight: 'bold', color: '#B02D2F', margin: '0 0 4px' },
  gstFree: { fontSize: '10px', color: '#2e7d32', fontWeight: 'bold', margin: '0 0 8px', background: '#e8f5e9', display: 'inline-block', padding: '2px 8px', borderRadius: '10px' },
  qtyBadge: { fontSize: '11px', color: '#B02D2F', fontWeight: 'bold', marginBottom: '6px' },
  outOfStockLabel: { fontSize: '11px', color: '#B02D2F', fontWeight: 'bold', marginBottom: '6px' },
  addBtn: {
    width: '100%',
    padding: '8px',
    background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  addBtnDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
  },
  toast: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#333',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '10px',
    fontSize: '14px',
    zIndex: 1000,
  },
};
