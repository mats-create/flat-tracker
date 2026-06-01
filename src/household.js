// household.js — hushållslogik för Flat Tracker

// ── Skapa nytt hushåll ───────────────────────────────────────────────
async function createHousehold(user) {
  const { db, collection, doc, setDoc, serverTimestamp } = window.__firebase;
  const householdId = localId();
  const inviteCode  = generateInviteCode();

  await setDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
    name:      'Vårt lägenhetssökande',
    members:   [user.uid],
    inviteCode,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
    householdId,
    email:       user.email,
    displayName: user.displayName,
    updatedAt:   serverTimestamp(),
  }, { merge: true });

  return { householdId, inviteCode };
}

// ── Gå med i hushåll via inbjudningskod ─────────────────────────────
async function joinHousehold(user, code) {
  const { db, collection, doc, setDoc, getDocs, updateDoc, query, where, serverTimestamp } = window.__firebase;

  const q = query(
    collection(db, COLLECTIONS.HOUSEHOLDS),
    where('inviteCode', '==', code.toUpperCase().trim())
  );
  const snap = await getDocs(q);

  if (snap.empty) throw new Error('Ingen inbjudan hittades med den koden. Kontrollera och försök igen.');

  const householdDoc = snap.docs[0];
  const householdId  = householdDoc.id;
  const data         = householdDoc.data();

  if (data.members.includes(user.uid)) throw new Error('Du är redan medlem i det här hushållet.');
  if (data.members.length >= 2) throw new Error('Det här hushållet är redan fullt (max 2 medlemmar).');

  await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
    members: [...data.members, user.uid],
  });

  await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
    householdId,
    email:       user.email,
    displayName: user.displayName,
    updatedAt:   serverTimestamp(),
  }, { merge: true });

  return householdId;
}

// ── Hämta hushålls-ID för en användare ──────────────────────────────
async function getHouseholdId(uid) {
  const { db, doc, getDoc } = window.__firebase;
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!snap.exists()) return null;
  return snap.data().householdId || null;
}

// ── Spara Anthropic API-nyckel ───────────────────────────────────────
async function saveHouseholdApiKey(householdId, apiKey) {
  const { db, doc, updateDoc } = window.__firebase;
  await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
    anthropicKey: apiKey,
  });
}

// ── Spara Apify API-nyckel ───────────────────────────────────────────
async function saveHouseholdApifyKey(householdId, apifyKey) {
  const { db, doc, updateDoc } = window.__firebase;
  await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
    apifyKey,
  });
}

// ── HouseholdSetup — skärm för att skapa eller gå med i hushåll ─────
function HouseholdSetupScreen({ user, onComplete }) {
  const [view, setView]             = React.useState('choice');
  const [inviteCode, setInviteCode] = React.useState('');
  const [joinCode, setJoinCode]     = React.useState('');
  const [loading, setLoading]       = React.useState(false);
  const [error, setError]           = React.useState('');

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const { inviteCode: code } = await createHousehold(user);
      setInviteCode(code);
      setView('created');
    } catch (e) {
      setError('Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      await joinHousehold(user, joinCode);
      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (view === 'choice') return (
    <div className="login-screen">
      <div className="login-screen__logo">🏡</div>
      <div className="login-screen__title">Välkommen!</div>
      <div className="login-screen__sub">
        Skapa ett nytt hushåll eller gå med i ett befintligt med en inbjudningskod.
      </div>
      <button className="btn btn--primary btn--full" onClick={() => setView('create')}
        style={{ maxWidth: 280, marginBottom: 12 }}>
        Skapa nytt hushåll
      </button>
      <button className="btn--google" onClick={() => setView('join')}
        style={{ maxWidth: 280 }}>
        Gå med med kod
      </button>
    </div>
  );

  if (view === 'create') return (
    <div className="login-screen">
      <div className="login-screen__logo">🏡</div>
      <div className="login-screen__title">Skapa hushåll</div>
      <div className="login-screen__sub">
        Vi skapar ett delat hushåll för er lägenhetssökning.
        Du får en inbjudningskod att dela med din medsökare.
      </div>
      {error && <div style={{ color: 'var(--error)', fontSize: 14, marginBottom: 12 }}>{error}</div>}
      <button className="btn btn--primary btn--full" onClick={handleCreate} disabled={loading}
        style={{ maxWidth: 280, marginBottom: 12 }}>
        {loading ? 'Skapar…' : 'Skapa hushåll'}
      </button>
      <button className="btn btn--text" onClick={() => setView('choice')}>← Tillbaka</button>
    </div>
  );

  if (view === 'created') return (
    <div className="login-screen">
      <div className="login-screen__logo">🎉</div>
      <div className="login-screen__title">Hushåll skapat!</div>
      <div className="login-screen__sub">
        Dela den här koden med din medsökare så kan de gå med.
      </div>
      <div style={{
        fontSize: 36, fontWeight: 700, letterSpacing: 8,
        color: 'var(--primary)', margin: '24px 0',
        background: 'var(--surface-2)', padding: '16px 32px',
        borderRadius: 'var(--radius)', fontFamily: 'monospace',
      }}>
        {inviteCode}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 24 }}>
        Koden kan användas en gång
      </div>
      <button className="btn btn--primary btn--full" onClick={onComplete}
        style={{ maxWidth: 280 }}>
        Fortsätt till appen →
      </button>
    </div>
  );

  if (view === 'join') return (
    <div className="login-screen">
      <div className="login-screen__logo">🔑</div>
      <div className="login-screen__title">Gå med i hushåll</div>
      <div className="login-screen__sub">
        Ange inbjudningskoden du fått från din medsökare.
      </div>
      <input
        className="input"
        style={{ maxWidth: 280, textAlign: 'center', fontSize: 24, letterSpacing: 6,
          fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 12 }}
        placeholder="ABC123"
        value={joinCode}
        onChange={e => setJoinCode(e.target.value.toUpperCase())}
        maxLength={6}
      />
      {error && <div style={{ color: 'var(--error)', fontSize: 14, marginBottom: 12 }}>{error}</div>}
      <button className="btn btn--primary btn--full" onClick={handleJoin}
        disabled={loading || joinCode.length < 6} style={{ maxWidth: 280, marginBottom: 12 }}>
        {loading ? 'Söker…' : 'Gå med'}
      </button>
      <button className="btn btn--text" onClick={() => { setView('choice'); setError(''); }}>
        ← Tillbaka
      </button>
    </div>
  );

  return null;
}
