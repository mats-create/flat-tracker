// app.js — root app component for Flat Tracker

const { useState, useEffect } = React;

function App() {
  const [user, setUser]     = useState(undefined);  // undefined = loading
  const [tab, setTab]       = useState('feed');
  const [newCount, setNewCount] = useState(2);       // mock badge count

  // ── Auth listener ──────────────────────────────────────────────────
  useEffect(() => {
    const { auth, onAuthStateChanged } = window.__firebase;
    const unsub = onAuthStateChanged(auth, u => setUser(u || null));
    return unsub;
  }, []);

  // ── Google sign-in ─────────────────────────────────────────────────
  function handleLogin() {
    const { auth, GoogleAuthProvider, signInWithPopup } = window.__firebase;
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => console.error('Login error', err));
  }

  // ── Sign out ───────────────────────────────────────────────────────
  function handleSignOut() {
    const { auth, signOut } = window.__firebase;
    signOut(auth);
  }

  // ── Loading splash ─────────────────────────────────────────────────
  if (user === undefined) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  // ── Not signed in ──────────────────────────────────────────────────
  if (user === null) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // ── Signed in ──────────────────────────────────────────────────────
  const screenTitles = {
    feed:      'Feed',
    watchlist: 'Watchlist',
    hunter:    'Hunter',
    areas:     'Areas',
  };

  function renderScreen() {
    switch (tab) {
      case 'feed':      return <FeedScreen user={user} />;
      case 'watchlist': return <WatchlistScreen user={user} />;
      case 'hunter':    return <HunterScreen user={user} />;
      case 'areas':     return <AreasScreen user={user} />;
      default:          return <FeedScreen user={user} />;
    }
  }

  const badge = { feed: newCount };

  return (
    <>
      <TopBar
        title={screenTitles[tab]}
        action={{ icon: '👤', label: 'Sign out', onClick: handleSignOut }}
      />
      {renderScreen()}
      <BottomNav active={tab} onChange={setTab} badge={badge} />
    </>
  );
}

// ── Mount ────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
