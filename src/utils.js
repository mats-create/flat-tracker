// utils.js — hjälpfunktioner för Flat Tracker

// ── Formatera pris i SEK ─────────────────────────────────────────────
function formatPrice(sek) {
  if (!sek) return '—';
  if (sek >= 1000000) return (sek / 1000000).toFixed(1).replace('.', ',') + ' mkr';
  return sek.toLocaleString('sv-SE') + ' kr';
}

// ── Relativ tid (t.ex. "5 min sedan") ───────────────────────────────
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60)   return 'Just nu';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min sedan';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' tim sedan';
  return Math.floor(seconds / 86400) + ' d sedan';
}

// ── Kvadratmeter ─────────────────────────────────────────────────────
function formatSqm(sqm) {
  return sqm ? sqm + ' m²' : '—';
}

// ── Månadsavgift ─────────────────────────────────────────────────────
function formatRent(kr) {
  return kr ? kr.toLocaleString('sv-SE') + ' kr/mån' : '—';
}

// ── Antal rum ────────────────────────────────────────────────────────
function roomLabel(n) {
  if (!n) return '—';
  return n === 1 ? '1 rum' : n + ' rum';
}

// ── Trunkera text ────────────────────────────────────────────────────
function truncate(str, max = 40) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

// ── Generera lokalt ID ───────────────────────────────────────────────
function localId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Generera inbjudningskod (6 tecken) ───────────────────────────────
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
