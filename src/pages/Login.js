import React, { useState } from 'react';

const ADMIN_PHONE = '9820891781';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    const cleaned = phone.trim();
    if (cleaned.length !== 10 || isNaN(cleaned)) {
      setError('Please enter a valid 10 digit phone number');
      return;
    }
    const user = { phone: cleaned, isAdmin: cleaned === ADMIN_PHONE };
    try {
      localStorage.setItem('mdUser', JSON.stringify(user));
    } catch (e) {
      console.log('localStorage error', e);
    }
    if (cleaned === ADMIN_PHONE) {
      window.location.replace('/admin');
    } else {
      window.location.replace('/home');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src="/logo-header.png" alt="MDF HealthPlus" style={styles.logo} />
        <p style={styles.subtitle}>Wholesale Ordering App</p>
        <input
          style={styles.input}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter 10 digit phone number"
          value={phone}
          onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} onClick={handleLogin}>
          Login →
        </button>
        <p style={styles.note}>Contact Modern Dryfruit to get access</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #6E1F21 0%, #B02D2F 55%, #8A2427 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  },
  logo: { width: '100%', maxWidth: '260px', height: 'auto', marginBottom: '8px' },
  subtitle: { color: '#666', marginBottom: '30px', fontSize: '14px' },
  input: {
    width: '100%',
    padding: '14px',
    fontSize: '18px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    marginBottom: '16px',
    boxSizing: 'border-box',
    outline: 'none',
    textAlign: 'center',
    letterSpacing: '4px',
  },
  button: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginBottom: '16px',
  },
  error: { color: '#B02D2F', fontSize: '13px', marginBottom: '10px' },
  note: { color: '#999', fontSize: '12px' },
};
