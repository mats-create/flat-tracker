// app.js — rot-komponent för Flat Tracker

const { useState, useEffect } = React;

function App() {
  const [user, setUser]                 = useState(undefined);
  const [householdId, setHouseholdId]   = useState(undefined);
  const [household, setHousehold]       = useState(null);
  const [tab, setTab]                   = useState('feed');
  const [showSettings, setShowSettings] = useState(false);
  const [newCount]                      = useState(2);

  // ── Auth-lyssnare ──────────────────────────────────────────────────
  useEffect(() => {
    const { auth, onAuthStateChanged } = window.__firebase;
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) {
        setUser(null); setHouseholdId(null); setHousehold(null);
        return;
      }
      setUser(u);
      const hid = await getHouseholdId(u.uid);
      setHouseholdId(hid || null);
    });
    return unsub;
  }, []);

  // ── Hämta hushållsdata ─────────────────────────────────────────────
  useEffect(() => {
    if (!householdId) return;
    const { db, doc, onSnapshot } = window.__firebase;
    const unsub = onSnapshot(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), snap => {
      if (snap.exists()) setHousehold({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [householdId]);

  // ── Google-inloggning ──────────────────────────────────────────────
  function handleLogin() {
    const { auth, GoogleAuthProvider, signInWithPopup } = window.__firebase;
    signInWithPopup(auth, new GoogleAuthProvider())
      .catch(err => console.error('Inloggningsfel', err));
  }

  // ── Logga ut ───────────────────────────────────────────────────────
  function handleSignOut() {
    const { auth, signOut } = window.__firebase;
    signOut(auth);
    setShowSettings(false);
  }

  // ── Hushåll klart ─────────────────────────────────────────────────
  async function handleHouseholdComplete() {
    const hid = await getHouseholdId(user.uid);
    setHouseholdId(hid);
  }

  // ── Laddar ────────────────────────────────────────────────────────
  if (user === undefined || (user && householdId === undefined)) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (user === null) {
    return <div style={{ height:'100%', width:'100%' }}><LoginScreen onLogin={handleLogin} /></div>;
  }

  if (!householdId) {
    return <div style={{ height:'100%', width:'100%' }}><HouseholdSetupScreen user={user} onComplete={handleHouseholdComplete} /></div>;
  }

  // ── Rendrera skärm ────────────────────────────────────────────────
  const skärmTitlar = {
    feed:      'Flöde',
    watchlist: 'Bevakning',
    hunter:    'Hunter',
    areas:     'Områden',
  };

  function visaSkärm() {
    const props = { user, householdId };
    switch (tab) {
      case 'feed':      return <FeedScreen {...props} />;
      case 'watchlist': return <WatchlistScreen {...props} />;
      case 'hunter':    return <HunterScreen {...props} />;
      case 'areas':     return <AreasScreen {...props} />;
      default:          return <FeedScreen {...props} />;
    }
  }

  const badge = { feed: newCount };

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Logo size={32} />
          <span className="sidebar__brand-name">Flat Tracker</span>
        </div>

        <nav className="sidebar__nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`sidebar__item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="sidebar__item-icon">{t.icon}</span>
              <span className="sidebar__item-label">{t.label}</span>
              {badge[t.id] > 0 && (
                <span className="sidebar__item-badge">{badge[t.id]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button className="sidebar__settings-btn" onClick={() => setShowSettings(true)}>
            <div className="sidebar__avatar">
              {user?.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {user?.displayName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Inställningar</div>
            </div>
            <span style={{ fontSize: 16 }}>⚙️</span>
          </button>
        </div>
      </aside>

      {/* ── Huvudinnehåll ──────────────────────────────────────────── */}
      <div className="app-body">
        <TopBar
          title={skärmTitlar[tab]}
          onMenuOpen={() => setShowSettings(true)}
        />
        {visaSkärm()}
        <BottomNav active={tab} onChange={setTab} badge={badge} />
      </div>

      {/* ── Inställningsmeny ───────────────────────────────────────── */}
      {showSettings && (
        <SettingsMenu
          user={user}
          household={household}
          onClose={() => setShowSettings(false)}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
}

// ── Montera ───────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
