// app.js — rot-komponent för Flat Tracker

const { useState, useEffect } = React;

function App() {
  const [user, setUser]               = useState(undefined);
  const [householdId, setHouseholdId] = useState(undefined);
  const [household, setHousehold]     = useState(null);
  const [tab, setTab]                 = useState('feed');
  const [showSettings, setShowSettings] = useState(false);
  const [newCount]                    = useState(2);

  // ── Auth-lyssnare ──────────────────────────────────────────────────
  useEffect(() => {
    const { auth, onAuthStateChanged } = window.__firebase;
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) {
        setUser(null);
        setHouseholdId(null);
        setHousehold(null);
        return;
      }
      setUser(u);
      const hid = await getHouseholdId(u.uid);
      setHouseholdId(hid || null);
    });
    return unsub;
  }, []);

  // ── Hämta hushållsdata när vi har ett ID ───────────────────────────
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

  // ── Ej inloggad ───────────────────────────────────────────────────
  if (user === null) return <LoginScreen onLogin={handleLogin} />;

  // ── Inloggad men saknar hushåll ───────────────────────────────────
  if (!householdId) {
    return <HouseholdSetupScreen user={user} onComplete={handleHouseholdComplete} />;
  }

  // ── Inloggad med hushåll ──────────────────────────────────────────
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

  return (
    <>
      <TopBar
        title={skärmTitlar[tab]}
        onMenuOpen={() => setShowSettings(true)}
      />
      {visaSkärm()}
      <BottomNav active={tab} onChange={setTab} badge={{ feed: newCount }} />

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
