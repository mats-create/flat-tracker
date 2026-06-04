// screens.js — huvudskärmar för Flat Tracker
// Version: 2026-06-04 14:30 CET
// Ändringar: berikningslogik — useEffect lyssnar på listings, enrichFailedAt separerar misslyckanden från lyckade

// ── Hjälpfunktion: Io-analys av en annons ───────────────────────────
async function fetchIoAnalysis(listing, anthropicKey) {
  const prompt = 'Analysera den här bostadsannonsen kort och koncist (max 4-5 meningar). ' +
    'Ta upp: läge och område, pris per kvm jämfört med Malmö-snittet, vad som sticker ut (positivt/negativt), ' +
    'och en kortfattad rekommendation.\n\n' +
    'Annons:\n' +
    'Adress: ' + (listing.street || '') + '\n' +
    'Område: ' + (listing.area || '') + ', ' + (listing.city || '') + '\n' +
    'Pris: ' + (listing.price ? formatPrice(listing.price) : 'okänt') + '\n' +
    'Storlek: ' + (listing.sqm ? formatSqm(listing.sqm) : 'okänt') + '\n' +
    'Rum: ' + (listing.rooms ? roomLabel(listing.rooms) : 'okänt') + '\n' +
    'Månadsavgift: ' + (listing.monthlyFee ? formatRent(listing.monthlyFee) : 'okänd') + '\n' +
    'Balkong: ' + (listing.hasBalcony ? 'Ja' : 'Nej') + '\n' +
    'Hiss: ' + (listing.hasElevator ? 'Ja' : 'Nej') + '\n' +
    'Mäklare: ' + (listing.agencyName || 'okänd') + '\n' +
    'Källa: ' + (listing.source || '');

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
      max_tokens: 300,
      system: IO_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error('API-fel ' + res.status);
  const data = await res.json();
  return (data.content && data.content.find(b => b.type === 'text') || {}).text || '';
}

// ── ListingCard med bevakning och Io-analys ──────────────────────────
function ListingCard({ listing, householdId, anthropicKey, watched, onToggleWatch, enriching }) {
  const [expanded, setExpanded]       = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [analysis, setAnalysis]       = React.useState(null);
  const [analyzing, setAnalyzing]     = React.useState(false);
  const [analysisErr, setAnalysisErr] = React.useState(null);

  const {
    street, area, city, rooms, sqm, price,
    monthlyFee, operatingCost, createdAt, url, source,
    agentName, agencyName, agentEmail, agentPhone,
    brokerListingUrl, description, builtYear, floor,
    energyClass, propertyDesignation, viewings,
  } = listing;

  const oneDayAgo   = Date.now() - 24 * 60 * 60 * 1000;
  const isNew       = (createdAt || 0) > oneDayAgo;
  // Konvertera till tal för att undvika "/mån/mån"-bug
  const fee         = monthlyFee ? parseInt(monthlyFee) : 0;
  const opCost      = operatingCost ? parseInt(operatingCost) : 0;
  const pricePerSqm = price && sqm ? Math.round(price / sqm) : null;

  async function handleToggleWatch() {
    onToggleWatch(listing.id, !watched);
    if (!watched && !analysis) await runAnalysis();
  }

  async function runAnalysis() {
    if (!anthropicKey) { setAnalysisErr('API-nyckel saknas.'); return; }
    setAnalyzing(true);
    setAnalysisErr(null);
    setExpanded(true);
    try {
      const text = await fetchIoAnalysis(listing, anthropicKey);
      setAnalysis(text);
    } catch (e) {
      setAnalysisErr('Kunde inte hämta analys: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className={'listing-card' + (watched ? ' listing-card--watched' : '') + (isNew ? ' listing-card--new' : '')}>

      {/* ── Huvud ── */}
      <div className="listing-card__header">
        <div className="listing-card__title-group">
          <div className="listing-card__address">
            {url
              ? <a href={url} target="_blank" rel="noopener noreferrer"
                  className="listing-card__address-link">{street || '—'}</a>
              : <span>{street || '—'}</span>}
          </div>
          <div className="listing-card__meta">{[area, city].filter(Boolean).join(', ') || '—'}</div>
        </div>
        <div className="listing-card__badges">
          {isNew && <span className="badge badge--new">NY</span>}
          {watched && <span className="badge badge--watched">⭐</span>}
          {enriching
            ? <span className="badge badge--enriching">⟳</span>
            : listing.enriched === true
            ? <span className="badge badge--full" title="Fullständig data">✓</span>
            : <span className="badge badge--basic" title="Grunddata">○</span>
          }
          {source && <span className={'badge badge--source badge--' + source}>{source.toUpperCase()}</span>}
        </div>
      </div>

      {/* ── Nyckeltal ── */}
      <div className="listing-card__stats">
        {rooms > 0 && <span className="stat">{roomLabel(rooms)}</span>}
        {sqm > 0 && <span className="stat">{formatSqm(sqm)}</span>}
        {price > 0 && <span className="stat stat--price">{formatPrice(price)}</span>}
        {pricePerSqm && <span className="stat stat--muted">{formatPrice(pricePerSqm)}/m²</span>}
      </div>

      {/* ── Detaljer ── */}
      <div className="listing-card__details">
        {fee > 0 && (
          <span className="listing-card__detail">
            <span className="listing-card__detail-label">Avgift</span>
            <span>{formatPrice(fee)} kr/mån</span>
          </span>
        )}
        {agencyName && (
          <span className="listing-card__detail">
            <span className="listing-card__detail-label">Mäklare</span>
            {brokerListingUrl
              ? <a href={brokerListingUrl} target="_blank" rel="noopener noreferrer" className="listing-card__link">{agencyName}</a>
              : <span>{agencyName}</span>}
          </span>
        )}
        {agentName && (
          <span className="listing-card__detail">
            <span className="listing-card__detail-label">Ansvarig</span>
            {agentEmail
              ? <a href={'mailto:' + agentEmail} className="listing-card__link">{agentName}</a>
              : agentPhone
              ? <a href={'tel:' + agentPhone} className="listing-card__link">{agentName}</a>
              : <span>{agentName}</span>}
          </span>
        )}
        {createdAt && (
          <span className="listing-card__detail">
            <span className="listing-card__detail-label">Inkom</span>
            <span>{timeAgo(createdAt)}</span>
          </span>
        )}
      </div>

      {/* ── Visningstider — alltid synliga om de finns ── */}
      {viewings && viewings.length > 0 && (
        <div className="listing-card__viewings">
          <span className="listing-card__detail-label">Visning</span>
          <div className="listing-card__viewings-list">
            {viewings.map(function(v, i) {
              return (
                <span key={i} className="listing-card__viewing-item">
                  {v.dayOfWeek ? v.dayOfWeek + ' ' : ''}{v.date || ''}{v.time ? ' kl. ' + v.time : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Åtgärder ── */}
      <div className="listing-card__actions">
        {listing.enriched === true && (
          <button
            className="btn-details"
            onClick={function() { setDetailsOpen(function(v) { return !v; }); }}>
            Mer info {detailsOpen ? '▲' : '▼'}
          </button>
        )}
        <button
          className={'btn-watch' + (watched ? ' btn-watch--active' : '')}
          onClick={handleToggleWatch}
          title={watched ? 'Sluta bevaka' : 'Bevaka'}>
          {watched ? '⭐ Bevakas' : '☆ Bevaka'}
        </button>
        {watched && (
          <button
            className="btn-analyze"
            onClick={function() {
              if (!analysis && !analyzing) runAnalysis();
              else setExpanded(function(v) { return !v; });
            }}>
            Io-analys {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {/* ── Mer info — expanderbar ── */}
      {detailsOpen && (
        <div className="listing-card__details-expanded">
          {description && (
            <div className="listing-card__detail-block">
              <div className="listing-card__detail-label">Beskrivning</div>
              <div className="listing-card__detail-text">{description}</div>
            </div>
          )}
          <div className="listing-card__detail-grid">
            {builtYear && (
              <span className="listing-card__detail">
                <span className="listing-card__detail-label">Byggår</span>
                <span>{builtYear}</span>
              </span>
            )}
            {floor && (
              <span className="listing-card__detail">
                <span className="listing-card__detail-label">Våning</span>
                <span>{floor}</span>
              </span>
            )}
            {energyClass && (
              <span className="listing-card__detail">
                <span className="listing-card__detail-label">Energiklass</span>
                <span>{energyClass}</span>
              </span>
            )}
            {opCost > 0 && (
              <span className="listing-card__detail">
                <span className="listing-card__detail-label">Driftskostnad</span>
                <span>{formatPrice(opCost)} kr/år</span>
              </span>
            )}
            {propertyDesignation && (
              <span className="listing-card__detail">
                <span className="listing-card__detail-label">Fastighet</span>
                <span>{propertyDesignation}</span>
              </span>
            )}
            {agentPhone && (
              <span className="listing-card__detail">
                <span className="listing-card__detail-label">Telefon</span>
                <a href={'tel:' + agentPhone} className="listing-card__link">{agentPhone}</a>
              </span>
            )}
            {agentEmail && (
              <span className="listing-card__detail">
                <span className="listing-card__detail-label">E-post</span>
                <a href={'mailto:' + agentEmail} className="listing-card__link">{agentEmail}</a>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Io-analys expanderbar ── */}
      {expanded && (
        <div className="listing-card__analysis">
          {analyzing && (
            <div className="listing-card__analysis-loading">
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span>Io analyserar…</span>
            </div>
          )}
          {analysisErr && <div className="listing-card__analysis-error">{analysisErr}</div>}
          {analysis && <div className="listing-card__analysis-text">{renderMarkdown(analysis)}</div>}
        </div>
      )}
    </div>
  );
}

// ── FlödesSkärm ──────────────────────────────────────────────────────
function FeedScreen({ user, householdId, household, profiles }) {
  const [listings,    setListings]    = React.useState([]);
  const [loading,     setLoading]     = React.useState(true);
  const [error,       setError]       = React.useState(null);
  const [watched,     setWatched]     = React.useState({});
  const [enrichingIds, setEnrichingIds] = React.useState(new Set());
  const [sortBy,      setSortBy]      = React.useState('createdAt');
  const [sortDir,     setSortDir]     = React.useState('desc');
  const [filterSource,  setFilterSource]  = React.useState('');
  const [filterAgency,  setFilterAgency]  = React.useState('');
  const [filterArea,    setFilterArea]    = React.useState('');
  const [filterStreet,  setFilterStreet]  = React.useState('');
  const [filterWatched, setFilterWatched] = React.useState(false);
  const [showFilters,   setShowFilters]   = React.useState(false);

  const anthropicKey = household && household.anthropicKey;

  // ── Ladda annonser ────────────────────────────────────────────────
  React.useEffect(function() {
    if (!householdId) return;
    var fb = window.__firebase;
    var q = fb.query(
      fb.collection(fb.db, 'listings'),
      fb.where('matchedHouseholds', 'array-contains', householdId),
      fb.orderBy('createdAt', 'desc'),
      fb.limit(200)
    );
    var unsub = fb.onSnapshot(q,
      function(snap) {
        setListings(snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }));
        setLoading(false);
      },
      function(err) {
        console.error('Firestore-fel:', err);
        setError('Kunde inte ladda annonser.');
        setLoading(false);
      }
    );
    return unsub;
  }, [householdId]);

  // ── Ladda bevakningar från Firestore ──────────────────────────────
  React.useEffect(function() {
    if (!householdId) return;
    var fb = window.__firebase;
    var ref = fb.doc(fb.db, 'households', householdId);
    var unsub = fb.onSnapshot(ref, function(snap) {
      if (snap.exists()) {
        setWatched(snap.data().watchedListings || {});
      }
    });
    return unsub;
  }, [householdId]);

  // ── Bakgrundsberikande ────────────────────────────────────────────
  const enrichingSentRef = React.useRef(new Set());

  React.useEffect(function() {
    if (loading || !listings.length) return;

    var MAX_ATTEMPTS = 3;
    var MIN_RETRY_INTERVAL = 60 * 60 * 1000;
    var twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    var now = Date.now();

    var toEnrich = listings.filter(function(l) {
      if (l.enriched === true) return false;
      if (enrichingSentRef.current.has(l.id)) return false;
      if ((l.createdAt || 0) < twoDaysAgo) return false;
      if (!l.url) return false;
      var attempts = l.enrichAttempts || 0;
      if (attempts >= MAX_ATTEMPTS) return false;
      var lastFailed = l.enrichFailedAt || 0;
      if (lastFailed > 0 && (now - lastFailed) < MIN_RETRY_INTERVAL) return false;
      return true;
    });

    if (toEnrich.length === 0) return;

    toEnrich.forEach(function(l) { enrichingSentRef.current.add(l.id); });

    console.log('Berikare ' + toEnrich.length + ' annonser i bakgrunden...');

    var cancelled = false;

    async function enrichSequentially() {
      var chunks = [];
      for (var i = 0; i < toEnrich.length; i += 3) {
        chunks.push(toEnrich.slice(i, i + 3));
      }

      for (var chunk of chunks) {
        if (cancelled) break;

        setEnrichingIds(function(prev) {
          var next = new Set(prev);
          chunk.forEach(function(l) { next.add(l.id); });
          return next;
        });

        await Promise.all(chunk.map(async function(listing) {
          try {
            await fetch(ENRICH_FUNCTION_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listingId: listing.id }),
            });
          } catch (err) {
            console.warn('Berikande misslyckades för ' + listing.id + ': ' + err.message);
          }
        }));

        setEnrichingIds(function(prev) {
          var next = new Set(prev);
          chunk.forEach(function(l) { next.delete(l.id); });
          return next;
        });

        if (!cancelled) await new Promise(function(r) { setTimeout(r, 500); });
      }
    }

    enrichSequentially();
    return function() { cancelled = true; };
  }, [listings]);


  async function handleToggleWatch(listingId, newVal) {
    var fb = window.__firebase;
    var ref = fb.doc(fb.db, 'households', householdId);
    var updated = Object.assign({}, watched, {});
    if (newVal) { updated[listingId] = true; }
    else { delete updated[listingId]; }
    setWatched(updated);
    await fb.updateDoc(ref, { watchedListings: updated });
  }

  // ── Sortering ─────────────────────────────────────────────────────
  function toggleSort(field) {
    if (sortBy === field) {
      setSortDir(function(d) { return d === 'asc' ? 'desc' : 'asc'; });
    } else {
      setSortBy(field);
      setSortDir(field === 'createdAt' ? 'desc' : 'asc');
    }
  }

  function sortIcon(field) {
    if (sortBy !== field) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  // ── Unika värden för filter ───────────────────────────────────────
  var sources  = Array.from(new Set(listings.map(function(l) { return l.source; }).filter(Boolean))).sort();
  var agencies = Array.from(new Set(listings.map(function(l) { return l.agencyName; }).filter(Boolean))).sort();
  var areas    = Array.from(new Set(listings.map(function(l) { return l.area; }).filter(Boolean))).sort();
  var streets  = Array.from(new Set(listings.map(function(l) { return l.street; }).filter(Boolean))).sort();

  // ── Filtrera ──────────────────────────────────────────────────────
  var filtered = listings.filter(function(l) {
    if (filterSource  && l.source     !== filterSource)  return false;
    if (filterAgency  && l.agencyName !== filterAgency)  return false;
    if (filterArea    && l.area       !== filterArea)     return false;
    if (filterStreet  && l.street     !== filterStreet)   return false;
    if (filterWatched && !watched[l.id])                  return false;
    return true;
  });

  // ── Sortera ───────────────────────────────────────────────────────
  var sorted = filtered.slice().sort(function(a, b) {
    var av = a[sortBy] || 0;
    var bv = b[sortBy] || 0;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  var oneDayAgo   = Date.now() - 24 * 60 * 60 * 1000;
  var newCount    = listings.filter(function(l) { return (l.createdAt || 0) > oneDayAgo; }).length;
  var watchCount  = Object.keys(watched).length;
  var activeFilters = [filterSource, filterAgency, filterArea, filterStreet, filterWatched].filter(Boolean).length;

  if (loading) return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Laddar annonser…</p>
      </div>
    </div>
  );

  return (
    <div className="feed-screen">

      {/* ── Statusrad ── */}
      <div className="feed-statusbar">
        <span className="feed-count">
          {sorted.length} av {listings.length} annonser
          {newCount > 0 && <span className="badge badge--new" style={{ marginLeft: 8 }}>{newCount} nya</span>}
          {watchCount > 0 && <span className="badge badge--watched" style={{ marginLeft: 8 }}>⭐ {watchCount}</span>}
        </span>
        <span className="feed-auto-label">Hämtas automatiskt</span>
      </div>

      {error && (
        <div className="feed-error">{error}</div>
      )}

      {/* ── Sortering ── */}
      <div className="feed-sort">
        {[
          { key: 'createdAt', label: 'Datum' },
          { key: 'rooms',     label: 'Rum' },
          { key: 'sqm',       label: 'Storlek' },
          { key: 'price',     label: 'Pris' },
        ].map(function(s) {
          return (
            <button
              key={s.key}
              className={'sort-btn' + (sortBy === s.key ? ' sort-btn--active' : '')}
              onClick={function() { toggleSort(s.key); }}>
              {s.label} {sortIcon(s.key)}
            </button>
          );
        })}
      </div>

      {/* ── Filter-toggle ── */}
      <div className="feed-filter-toggle">
        <button
          className={'btn-filter-toggle' + (showFilters ? ' active' : '') + (activeFilters > 0 ? ' has-filters' : '')}
          onClick={function() { setShowFilters(function(v) { return !v; }); }}>
          Filter {activeFilters > 0 ? '(' + activeFilters + ')' : ''} {showFilters ? '▲' : '▼'}
        </button>
        {activeFilters > 0 && (
          <button className="btn-clear-filters" onClick={function() {
            setFilterSource(''); setFilterAgency(''); setFilterArea('');
            setFilterStreet(''); setFilterWatched(false);
          }}>Rensa</button>
        )}
      </div>

      {/* ── Filter-panel ── */}
      {showFilters && (
        <div className="feed-filters">
          <div className="filter-row">
            <label className="filter-label">Källa</label>
            <select className="filter-select" value={filterSource}
              onChange={function(e) { setFilterSource(e.target.value); }}>
              <option value="">Alla</option>
              {sources.map(function(s) { return <option key={s} value={s}>{s}</option>; })}
            </select>
          </div>
          <div className="filter-row">
            <label className="filter-label">Mäklare</label>
            <select className="filter-select" value={filterAgency}
              onChange={function(e) { setFilterAgency(e.target.value); }}>
              <option value="">Alla</option>
              {agencies.map(function(a) { return <option key={a} value={a}>{a}</option>; })}
            </select>
          </div>
          <div className="filter-row">
            <label className="filter-label">Område</label>
            <select className="filter-select" value={filterArea}
              onChange={function(e) { setFilterArea(e.target.value); }}>
              <option value="">Alla</option>
              {areas.map(function(a) { return <option key={a} value={a}>{a}</option>; })}
            </select>
          </div>
          <div className="filter-row">
            <label className="filter-label">Gata</label>
            <select className="filter-select" value={filterStreet}
              onChange={function(e) { setFilterStreet(e.target.value); }}>
              <option value="">Alla</option>
              {streets.map(function(s) { return <option key={s} value={s}>{s}</option>; })}
            </select>
          </div>
          <div className="filter-row">
            <label className="filter-label filter-label--checkbox">
              <input type="checkbox" checked={filterWatched}
                onChange={function(e) { setFilterWatched(e.target.checked); }} />
              Visa endast bevakade
            </label>
          </div>
        </div>
      )}

      {/* ── Annonslist ── */}
      {sorted.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="Inga annonser"
          text={listings.length > 0 ? 'Inga annonser matchar dina filter.' : 'Annonser hämtas automatiskt när nya bevakningsmail kommer in.'}
        />
      ) : (
        <div className="listings-list">
          {sorted.map(function(l) {
            return (
              <ListingCard
                key={l.id}
                listing={l}
                householdId={householdId}
                anthropicKey={anthropicKey}
                watched={!!watched[l.id]}
                onToggleWatch={handleToggleWatch}
                enriching={enrichingIds.has(l.id)}
              />
            );
          })}
        </div>
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
