// screens.js — fyra huvudskärmar för Flat Tracker

// ── FlödesSkärm ──────────────────────────────────────────────────────
function FeedScreen({ user, householdId }) {
  const [listings] = React.useState(MOCK_LISTINGS);
  const newCount = listings.filter(l => l.isNew).length;

  return (
    <div className="screen">
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Bevakar <strong>{MOCK_AREAS.length}</strong> områden
        </div>
        {newCount > 0 && <Chip label={`${newCount} nya`} variant="error" />}
      </div>

      <div className="section-header">Senaste annonser</div>
      {listings.length === 0
        ? <EmptyState
            icon="🏠"
            title="Inga annonser ännu"
            text="Lägg till gator i din bevakning för att börja få notiser."
          />
        : listings.map(l => <ListingCard key={l.id} listing={l} />)
      }
    </div>
  );
}

// ── BevakningsSkärm ──────────────────────────────────────────────────
function WatchlistScreen({ user, householdId }) {
  const [areas] = React.useState(MOCK_AREAS);

  return (
    <div className="screen">
      <div className="section-header">Bevakade områden och gator</div>

      {areas.length === 0
        ? <EmptyState
            icon="📍"
            title="Inga områden ännu"
            text="Lägg till ett område och välj gator att bevaka."
            action={{ label: '+ Lägg till område', onClick: () => {} }}
          />
        : areas.map(area => (
            <Card key={area.id}>
              <div className="flex-between">
                <div>
                  <div className="list-item__title">{area.name}</div>
                  <div className="list-item__sub">{area.city}</div>
                </div>
                <Chip label={area.popularity}
                  variant={area.popularity === 'Hög' ? 'error' : 'accent'} />
              </div>
              <div className="flex gap-8 mt-12" style={{ flexWrap: 'wrap' }}>
                {area.streets.map(s => (
                  <Chip key={s} label={s} variant="primary" />
                ))}
              </div>
            </Card>
          ))
      }

      <button className="btn btn--primary btn--full mt-16">
        + Lägg till område
      </button>
    </div>
  );
}

// ── OmrådesSkärm ─────────────────────────────────────────────────────
function AreasScreen({ user, householdId }) {
  const [areas]    = React.useState(MOCK_AREAS);
  const [selected, setSelected] = React.useState(null);

  if (selected) {
    const area = areas.find(a => a.id === selected);
    return (
      <div className="screen">
        <button className="btn btn--text" style={{ marginLeft: -8 }} onClick={() => setSelected(null)}>
          ← Tillbaka
        </button>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{area.name}</div>
          <div className="text-muted">{area.city}</div>
        </div>

        <Card style={{ marginTop: 16 }}>
          <div className="section-header" style={{ marginTop: 0 }}>Översikt</div>
          <div className="list-item">
            <div className="list-item__content">
              <div className="list-item__sub">Snittpris / m²</div>
              <div className="list-item__title">{formatPrice(area.avgPricePerSqm)}</div>
            </div>
          </div>
          <div className="list-item">
            <div className="list-item__content">
              <div className="list-item__sub">Popularitet</div>
              <div className="list-item__title">{area.popularity}</div>
            </div>
          </div>
        </Card>

        <div className="section-header">Karaktär</div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {area.traits.map(t => <Chip key={t} label={t} variant="success" />)}
        </div>

        <div className="section-header">Gator</div>
        <Card>
          {area.streets.map(s => (
            <div key={s} className="list-item">
              <div className="list-item__icon">🛣️</div>
              <div className="list-item__content">
                <div className="list-item__title">{s}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="section-header">Områden</div>
      {areas.map(area => (
        <Card key={area.id} onClick={() => setSelected(area.id)}>
          <div className="flex-between">
            <div>
              <div className="list-item__title">{area.name}</div>
              <div className="list-item__sub">{area.city} · {area.streets.length} gator</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-sm text-bold">
                {formatPrice(area.avgPricePerSqm)}<span className="text-muted">/m²</span>
              </div>
              <Chip label={area.popularity}
                variant={area.popularity === 'Hög' ? 'error' : 'accent'} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
