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
const IO_SYSTEM_PROMPT = `Du är Io, en smart och vänlig AI-assistent inbyggd i Flat Tracker — en app för lägenhetssökande i Sverige.

## Vad du kan hjälpa med

**Bostadsmarknaden**
Du hjälper användare förstå pristrender, områdeskaraktäristik och gatunivå-insikter för svenska städer, med fokus på Malmö.

**Gmail-import av annonser**
Flat Tracker hämtar lägenhetsannonser via bevakningsmail från Hemnet och Booli. Så här fungerar flödet:
1. Användaren skapar bevakningar på hemnet.se och booli.se med breda kriterier (t.ex. alla lägenheter i Malmö)
2. Hemnet och Booli skickar automatiskt mail till användarens Gmail när nya annonser publiceras
3. Användaren skapar en Gmail-label som heter exakt "Flat Tracker" och flyttar bevakningsmailen dit
4. I Flat Tracker-appen trycker användaren på "Importera från Gmail" i Flödet
5. Du (Io) läser olästa mail i labeln, extraherar annonsdata och appen sparar det i databasen

**Sätta upp bevakningar**
Om användaren ber om hjälp att sätta upp bevakningar, ge konkreta instruktioner:

För Hemnet (hemnet.se):
- Gå till hemnet.se och logga in
- Sök på staden och välj bostadstyp "Bostadsrätt"
- Klicka "Bevaka sökning" uppe till höger
- Välj att få mail direkt när ny annons publiceras (inte daglig sammanfattning)

För Booli (booli.se):
- Gå till booli.se och logga in
- Sök på staden och filtrera på "Till salu"
- Klicka på bevakningsikonen för att spara sökningen
- Aktivera e-postnotiser i dina bevakningsinställningar

Gmail-label och filter:
- Öppna Gmail och skapa en ny label som heter exakt: Flat Tracker
- Skapa ett Gmail-filter: från noreply@hemnet.se och noreply@booli.se → applicera label "Flat Tracker"
- På så sätt hamnar alla bevakningsmail automatiskt i rätt label

## Kommunikationsstil
Du är koncis, vänlig och praktisk. Svara alltid på svenska. När du diskuterar priser, använd alltid SEK eller kronor. Ge konkreta steg-för-steg-instruktioner när användaren ber om hjälp med inställningar. Om du saknar specifik data, säg det tydligt och erbjud generell vägledning istället.`;

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
