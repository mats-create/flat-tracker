// screens.js — huvudskärmar för Flat Tracker

// ── Gmail-import: extrahera annonsdata via Claude API ────────────────
async function importFromGmail(anthropicKey, gmailLabel) {
  const label = gmailLabel || 'Flat Tracker';

  const prompt = `Du är en dataextraktor för lägenhetsannonser. Din uppgift är att läsa bevakningsmail från Hemnet och Booli i Gmail-labeln "${label}" och extrahera strukturerad annonsdata.

Instruktioner:
1. Sök efter olästa mail i Gmail-labeln "${label}" från avsändare som innehåller hemnet.se eller booli.se
2. För varje mail, extrahera alla lägenhetsannonser som nämns
3. Returnera ENBART ett JSON-objekt i detta exakta format, ingen annan text:

{
  "listings": [
    {
      "source": "hemnet" eller "booli",
      "externalId": "annonsens unika ID från URL:en",
      "url": "direktlänk till annonsen",
      "title": "adress eller rubrik",
      "street": "gatuadress",
      "area": "stadsdel eller område",
      "city": "stad",
      "price": pristal i kronor (bara siffror),
      "sqm": antal kvadratmeter (bara siffror),
      "rooms": antal rum (bara siffror),
      "monthlyFee": månadsavgift i kronor (bara siffror, 0 om okänt),
      "hasBalcony": true eller false,
      "hasElevator": true eller false,
      "isNewConstruction": true eller false,
      "imageUrl": "URL till bild om tillgänglig",
      "publishedAt": "ISO-datum om känt"
    }
  ],
  "emailsRead": antal mail som lästes,
  "message": "kort beskrivning av vad som hittades"
}

Om inga olästa mail finns i labeln, returnera: {"listings": [], "emailsRead": 0, "message": "Inga nya bevakningsmail hittades i labeln ${label}."}
Om labeln inte finns, returnera: {"listings": [], "emailsRead": 0, "message": "Gmail-labeln '${label}' hittades inte. Skapa den och flytta dina bevakningsmail dit."}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      mcp_servers: [
        {
          type: 'url',
          url: 'https://gmailmcp.googleapis.com/mcp/v1',
          name: 'gmail',
        }
      ],
      system: 'Du är en dataextraktor. Returnera ALLTID och ENBART giltig JSON, aldrig förklaringar eller markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API-fel ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '';

  // Rensa eventuell markdown-formattering
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error('Claude returnerade ogiltig JSON. Försök igen.');
  }
}

// ── Spara annonser till Firestore ────────────────────────────────────
async function saveListingsToFirestore(listings, householdId, profiles) {
  const { db, doc, getDoc, setDoc } = window.__firebase;

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

  const activeProfiles = (profiles || []).filter(p => p.active);
  let savedCount = 0;

  for (const listing of listings) {
    if (!listing.externalId || !listing.source) continue;
    const docId = `${listing.source}_${listing.externalId}`;
    const ref = doc(db, 'listings', docId);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;

    const matches = activeProfiles.length === 0 ||
      activeProfiles.some(p => matchesProfile(listing, p));

    await setDoc(ref, {
      ...listing,
      matchedHouseholds: matches ? [householdId] : [],
      createdAt: Date.now(),
      publishedAt: listing.publishedAt
        ? new Date(listing.publishedAt).getTime()
        : Date.now(),
    });
    savedCount++;
  }

  return savedCount;
}

// ── FlödesSkärm ──────────────────────────────────────────────────────
function FeedScreen({ user, householdId, household, profiles }) {
  const [listings,  setListings]  = React.useState([]);
  const [loading,   setLoading]   = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [error,     setError]     = React.useState(null);
  const [lastImport, setLastImport] = React.useState(null);
  const [importMsg,  setImportMsg]  = React.useState(null);
  const [filter,    setFilter]    = React.useState('alla');

  // ── Ladda annonser från Firestore ─────────────────────────────────
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
        setError('Kunde inte ladda annonser. Kontrollera att Firestore-index är skapat.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [householdId]);

  // ── Gmail-import ──────────────────────────────────────────────────
  async function handleGmailImport() {
    const anthropicKey = household?.anthropicKey;
    if (!anthropicKey) {
      setError('Anthropic API-nyckel saknas. Lägg till den i Inställningar.');
      return;
    }

    setImporting(true);
    setError(null);
    setImportMsg(null);

    try {
      const result = await importFromGmail(anthropicKey, 'Flat Tracker');
      setImportMsg(result.message);

      if (result.listings && result.listings.length > 0) {
        const saved = await saveListingsToFirestore(
          result.listings, householdId, profiles || []
        );
        setImportMsg(
          saved > 0
            ? `✓ Importerade ${saved} nya annonser från ${result.emailsRead} mail.`
            : `${result.emailsRead} mail lästa — alla annonser var redan sparade.`
        );
      }
      setLastImport(new Date());
    } catch (e) {
      console.error('Gmail-importfel:', e);
      setError(`Import misslyckades: ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  const oneDayAgo   = Date.now() - 24 * 60 * 60 * 1000;
  const newListings = listings.filter(l => (l.createdAt || 0) > oneDayAgo);
  const shown       = filter === 'nya' ? newListings : listings;

  if (loading) return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 40, gap: 12 }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Laddar annonser…</p>
      </div>
    </div>
  );

  return (
    <div className="screen">

      {/* ── Import-rad ──────────────────────────────────────────────── */}
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {lastImport
            ? `Senaste import ${lastImport.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
            : listings.length > 0
              ? `${listings.length} annonser`
              : 'Inga annonser ännu'}
        </div>
        <button
          className="btn btn--primary"
          onClick={handleGmailImport}
          disabled={importing}
          style={{ fontSize: 13, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          {importing
            ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Importerar…</>
            : '✉ Importera från Gmail'}
        </button>
      </div>

      {/* ── Statusmeddelande ────────────────────────────────────────── */}
      {importMsg && (
        <div style={{
          fontSize: 13, marginBottom: 12, padding: '8px 12px',
          background: importMsg.startsWith('✓') ? 'var(--surface-success, #e8f5e9)' : 'var(--surface-2)',
          color: importMsg.startsWith('✓') ? 'var(--success, #2e7d32)' : 'var(--text-secondary)',
          borderRadius: 'var(--radius)',
        }}>
          {importMsg}
        </div>
      )}

      {/* ── Felmeddelande ───────────────────────────────────────────── */}
      {error && (
        <div style={{
          fontSize: 13, marginBottom: 12, padding: '8px 12px',
          background: 'var(--surface-2)', color: 'var(--error)',
          borderRadius: 'var(--radius)',
        }}>
          {error}
        </div>
      )}

      {/* ── Onboarding om inga annonser ─────────────────────────────── */}
      {listings.length === 0 && !importing && (
        <Card style={{ marginBottom: 16, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
            🚀 Kom igång med annonshämtning
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ marginBottom: 6 }}>
              <strong>1.</strong> Sätt upp bevakningar på <a href="https://hemnet.se" target="_blank"
                rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>hemnet.se</a> och <a
                href="https://booli.se" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--primary)' }}>booli.se</a>
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>2.</strong> Skapa en Gmail-label som heter <strong>Flat Tracker</strong>
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>3.</strong> Skapa Gmail-filter: mail från hemnet/booli → label Flat Tracker
            </div>
            <div>
              <strong>4.</strong> Tryck <strong>Importera från Gmail</strong> ovan
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 10 }}>
            💡 Fråga Io om hjälp med att sätta upp bevakningar och Gmail-filter
          </div>
        </Card>
      )}

      {/* ── Filter ──────────────────────────────────────────────────── */}
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

      {/* ── Annonsflöde ─────────────────────────────────────────────── */}
      {shown.length === 0 && listings.length > 0 ? (
        <EmptyState icon="✓" title="Inga nya annonser" text="Alla annonser är äldre än 24 timmar." />
      ) : (
        shown.map(l => <ListingCard key={l.id} listing={l} />)
      )}
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
