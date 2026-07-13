import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ADMIN_PHONE = '9999999999';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (phone.length !== 10) {
      setError('Please enter a valid 10 digit phone number');
      return;
    }
    const user = { phone, isAdmin: phone === ADMIN_PHONE };
    localStorage.setItem('mdUser', JSON.stringify(user));
    if (phone === ADMIN_PHONE) {
      navigate('/admin');
    } else {
      navigate('/home');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🌰 Modern Dryfruit</h1>
        <p style={styles.subtitle}>Wholesale Ordering App</p>
        <input
          style={styles.input}
          type="tel"
          placeholder="Enter your phone number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          maxLength={10}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} onClick={() => handleLogin()}>
          Login →
        </button>
        <p style={styles.note}>Contact Modern Dryfruit to get access</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
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
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  title: { fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  subtitle: { color: '#666', marginBottom: '30px', fontSize: '14px' },
  input: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    marginBottom: '16px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginBottom: '16px',
  },
  error: { color: 'red', fontSize: '13px', marginBottom: '10px' },
  note: { color: '#999', fontSize: '12px' },
};