// constants.js — app-wide constants for Flat Tracker

const APP_NAME    = 'Flat Tracker';
const APP_VERSION = '0.1.0';

// ── Navigation tabs ──────────────────────────────────────────────────
const TABS = [
  { id: 'feed',      label: 'Feed',      icon: '🏠' },
  { id: 'watchlist', label: 'Watchlist', icon: '📍' },
  { id: 'hunter',    label: 'Hunter',    icon: '🤖' },
  { id: 'areas',     label: 'Areas',     icon: '🗺️' },
];

// ── Hunter AI — system prompt ────────────────────────────────────────
const HUNTER_SYSTEM_PROMPT = `You are Hunter, an expert AI assistant for apartment hunting in Sweden.
You help users understand property markets, price trends, area characteristics,
and street-level insights. You are concise, friendly, and data-driven.
When discussing prices, always use SEK. When discussing areas, be specific
and practical. If you don't have specific data, say so clearly and offer
general guidance instead.`;

// ── Firestore collection names ───────────────────────────────────────
const COLLECTIONS = {
  USERS:     'users',
  WATCHLIST: 'watchlist',
  LISTINGS:  'listings',
  AREAS:     'areas',
};

// ── Placeholder listings (used before real data source is connected) ─
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

// ── Placeholder areas ────────────────────────────────────────────────
const MOCK_AREAS = [
  {
    id: 'area-1',
    name: 'Centrum',
    city: 'Malmö',
    avgPricePerSqm: 48000,
    popularity: 'High',
    traits: ['Central', 'Vibrant', 'Walkable'],
    streets: ['Drottninggatan', 'Södergatan', 'Stortorget'],
  },
  {
    id: 'area-2',
    name: 'Möllevången',
    city: 'Malmö',
    avgPricePerSqm: 38000,
    popularity: 'High',
    traits: ['Multicultural', 'Trendy', 'Affordable'],
    streets: ['Möllevångstorget', 'Nobelvägen', 'Amiralsgatan'],
  },
  {
    id: 'area-3',
    name: 'Limhamn',
    city: 'Malmö',
    avgPricePerSqm: 42000,
    popularity: 'Medium',
    traits: ['Family-friendly', 'Seaside', 'Quiet'],
    streets: ['Limhamnsvägen', 'Strandgatan', 'Hamnvägen'],
  },
];
