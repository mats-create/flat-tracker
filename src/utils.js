// utils.js — pure helper functions for Flat Tracker

// ── Format price in SEK ──────────────────────────────────────────────
function formatPrice(sek) {
  if (!sek) return '—';
  if (sek >= 1000000) return (sek / 1000000).toFixed(1).replace('.', ',') + ' mkr';
  return sek.toLocaleString('sv-SE') + ' kr';
}

// ── Format relative time (e.g. "5 min ago") ─────────────────────────
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60)  return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' h ago';
  return Math.floor(seconds / 86400) + ' d ago';
}

// ── Format sqm ───────────────────────────────────────────────────────
function formatSqm(sqm) {
  return sqm ? sqm + ' m²' : '—';
}

// ── Format rent ──────────────────────────────────────────────────────
function formatRent(kr) {
  return kr ? kr.toLocaleString('sv-SE') + ' kr/mo' : '—';
}

// ── Pluralise rooms ──────────────────────────────────────────────────
function roomLabel(n) {
  if (!n) return '—';
  return n === 1 ? '1 room' : n + ' rooms';
}

// ── Truncate text ────────────────────────────────────────────────────
function truncate(str, max = 40) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

// ── Generate a simple local ID ───────────────────────────────────────
function localId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
