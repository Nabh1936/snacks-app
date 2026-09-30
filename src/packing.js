import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Packing settings live in Firestore at settings/packing and are edited
// from the Admin Dashboard → Packing tab. These defaults are only used
// until the admin saves real values.
export const DEFAULT_PACKING = {
  options: [
    { id: 'tray', label: 'Tray packing', charge: 0 },
    { id: 'aluminium', label: 'Aluminium packing', charge: 0 },
    { id: 'inhouse', label: 'In-house packing', charge: 0 },
  ],
  chargeMode: 'perPiece', // 'perPiece' | 'perLine'
  gstRate: 0,
};

const CACHE_KEY = 'mdPackingConfig';

export function normalizePacking(data) {
  const d = data || {};
  const options = Array.isArray(d.options) && d.options.length ? d.options : DEFAULT_PACKING.options;
  return {
    options: options.map(o => ({ id: String(o.id), label: String(o.label), charge: Number(o.charge) || 0 })),
    chargeMode: d.chargeMode === 'perLine' ? 'perLine' : 'perPiece',
    gstRate: Number(d.gstRate) || 0,
  };
}

export function getCachedPacking() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c) return normalizePacking(c);
  } catch (e) {}
  return normalizePacking(null);
}

export async function fetchPacking() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'packing'));
    const cfg = normalizePacking(snap.exists() ? snap.data() : null);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) {}
    return cfg;
  } catch (e) {
    return getCachedPacking();
  }
}

export const lineKey = (item) => `${item.id}|${item.packing?.id || ''}`;

export function linePackingCharge(item, cfg) {
  if (!item.packing) return 0;
  const opt = cfg.options.find(o => o.id === item.packing.id);
  const charge = opt ? opt.charge : Number(item.packing.charge) || 0;
  return cfg.chargeMode === 'perLine' ? charge : charge * item.qty;
}

export function cartTotals(cart, cfg) {
  let subtotal = 0, packingTotal = 0, gst = 0;
  for (const c of cart) {
    const line = c.price * c.qty;
    const pack = linePackingCharge(c, cfg);
    subtotal += line;
    packingTotal += pack;
    gst += Math.round(line * (c.gst || 0) / 100) + Math.round(pack * cfg.gstRate / 100);
  }
  return { subtotal, packingTotal, gst, grandTotal: subtotal + packingTotal + gst };
}
