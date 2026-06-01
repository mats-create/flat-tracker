// screens.js — huvudskärmar för Flat Tracker

// ── Hjälpfunktion: anropa Apify och hämta annonser ──────────────────
async function fetchFromApify(apiToken, location) {
  const HEMNET_ACTOR = 'lexis-solutions~hemnet-se-scraper';
  const BOOLI_ACTOR  = 'lexis-solutions~booli-se-scraper';

  async function runActor(actorId, input) {
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs?waitForFinish=120`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
          body: JSON.stringify(input),
        }
      );
      if (!runRes.ok) throw new Error(`Apify-fel: ${runRes.status}`);
      const runData = await runRes.json();
      const datasetId = runData.data.defaultDatasetId;

      const dataRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&limit=200`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      if (!dataRes.ok) throw new Error(`Dataset-fel: ${dataRes.status}`);
      return await dataRes.json();
    } catch (e) {
      console.error(`Fel vid körning av ${actorId}:`, e.message);
      return [];
    }
  }

  function normalizeHemnet(raw) {
    try {
      return {
        source: 'hemnet',
        externalId: String(raw.id || raw.listingId || ''),
        url: raw.url || raw.listingUrl || '',
        title: raw.streetAddress || raw.title || '',
        street: raw.streetAddress || '',
        area: raw.area || raw.district || '',
        city: raw.municipality || raw.city || '',
        price: Number(raw.askingPrice || raw.listPrice || raw.price || 0),
        sqm: Number(raw.livingArea || raw.sqm || 0),
        rooms: Number(raw.numberOfRooms || raw.rooms || 0),
        floor: raw.floor != null ? Number(raw.floor) : null,
        isGroundFloor: raw.floor === 0 || raw.floor === 1 || false,
        hasBalcony: Boolean(raw.hasBalcony || raw.balcony || false),
        hasElevator: Boolean(raw.hasElevator || raw.elevator || false),
        isNewConstruction: Boolean(raw.isNewConstruction || false),
        monthlyFee: Number(raw.monthlyFee || raw.avgift || 0),
        imageUrl: raw.imageUrl || raw.image || raw.thumbnail || '',
        publishedAt: raw.publishedAt ? new Date(raw.publishedAt).getTime() : Date.now(),
        createdAt: Date.now(),
      };
    } catch (e) { return null; }
  }

  function normalizeBooli(raw) {
    try {
      return {
        source: 'booli',
        externalId: String(raw.booliId || raw.id || ''),
        url: raw.url || '',
        title: raw.streetAddress || raw.location?.address?.streetAddress || raw.title || '',
        street: raw.streetAddress || raw.location?.address?.streetAddress || '',
        area: raw.area || raw.location?.region?.municipalityName || '',
        city: raw.municipality || raw.location?.region?.municipalityName || '',
        price: Number(raw.listPrice || raw.price || 0),
        sqm: Number(raw.livingArea || raw.sqm || 0),
        rooms: Number(raw.rooms || raw.numberOfRooms || 0),
        floor: raw.floor != null ? Number(raw.floor) : null,
        isGroundFloor: raw.floor === 0 || raw.floor === 1 || false,
        hasBalcony: Boolean(raw.balcony || raw.hasBalcony || false),
        hasElevator: Boolean(raw.elevator || raw.hasElevator || false),
        isNewConstruction: Boolean(raw.isNewConstruction || false),
        monthlyFee: Number(raw.rent || raw.monthlyFee || 0),
        imageUrl: raw.thumbnail?.path || raw.imageUrl || '',
        publishedAt: raw.published ? new Date(raw.published).getTime() : Date.now(),
        createdAt: Date.now(),
      };
    } catch (e) { return null; }
  }

  const [hemnetRaw, booliRaw] = await Promise.all([
    runActor(HEMNET_ACTOR, { searchQuery: location, propertyTypes: ['bostadsrätt'], maxItems: 100 }),
    runActor(BOOLI_ACTOR,  { searchQuery: location, objectType: 'bostadsrätt', maxItems: 100 }),
  ]);

  return [
    ...hemnetRaw.map(normalizeHemnet).filter(Boolean),
    ...booliRaw.map(normalizeBooli).filter(Boolean),
  ];
}

// ── Hjälpfunktion: spara annonser till Firestore ─────────────────────
async function saveListingsToFirestore(listings, householdId, profiles) {
  const { db, doc, getDoc, setDoc, collection } = window.__firebase;

  function matchesProfile(listing, profile) {
    if (profile.priceMin  && listing.price < Number(profile.priceMin))  return false;
    if (profile.priceMax  && listing.price > Number(profile.priceMax))  return false;
    if (profile.sqmMin    && listing.sqm   < Number(profile.sqmMin))    return false;
    if (profile.sqmMax    && listing.sqm   > Number(profile.sqmMax))    return false;
    if (profile.roomsMin  && listing.rooms < Number(profile.roomsMin))  return false;
    if (profile.roomsMax  && listing.rooms > Number(profile.roomsMax))  return false;
    if (profile.noGroundFloor    && listing.isGroundFloor)  return false;
    if (profile.balconyRequired  && !listing.hasBalcony)    return false;
    if (profile.elevatorRequired && !listing.hasElevator)   return false;
    if (profile.newConstruction  && !listing.isNewConstruction) return false;
    return true;
  }

  const activeProfiles = profiles.filter(p => p.active);
  let savedCount = 0;

  for (const listing of listings) {
    if (!listing.externalId || !listing.source) continue;
    const docId = `${listing.source}_${listing.externalId}`;
    const ref = doc(db, 'listings', docId);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;

    const matches = activeProfiles.some(p => matchesProfile(listing, p));
    listing.matchedHouseholds = matches ? [householdId] : [];

    await setDoc(ref, listing);
    savedCount++;
  }

  return savedCount;
}

// ── FlödesSkärm ──────────────────────────────────────────────────────
function FeedScreen({ user, householdId, household, profiles }) {
  const [listings,  setListings]  = React.useState([]);
  const [loading,   setLoading]   = React.useState(true);
  const [fetching,  setFetching]  = React.useState(false);
  const [error,     setError]     = React.useState(null);
  const [filter,    setFilter]    = React.useState('alla');
  const [lastFetch, setLastFetch] = React.useState(null);

  // ── Ladda annonser från Firestore ────────────────────────────────
  React.useEffect(() => {
    if (!householdId) return;
    const { db, collection, query, where, orderBy, limit, onSnapshot } = window.__firebase;

    const q = query(
      collection(db, 'listings'),
      where('matchedHouseholds', 'array-contains', householdId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsub = onSnapshot(q,
      snap => {
        setListings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => {
        console.error('Firestore-fel:', err);
        setError('Kunde inte ladda annonser.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [householdId]);

  // ── Hämta nya annonser från Apify ────────────────────────────────
  async function handleFetch() {
    const apifyKey = household?.apifyKey;
    if (!apifyKey) {
      setError('Apify-nyckel saknas. Lägg till den i inställningarna.');
      return;
    }

    setFetching(true);
    setError(null);

    try {
      const raw = await fetchFromApify(apifyKey, 'Malmö');
      const saved = await saveListingsToFirestore(raw, householdId, profiles || []);
      setLastFetch(new Date());
      if (saved === 0 && raw.length > 0) {
        setError(null); // alla var redan sparade — inget fel
      }
    } catch (e) {
      console.error('Fel vid hämtning:', e);
      setError('Hämtning misslyckades. Försök igen.');
    } finally {
      setFetching(false);
    }
  }

  const oneDayAgo    = Date.now() - 24 * 60 * 60 * 1000;
  const newListings  = listings.filter(l => (l.createdAt || 0) > oneDayAgo);
  const shown        = filter === 'nya' ? newListings : listings;

  if (loading) return (
    <div className="screen">
      <div className="feed-loading">
        <div className="spinner" />
        <p>Laddar annonser…</p>
      </div>
    </div>
  );

  return (
    <div className="screen">

      {/* Hämta-knapp och status */}
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {lastFetch
            ? `Uppdaterad ${lastFetch.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
            : listings.length > 0 ? `${listings.length} annonser` : 'Inga annonser ännu'}
        </div>
        <button
          className="btn btn--primary"
          onClick={handleFetch}
          disabled={fetching}
          style={{ fontSize: 13, padding: '6px 14px' }}>
          {fetching ? 'Hämtar…' : '↓ Hämta annonser'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12,
          padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
          {error}
        </div>
      )}

      {/* Filter */}
      {listings.length > 0 && (
        <div className="flex gap-8" style={{ marginBottom: 16 }}>
          <button
            className={`chip ${filter === 'alla' ? 'chip--primary' : ''}`}
            onClick={() => setFilter('alla')}>
            Alla ({listings.length})
          </button>
          <button
            className={`chip ${filter === 'nya' ? 'chip--primary' : ''}`}
            onClick={() => setFilter('nya')}>
            Nya ({newListings.length})
          </button>
        </div>
      )}

      {/* Annonsflöde */}
      {shown.length === 0
        ? (
          <EmptyState
            icon="🏠"
            title="Inga annonser ännu"
            text="Tryck på Hämta annonser för att söka efter matchande lägenheter. Du behöver en Apify-nyckel i inställningarna."
          />
        )
        : shown.map(l => <ListingCard key={l.id} listing={l} />)
      }
    </div>
  );
}

// ── OmrådesSkärm ─────────────────────────────────────────────────────
function AreasScreen({ user, householdId }) {
  return (
    <div className="screen">
      <EmptyState
        icon="🗺️"
        title="Områden"
        text="Hantering av bevakade områden och gator kommer i nästa sprint."
      />
    </div>
  );
}
