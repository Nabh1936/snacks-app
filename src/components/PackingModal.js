import React, { useState } from 'react';

export default function PackingModal({ product, config, onConfirm, onClose }) {
  const [selected, setSelected] = useState(config.options[0]?.id);
  if (!product) return null;
  const unitLabel = config.chargeMode === 'perLine' ? 'per order line' : `per ${product.unit || 'piece'}`;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()}>
        <p style={styles.title}>Choose packing</p>
        <p style={styles.sub}>{product.name}</p>
        {config.options.map(opt => (
          <div
            key={opt.id}
            style={{ ...styles.option, ...(selected === opt.id ? styles.optionActive : {}) }}
            onClick={() => setSelected(opt.id)}
          >
            <div style={styles.radioOuter}>{selected === opt.id && <div style={styles.radioInner} />}</div>
            <span style={{ flex: 1 }}>{opt.label}</span>
            <span style={styles.charge}>
              {opt.charge > 0 ? `+₹${opt.charge} ${unitLabel}` : 'No extra charge'}
            </span>
          </div>
        ))}
        <div style={styles.actions}>
          <button style={styles.cancel} onClick={onClose}>Cancel</button>
          <button
            style={styles.confirm}
            onClick={() => {
              const opt = config.options.find(o => o.id === selected);
              if (opt) onConfirm(opt);
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 },
  sheet: { background: 'white', width: '100%', maxWidth: '480px', borderRadius: '18px 18px 0 0', padding: '20px 18px 24px', boxSizing: 'border-box' },
  title: { margin: 0, fontWeight: 'bold', fontSize: '18px', color: '#6E1F21' },
  sub: { margin: '4px 0 14px', color: '#777', fontSize: '13px' },
  option: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', border: '2px solid #eee', borderRadius: '12px', marginBottom: '10px', cursor: 'pointer', fontSize: '15px' },
  optionActive: { borderColor: '#B02D2F', background: '#FDF4F4' },
  radioOuter: { width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #B02D2F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioInner: { width: '10px', height: '10px', borderRadius: '50%', background: '#B02D2F' },
  charge: { fontSize: '12px', color: '#6E1F21', fontWeight: 'bold' },
  actions: { display: 'flex', gap: '10px', marginTop: '8px' },
  cancel: { flex: 1, padding: '14px', border: '1px solid #ddd', background: 'white', borderRadius: '12px', fontSize: '15px', cursor: 'pointer' },
  confirm: { flex: 2, padding: '14px', border: 'none', background: 'linear-gradient(135deg, #B02D2F 0%, #7A1F21 100%)', color: 'white', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' },
};
