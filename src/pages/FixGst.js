import React, { useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function FixGst() {
  const [status, setStatus] = useState('ready');
  const [log, setLog] = useState([]);

  const runFix = async () => {
    setStatus('running');
    setLog([]);
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const matches = snapshot.docs.filter(d => {
        const data = d.data();
        return data.category === 'Mini Butter' || data.name.toLowerCase().includes('mini butter chakli');
      });

      if (matches.length === 0) {
        setLog(['No matching products found. They may already be fixed, or the category name is different.']);
        setStatus('done');
        return;
      }

      const lines = [];
      for (const d of matches) {
        const data = d.data();
        await updateDoc(doc(db, 'products', d.id), { gst: 5 });
        lines.push(`Fixed: ${data.name} → GST now 5%`);
      }
      setLog(lines);
      setStatus('done');
    } catch (error) {
      setLog([`Error: ${error.message}`]);
      setStatus('error');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Fix: Mini Butter Chakli GST</h1>
        <p style={styles.info}>
          This will find all products in the "Mini Butter" category
          (Mini Butter Chakli and its variants) and set their GST to 5%,
          since they were incorrectly marked as GST-free.
        </p>

        {status === 'ready' && (
          <button style={styles.button} onClick={runFix}>
            Run Fix
          </button>
        )}

        {status === 'running' && <p style={styles.progress}>Updating products...</p>}

        {(status === 'done' || status === 'error') && (
          <div style={styles.logBox}>
            {log.map((line, i) => (
              <p key={i} style={styles.logLine}>{line}</p>
            ))}
          </div>
        )}

        {status === 'done' && (
          <p style={styles.success}>✅ Done. You can delete this page's route now.</p>
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
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  },
  title: { fontSize: '20px', color: '#1a1a2e', marginBottom: '12px' },
  info: { fontSize: '14px', color: '#666', marginBottom: '20px', lineHeight: '1.5' },
  button: {
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  progress: { fontSize: '15px', fontWeight: 'bold', color: '#1a1a2e' },
  logBox: { background: '#f9f9f9', borderRadius: '10px', padding: '14px', marginTop: '10px', maxHeight: '300px', overflowY: 'auto' },
  logLine: { fontSize: '13px', color: '#333', margin: '4px 0' },
  success: { fontSize: '15px', color: '#2e7d32', fontWeight: 'bold', marginTop: '14px' },
};