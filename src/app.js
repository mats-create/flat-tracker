// app.js — rot-komponent för Flat Tracker

const { useState, useEffect } = React;

function App() {
  const [user, setUser]             = useState(undefined);  // undefined = laddar
  const [householdId, setHouseholdId] = useState(undefined); // undefined = laddar
  const [tab, setTab]               = useState('feed');
  const [newCount]                  = useState(2); // mock badge-räknare

  // ── Auth-lyssnare ──────────────────────────────────────────────────
  useEffect(() => {
    const { auth, onAuthStateChanged } = window.__firebase;
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) {
        setUser(null);
        setHouseholdId(null);
        return;
      }
      setUser(u);
      // Kolla om användaren redan har ett hushåll
      const hid = await getHouseholdId(u.uid);
      setHouseholdId(hid || null);
    });
    return unsub;
  }, []);

  // ── Google-inloggning ──────────────────────────────────────────────
  function handleLogin() {
    const { auth, GoogleAuthProvider, signInWithPopup } = window.__firebase;
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => console.error('Inloggningsfel', err));
  }

  // ── Logga ut ───────────────────────────────────────────────────────
  function handleSignOut() {
    const { auth, signOut } = window.__firebase;
    signOut(auth);
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
  if (user === null) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // ── Inloggad men saknar hushåll ───────────────────────────────────
  if (!householdId) {
    return <HouseholdSetupScreen user={user} onComplete={handleHouseholdComplete} />;
  }

  // ── Inloggad med hushåll — visa appen ─────────────────────────────
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
      <TopBar
        title={skärmTitlar[tab]}
        action={{ icon: '👤', label: 'Logga ut', onClick: handleSignOut }}
      />
      {visaSkärm()}
      <BottomNav active={tab} onChange={setTab} badge={badge} />
    </>
  );
}

// ── Montera ───────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
