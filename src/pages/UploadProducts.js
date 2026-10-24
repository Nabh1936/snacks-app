import React, { useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import productsData from '../data/products.json';

export default function UploadProducts() {
  const [status, setStatus] = useState('ready');
  const [progress, setProgress] = useState(0);
  const [total] = useState(productsData.length);

  const uploadAll = async () => {
    if (status === 'uploading') return;
    setStatus('uploading');
    setProgress(0);

    try {
      // First clear existing products
      setStatus('clearing');
      const existing = await getDocs(collection(db, 'products'));
      for (const d of existing.docs) {
        await deleteDoc(doc(db, 'products', d.id));
      }

      // Upload all products
      setStatus('uploading');
      for (let i = 0; i < productsData.length; i++) {
        await addDoc(collection(db, 'products'), productsData[i]);
        setProgress(i + 1);
      }
      setStatus('done');
    } catch (error) {
      console.error('Upload error:', error);
      setStatus('error');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Upload Products to Firebase</h1>
        <p style={styles.info}>Total products: <strong>{total}</strong></p>

        {status === 'ready' && (
          <button style={styles.button} onClick={uploadAll}>
            Upload All {total} Products
          </button>
        )}

        {status === 'clearing' && (
          <p style={styles.progress}>Clearing old products...</p>
        )}

        {status === 'uploading' && (
          <div>
            <p style={styles.progress}>
              Uploading: {progress} / {total}
            </p>
            <div style={styles.progressBar}>
              <div style={{
                ...styles.progressFill,
                width: `${(progress / total) * 100}%`
              }} />
            </div>
            <p style={styles.note}>Do not close this page!</p>
          </div>
        )}

        {status === 'done' && (
          <div>
            <p style={styles.success}>
              ✅ All {total} products uploaded successfully!
            </p>
            <p style={styles.note}>
              Go to <a href="/home">/home</a> to see them in the app.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p style={styles.error}>
              ❌ Error at product {progress}. Check console for details.
            </p>
            <button style={styles.button} onClick={uploadAll}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5',
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
    maxWidth: '500px',
    textAlign: 'center',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  },
  title: { fontSize: '22px', color: '#1a1a2e', marginBottom: '10px' },
  info: { fontSize: '16px', color: '#666', marginBottom: '20px' },
  button: {
    padding: '16px 32px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  progress: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e' },
  progressBar: {
    width: '100%',
    height: '20px',
    background: '#e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden',
    marginTop: '10px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    transition: 'width 0.2s',
  },
  success: { fontSize: '20px', color: '#2e7d32', fontWeight: 'bold' },
  error: { fontSize: '16px', color: '#d32f2f', marginBottom: '10px' },
  note: { color: '#999', fontSize: '14px', marginTop: '10px' },
};
