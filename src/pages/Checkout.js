import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const MIN_ORDER_VALUE = 0; // set to e.g. 2000 to enforce a minimum order

export default function Checkout() {
  const navigate = useNavigate();
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('mdUser')); } catch (e) { return null; }
  })();
  const cart = JSON.parse(localStorage.getItem('mdCart')) || [];

  const [shopName, setShopName] = useState(user?.name || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  // Pre-fill from last saved delivery details
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mdDelivery'));
      if (saved) {
        if (saved.shopName) setShopName(saved.shopName);
        if (saved.contactPhone) setContactPhone(saved.contactPhone);
        if (saved.address) setAddress(saved.address);
        if (saved.city) setCity(saved.city);
        if (saved.pincode) setPincode(saved.pincode);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const totalGst = cart.reduce((sum, c) => {
    const gstRate = c.gst || 0;
    return sum + Math.round(c.price * c.qty * gstRate / 100);
  }, 0);
  const grandTotal = subtotal + totalGst;

  const makeOrderNumber = () => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `MDF-${yy}${mm}${dd}-${rand}`;
  };

  const placeOrder = async () => {
    if (placing) return;
    setError('');

    if (cart.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (shopName.trim().length < 2) {
      setError('Please enter the shop or business name.');
      return;
    }
    if (contactPhone.trim().length !== 10 || isNaN(contactPhone.trim())) {
      setError('Please enter a valid 10 digit contact number.');
      return;
    }
    if (address.trim().length < 10) {
      setError('Please enter a complete delivery address.');
      return;
    }
    if (city.trim().length < 2) {
      setError('Please enter the city.');
      return;
    }
    if (pincode.trim().length !== 6 || isNaN(pincode.trim())) {
      setError('Please enter a valid 6 digit pincode.');
      return;
    }
    if (MIN_ORDER_VALUE > 0 && grandTotal < MIN_ORDER_VALUE) {
      setError(`Minimum order value is ₹${MIN_ORDER_VALUE}. Please add more items.`);
      return;
    }

    setPlacing(true);

    const delivery = {
      shopName: shopName.trim(),
      contactPhone: contactPhone.trim(),
      address: address.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
    };

    const order = {
      orderNumber: makeOrderNumber(),
      name: user?.name || delivery.shopName,
      phone: user?.phone || delivery.contactPhone,
      delivery,
      notes: notes.trim(),
      items: cart,
      subtotal,
      gst: totalGst,
      grandTotal,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'Unpaid',
      status: 'Pending',
      date: new Date().toLocaleString(),
      createdAt: Date.now(),
    };

    try {
      const ref = await addDoc(collection(db, 'orders'), order);
      localStorage.setItem('mdDelivery', JSON.stringify(delivery));
      localStorage.setItem('mdLastOrder', JSON.stringify({ ...order, id: ref.id }));
      localStorage.removeItem('mdCart');
      navigate('/order-confirmed');
    } catch (err) {
      console.error('Order error:', err);
      setError('Could not place the order. Please check your connection and try again.');
      setPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => navigate('/home')}>← Back</button>
          <h2 style={styles.headerTitle}>Checkout</h2>
          <div />
        </div>
        <div style={styles.empty}>
          <p style={styles.emptyText}>🛒 Your cart is empty</p>
          <button style={styles.shopBtn} onClick={() => navigate('/home')}>
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/cart')}>← Back</button>
        <h2 style={styles.headerTitle}>Checkout</h2>
        <div />
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Delivery Details</h3>

        <label style={styles.label}>Shop / Business Name</label>
        <input
          style={styles.input}
          type="text"
          value={shopName}
          onChange={e => setShopName(e.target.value)}
          placeholder="e.g. Sharma Kirana Store"
        />

        <label style={styles.label}>Contact Number</label>
        <input
          style={styles.input}
          type="tel"
          inputMode="numeric"
          value={contactPhone}
          onChange={e => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10 digit number"
        />

        <label style={styles.label}>Delivery Address</label>
        <textarea
          style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Shop number, building, street, landmark"
        />

        <div style={styles.row}>
          <div style={styles.rowItem}>
            <label style={styles.label}>City</label>
            <input
              style={styles.input}
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="City"
            />
          </div>
          <div style={styles.rowItem}>
            <label style={styles.label}>Pincode</label>
            <input
              style={styles.input}
              type="tel"
              inputMode="numeric"
              value={pincode}
              onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 digits"
            />
          </div>
        </div>

        <label style={styles.label}>Notes for this order (optional)</label>
        <input
          style={styles.input}
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. deliver before 5 PM"
        />
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Payment Method</h3>

        <div
          style={{ ...styles.payOption, ...(paymentMethod === 'COD' ? styles.payOptionActive : {}) }}
          onClick={() => setPaymentMethod('COD')}
        >
          <div style={styles.radioOuter}>
            {paymentMethod === 'COD' && <div style={styles.radioInner} />}
          </div>
          <div>
            <p style={styles.payTitle}>Cash on Delivery</p>
            <p style={styles.paySub}>Pay in cash when the order is delivered</p>
          </div>
        </div>

        <div style={{ ...styles.payOption, ...styles.payOptionDisabled }}>
          <div style={styles.radioOuter} />
          <div>
            <p style={{ ...styles.payTitle, color: '#aaa' }}>UPI / Online Payment</p>
            <p style={styles.paySub}>Coming soon</p>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Order Summary</h3>
        <div style={styles.bill}>
          <div style={styles.billRow}>
            <span>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
            <span>₹{subtotal}</span>
          </div>
          <div style={styles.billRow}>
            <span>GST</span>
            <span>₹{totalGst}</span>
          </div>
          <div style={styles.divider} />
          <div style={{ ...styles.billRow, fontWeight: 'bold', fontSize: '18px' }}>
            <span>Total Payable</span>
            <span>₹{grandTotal}</span>
          </div>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.footer}>
        <button style={styles.orderBtn} onClick={placeOrder} disabled={placing}>
          {placing ? 'Placing Order...' : `Place Order — ₹${grandTotal}`}
        </button>
        <p style={styles.footNote}>
          You will pay ₹{grandTotal} in cash at the time of delivery.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5', paddingBottom: '30px' },
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
  section: {
    background: 'white',
    margin: '14px 16px 0',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  sectionTitle: { margin: '0 0 14px', fontSize: '16px', color: '#6E1F21' },
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
    fontFamily: 'inherit',
  },
  row: { display: 'flex', gap: '12px' },
  rowItem: { flex: 1 },
  payOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '10px',
    cursor: 'pointer',
  },
  payOptionActive: { border: '2px solid #B02D2F', background: '#FDF4F4' },
  payOptionDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  radioOuter: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid #B02D2F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioInner: { width: '10px', height: '10px', borderRadius: '50%', background: '#B02D2F' },
  payTitle: { margin: '0 0 2px', fontWeight: 'bold', fontSize: '14px' },
  paySub: { margin: 0, fontSize: '12px', color: '#999' },
  bill: {},
  billRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '15px' },
  divider: { height: '1px', background: '#eee', margin: '12px 0' },
  error: {
    color: '#B02D2F',
    background: '#FDEAEA',
    margin: '14px 16px 0',
    padding: '12px',
    borderRadius: '10px',
    fontSize: '14px',
  },
  footer: { padding: '18px 16px' },
  orderBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  footNote: { textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '10px' },
};
