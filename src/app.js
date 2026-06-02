// app.js — rot-komponent för Flat Tracker

const { useState, useEffect } = React;

function App() {
  const [user, setUser]                 = useState(undefined);
  const [householdId, setHouseholdId]   = useState(undefined);
  const [household, setHousehold]       = useState(null);
  const [profiles, setProfiles]         = useState([]);
  const [tab, setTab]                   = useState('feed');
  const [showSettings, setShowSettings] = useState(false);
  const [showIo, setShowIo]             = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newCount]                      = useState(0);

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

  // ── Hämta bevakningsprofiler ───────────────────────────────────────
  useEffect(() => {
    if (!householdId) return;
    const { db, collection, query, where, onSnapshot } = window.__firebase;
    const q = query(
      collection(db, COLLECTIONS.HOUSEHOLDS, householdId, 'profiles'),
      where('active', '==', true)
    );
    const unsub = onSnapshot(q, snap => {
      setProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      <div className="spinner-screen">
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
    areas:     'Områden',
  };

  function visaSkärm() {
    const props = { user, householdId, household, profiles };
    switch (tab) {
      case 'feed':      return <FeedScreen {...props} />;
      case 'watchlist': return <WatchlistScreen {...props} />;
      case 'areas':     return <AreasScreen {...props} />;
      default:          return <FeedScreen {...props} />;
    }
  }

  const badge = { feed: newCount };

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
        <div className="sidebar__brand">
          <Logo size={32} />
          <span className="sidebar__brand-name">Flat Tracker</span>
          <button
            className="sidebar__collapse-btn"
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expandera meny' : 'Minimera meny'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar__nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`sidebar__item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              title={t.label}
            >
              <span className="sidebar__item-icon">{t.icon}</span>
              <span className="sidebar__item-label">{t.label}</span>
              {badge[t.id] > 0 && (
                <span className="sidebar__item-badge">{badge[t.id]}</span>
              )}
            </button>
          ))}

          {/* Io i sidebaren */}
          <button
            className={`sidebar__item ${showIo ? 'active' : ''}`}
            onClick={() => setShowIo(v => !v)}
            title="Io — AI"
          >
            <span className="sidebar__item-icon">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Io</span>
            </span>
            <span className="sidebar__item-label">Io — AI</span>
          </button>
        </nav>

        <div className="sidebar__footer">
          <button className="sidebar__settings-btn" onClick={() => setShowSettings(true)}>
            <div className="sidebar__avatar">
              {user?.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="sidebar__settings-text">
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {user?.displayName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Inställningar</div>
            </div>
            <span className="sidebar__settings-gear" style={{ fontSize: 16 }}>⚙️</span>
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
        <BottomNav active={tab} onChange={t => { setTab(t); setShowIo(false); }} badge={badge} />
        {/* Io FAB — bara på mobil (dold på desktop via CSS) */}
        <IoButton onClick={() => setShowIo(v => !v)} active={showIo} />
      </div>

      {/* ── Io Flyout — flex-sibling, skjuter in layouten på desktop ── */}
      <IoFlyout
        household={household}
        open={showIo}
        onClose={() => setShowIo(false)}
      />

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
