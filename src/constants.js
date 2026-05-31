// constants.js — app-wide constants for Flat Tracker

const APP_NAME     = 'Flat Tracker';
const APP_VERSION  = '0.2.0';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// ── Navigeringsflikar ────────────────────────────────────────────────
const TABS = [
  { id: 'feed',      label: 'Flöde',     icon: '🏠' },
  { id: 'watchlist', label: 'Bevakning', icon: '📍' },
  { id: 'areas',     label: 'Områden',   icon: '🗺️' },
];

// ── Io AI — systemprompt ─────────────────────────────────────────────
const IO_SYSTEM_PROMPT = `Du är Io, en smart och vänlig AI-assistent för lägenhetssökande i Sverige.
Du hjälper användare att förstå bostadsmarknaden, pristrender, områdeskaraktäristik
och gatunivå-insikter. Du är koncis, vänlig och datadriven.
Svara alltid på svenska. När du diskuterar priser, använd alltid SEK eller kronor.
När du diskuterar områden, var specifik och praktisk.
Om du saknar specifik data, säg det tydligt och erbjud generell vägledning istället.`;

// ── Firestore-samlingar ──────────────────────────────────────────────
const COLLECTIONS = {
  USERS:      'users',
  HOUSEHOLDS: 'households',
  LISTINGS:   'listings',
  AREAS:      'areas',
};

// ── Testdata — lägenheter ────────────────────────────────────────────
const MOCK_LISTINGS = [
  {
    id: 'mock-1',
    street: 'Drottninggatan 42',
    area: 'Centrum',
    rooms: 2,
    sqm: 58,
    price: 2850000,
    rent: 3200,
    published: new Date(Date.now() - 1000 * 60 * 12),
    isNew: true,
    url: '#',
  },
  {
    id: 'mock-2',
    street: 'Storgatan 18',
    area: 'Möllevången',
    rooms: 3,
    sqm: 74,
    price: 3450000,
    rent: 4100,
    published: new Date(Date.now() - 1000 * 60 * 45),
    isNew: true,
    url: '#',
  },
  {
    id: 'mock-3',
    street: 'Bergsgatan 7',
    area: 'Söder',
    rooms: 1,
    sqm: 34,
    price: 1650000,
    rent: 2400,
    published: new Date(Date.now() - 1000 * 60 * 120),
    isNew: false,
    url: '#',
  },
];

// ── Testdata — områden ───────────────────────────────────────────────
const MOCK_AREAS = [
  {
    id: 'area-1',
    name: 'Centrum',
    city: 'Malmö',
    avgPricePerSqm: 48000,
    popularity: 'Hög',
    traits: ['Centralt', 'Levande', 'Gångvänligt'],
    streets: ['Drottninggatan', 'Södergatan', 'Stortorget'],
  },
  {
    id: 'area-2',
    name: 'Möllevången',
    city: 'Malmö',
    avgPricePerSqm: 38000,
    popularity: 'Hög',
    traits: ['Mångkulturellt', 'Trendigt', 'Prisvärt'],
    streets: ['Möllevångstorget', 'Nobelvägen', 'Amiralsgatan'],
  },
  {
    id: 'area-3',
    name: 'Limhamn',
    city: 'Malmö',
    avgPricePerSqm: 42000,
    popularity: 'Medel',
    traits: ['Familjevänligt', 'Havsnära', 'Lugnt'],
    streets: ['Limhamnsvägen', 'Strandgatan', 'Hamnvägen'],
  },
];
