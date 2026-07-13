import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const categories = ['All', 'Dry Fruits', 'Nuts', 'Seeds', 'Snacks', 'Sweets'];

const sampleProducts = [
  { id: 1, name: 'Cashews Premium', category: 'Nuts', price: 850, unit: 'kg', stock: true },
  { id: 2, name: 'Almonds California', category: 'Dry Fruits', price: 720, unit: 'kg', stock: true },
  { id: 3, name: 'Pistachios Roasted', category: 'Nuts', price: 1200, unit: 'kg', stock: true },
  { id: 4, name: 'Raisins Golden', category: 'Dry Fruits', price: 280, unit: 'kg', stock: true },
  { id: 5, name: 'Walnuts Kernels', category: 'Dry Fruits', price: 950, unit: 'kg', stock: true },
  { id: 6, name: 'Sunflower Seeds', category: 'Seeds', price: 180, unit: 'kg', stock: true },
];

export default function Home() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState(JSON.parse(localStorage.getItem('mdCart')) || []);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('mdUser'));

  const filtered = sampleProducts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const addToCart = (product) => {
    const existing = cart.find(c => c.id === product.id);
    let newCart;
    if (existing) {
      newCart = cart.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
    } else {
      newCart = [...cart, { ...product, qty: 1 }];
    }
    setCart(newCart);
    localStorage.setItem('mdCart', JSON.stringify(newCart));
  };

  const getQty = (id) => {
    const item = cart.find(c => c.id === id);
    return item ? item.qty : 0;
  };

  const totalItems = cart.reduce((sum, c) => sum + c.qty, 0);

  const handleLogout = () => {
    localStorage.removeItem('mdUser');
    localStorage.removeItem('mdCart');
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🌰 Modern Dryfruit</h1>
          <p style={styles.headerSub}>Welcome, {user?.phone}</p>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.cartBtn} onClick={() => navigate('/cart')}>
            🛒 {totalItems > 0 && <span style={styles.badge}>{totalItems}</span>}
          </button>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchContainer}>
        <input
          style={styles.searchInput}
          placeholder="🔍 Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div style={styles.categories}>
        {categories.map(cat => (
          <button
            key={cat}
            style={{ ...styles.catBtn, ...(activeCategory === cat ? styles.catActive : {}) }}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products */}
      <div style={styles.products}>
        {filtered.map(product => (
          <div key={product.id} style={styles.productCard}>
            <div style={styles.productEmoji}>🥜</div>
            <h3 style={styles.productName}>{product.name}</h3>
            <p style={styles.productCat}>{product.category}</p>
            <p style={styles.productPrice}>₹{product.price}/{product.unit}</p>
            <button style={styles.addBtn} onClick={() => addToCart(product)}>
              {getQty(product.id) > 0 ? `In Cart (${getQty(product.id)})` : 'Add to Cart'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: 'white', margin: 0, fontSize: '20px' },
  headerSub: { color: '#aaa', margin: 0, fontSize: '12px' },
  headerRight: { display: 'flex', gap: '10px', alignItems: 'center' },
  cartBtn: {
    background: '#667eea',
    border: 'none',
    borderRadius: '50%',
    width: '44px',
    height: '44px',
    fontSize: '20px',
    cursor: 'pointer',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    background: 'red',
    color: 'white',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #aaa',
    color: '#aaa',
    padding: '6px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  searchContainer: { padding: '16px' },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #ddd',
    fontSize: '15px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  categories: {
    display: 'flex',
    gap: '8px',
    padding: '0 16px 16px',
    overflowX: 'auto',
  },
  catBtn: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #ddd',
    background: 'white',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: '13px',
  },
  catActive: {
    background: '#667eea',
    color: 'white',
    border: '1px solid #667eea',
  },
  products: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '16px',
    padding: '0 16px 100px',
  },
  productCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '16px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  productEmoji: { fontSize: '40px', marginBottom: '8px' },
  productName: { fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px', color: '#1a1a2e' },
  productCat: { fontSize: '11px', color: '#999', margin: '0 0 8px' },
  productPrice: { fontSize: '16px', fontWeight: 'bold', color: '#667eea', margin: '0 0 12px' },
  addBtn: {
    width: '100%',
    padding: '8px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
};