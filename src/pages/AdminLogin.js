import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      // The email/password only proves who they are — this check is what
      // proves they're actually allowed to be here. Anyone can sign up for
      // an account elsewhere; only a users/{uid} doc with role 'admin'
      // (set by hand in Firebase Console, never by client code) gets in.
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists() || snap.data().role !== 'admin') {
        await signOut(auth);
        setError('This account is not set up as an admin account.');
        setLoading(false);
        return;
      }

      const data = snap.data();
      localStorage.setItem('mdUser', JSON.stringify({
        name: data.name || 'Admin',
        phone: data.phone || '',
        isAdmin: true,
      }));

      window.location.replace('/admin');
    } catch (err) {
      console.error('Admin login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Incorrect email or password.');
      } else {
        setError('Could not log in. Please check your connection and try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src="/logo-header.png" alt="MDF HealthPlus" style={styles.logo} />
        <p style={styles.subtitle}>Admin Login</p>
        <input
          style={styles.input}
          type="email"
          placeholder="Admin email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoCapitalize="none"
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} onClick={handleLogin} disabled={loading}>
          {loading ? 'Logging in...' : 'Login →'}
        </button>
        <p style={styles.note}>
          <a href="/login" style={styles.link}>Retailer? Login here</a>
        </p>
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
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    marginBottom: '14px',
    boxSizing: 'border-box',
    outline: 'none',
    textAlign: 'center',
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
    marginTop: '6px',
  },
  error: { color: '#B02D2F', fontSize: '13px', marginBottom: '10px' },
  note: { color: '#999', fontSize: '12px' },
  link: { color: '#B02D2F', fontWeight: 'bold', textDecoration: 'none' },
};
