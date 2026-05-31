// components.js — delade UI-komponenter för Flat Tracker

// ── Logotyp SVG ──────────────────────────────────────────────────────
function Logo({ size = 64 }) {
  const scale = size / 130;
  const h = Math.round(160 * scale);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={h}
      viewBox="0 0 130 160" style={{ display: 'block' }}>
      <path d="M65 0 C35 0 10 25 10 55 C10 85 65 148 65 148 C65 148 120 85 120 55 C120 25 95 0 65 0 Z" fill="#0D47A1"/>
      <path d="M65 4 C37 4 14 27 14 55 C14 83 65 142 65 142 C65 142 116 83 116 55 C116 27 93 4 65 4 Z" fill="#1565C0"/>
      <circle cx="65" cy="52" r="34" fill="white"/>
      <polygon points="65,24 40,48 90,48" fill="#1565C0"/>
      <rect x="44" y="46" width="42" height="32" rx="2" fill="#1565C0"/>
      <rect x="56" y="58" width="18" height="20" rx="1" fill="white"/>
      <circle cx="93" cy="22" r="9" fill="#FF6F00"/>
      <circle cx="93" cy="22" r="5" fill="white" opacity="0.4"/>
    </svg>
  );
}

// ── TopBar ───────────────────────────────────────────────────────────
function TopBar({ title, onMenuOpen }) {
  return (
    <div className="top-bar">
      <Logo size={28} />
      <span className="top-bar__title">{title || APP_NAME}</span>
      {onMenuOpen && (
        <button className="top-bar__action" onClick={onMenuOpen} title="Inställningar">
          ⚙️
        </button>
      )}
    </div>
  );
}

// ── BottomNav ────────────────────────────────────────────────────────
function BottomNav({ active, onChange, badge }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`nav-item ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav-item__icon">{tab.icon}</span>
          <span className="nav-item__label">{tab.label}</span>
          {badge && badge[tab.id] > 0 && (
            <span className="nav-item__badge">{badge[tab.id]}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
function Card({ children, variant, style, onClick }) {
  const cls = ['card', variant ? `card--${variant}` : '', onClick ? 'card--clickable' : '']
    .filter(Boolean).join(' ');
  return (
    <div className={cls} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────
function EmptyState({ icon, title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon || '📭'}</div>
      <div className="empty-state__title">{title || 'Inget här ännu'}</div>
      {text && <div className="empty-state__text">{text}</div>}
      {action && (
        <button className="btn btn--primary mt-16" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────
function Spinner() {
  return <div className="spinner" />;
}

// ── Chip ─────────────────────────────────────────────────────────────
function Chip({ label, variant }) {
  return <span className={`chip chip--${variant || 'primary'}`}>{label}</span>;
}

// ── ListingCard ──────────────────────────────────────────────────────
function ListingCard({ listing }) {
  const { street, area, rooms, sqm, price, rent, published, isNew } = listing;
  return (
    <Card variant={isNew ? 'new' : null}>
      <div className="flex-between">
        <div>
          <div className="list-item__title">{street}</div>
          <div className="list-item__sub">{area}</div>
        </div>
        {isNew && <Chip label="NY" variant="error" />}
      </div>
      <div className="flex gap-8 mt-12" style={{ flexWrap: 'wrap' }}>
        <Chip label={roomLabel(rooms)} variant="primary" />
        <Chip label={formatSqm(sqm)} variant="primary" />
        <Chip label={formatPrice(price)} variant="accent" />
      </div>
      <div className="flex-between mt-8">
        <span className="text-sm text-muted">{formatRent(rent)}</span>
        <span className="text-sm text-muted">{timeAgo(published)}</span>
      </div>
    </Card>
  );
}

// ── LoginScreen ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <div className="login-screen">
      <Logo size={80} />
      <div className="login-screen__title" style={{ marginTop: 16 }}>Flat Tracker</div>
      <div className="login-screen__sub">
        Få direktnotiser när lägenheter publiceras på dina bevakade gator.
      </div>
      <button className="btn--google" onClick={onLogin}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>G</span>
        <span>Logga in med Google</span>
      </button>
    </div>
  );
}

// ── SettingsMenu ─────────────────────────────────────────────────────
function SettingsMenu({ user, household, onClose, onSignOut }) {
  const [copied, setCopied]       = React.useState(false);
  const [apiKey, setApiKey]       = React.useState(household?.anthropicKey || '');
  const [showKey, setShowKey]     = React.useState(false);
  const [keySaved, setKeySaved]   = React.useState(false);
  const [keyError, setKeyError]   = React.useState('');

  const isOwner = household?.createdBy === user?.uid;

  function copyCode() {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  async function saveApiKey() {
    if (!apiKey.trim().startsWith('sk-ant-')) {
      setKeyError('Nyckeln ska börja med sk-ant-');
      return;
    }
    setKeyError('');
    try {
      await saveHouseholdApiKey(household.id, apiKey.trim());
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2500);
    } catch (e) {
      setKeyError('Kunde inte spara. Försök igen.');
    }
  }

  const divider = <div style={{ height: 1, background: 'var(--divider)', margin: '12px 0' }} />;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={e => e.stopPropagation()}
        style={{ overflowY: 'auto', maxHeight: '90vh' }}>

        <div className="settings-handle" />

        {/* Profil */}
        <div className="flex gap-12" style={{ alignItems: 'center', marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--primary)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, flexShrink: 0,
          }}>
            {user?.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 15 }}>{user?.displayName}</div>
            <div className="text-sm text-muted">{user?.email}</div>
            {isOwner && <Chip label="Ägare" variant="primary" />}
          </div>
        </div>

        {divider}

        {/* Hushåll */}
        <div className="section-header" style={{ marginTop: 0 }}>Hushåll</div>
        <Card style={{ marginBottom: 16 }}>
          <div className="list-item__sub" style={{ marginBottom: 4 }}>Namn</div>
          <div style={{ fontWeight: 500, marginBottom: 12 }}>{household?.name || '—'}</div>

          {divider}

          <div className="list-item__sub" style={{ marginBottom: 8 }}>Inbjudningskod</div>
          <div className="flex-between">
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, fontFamily: 'monospace', color: 'var(--primary)' }}>
              {household?.inviteCode || '——'}
            </div>
            <button className="btn btn--text" style={{ padding: '6px 12px' }} onClick={copyCode}>
              {copied ? '✓ Kopierad' : 'Kopiera'}
            </button>
          </div>
          <div className="text-sm text-muted" style={{ marginTop: 4 }}>
            Dela med din medsökare för att bjuda in dem
          </div>

          {divider}

          <div className="list-item__sub" style={{ marginBottom: 8 }}>Medlemmar</div>
          {(household?.members || []).map((uid, i) => (
            <div key={uid} className="flex gap-8" style={{ alignItems: 'center', marginBottom: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i === 0 ? 'var(--primary)' : 'var(--accent)',
                color: 'white', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700,
              }}>
                {i + 1}
              </div>
              <div className="text-sm">
                {uid === user?.uid ? `${user.displayName} (du)` : 'Medsökare'}
              </div>
            </div>
          ))}
        </Card>

        {/* API-nyckel — bara synlig för ägaren */}
        {isOwner && (
          <>
            <div className="section-header">Hunter AI</div>
            <Card style={{ marginBottom: 16 }}>
              <div className="list-item__sub" style={{ marginBottom: 6 }}>
                Anthropic API-nyckel
              </div>
              <div className="text-sm text-muted" style={{ marginBottom: 10, lineHeight: 1.5 }}>
                Hämta din nyckel på console.anthropic.com. Den delas automatiskt med alla i hushållet.
              </div>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <input
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
                <button className="btn btn--text" style={{ flexShrink: 0, padding: '8px' }}
                  onClick={() => setShowKey(v => !v)}>
                  {showKey ? '🙈' : '👁️'}
                </button>
              </div>
              {keyError && (
                <div className="text-sm" style={{ color: 'var(--error)', marginTop: 6 }}>{keyError}</div>
              )}
              <button className="btn btn--primary btn--full" style={{ marginTop: 10 }}
                onClick={saveApiKey} disabled={!apiKey.trim()}>
                {keySaved ? '✓ Sparad!' : 'Spara nyckel'}
              </button>
              {household?.anthropicKey && (
                <div className="text-sm" style={{ color: 'var(--success)', marginTop: 8, textAlign: 'center' }}>
                  ✓ Nyckel är aktiv
                </div>
              )}
            </Card>
          </>
        )}

        {!isOwner && (
          <>
            <div className="section-header">Hunter AI</div>
            <Card style={{ marginBottom: 16 }}>
              <div className="text-sm text-muted">
                {household?.anthropicKey
                  ? '✓ Hunter är aktiv — API-nyckel konfigurerad av hushållsägaren.'
                  : '⚠️ Hunter är inte aktiv ännu. Be hushållsägaren lägga till en API-nyckel i inställningarna.'}
              </div>
            </Card>
          </>
        )}

        {/* Logga ut */}
        <button className="btn btn--full" onClick={onSignOut}
          style={{
            background: 'var(--surface-2)', color: 'var(--error)',
            borderRadius: 'var(--radius)', padding: '14px',
            border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 15,
          }}>
          Logga ut
        </button>

      </div>
    </div>
  );
}

// ── IoFlyout ─────────────────────────────────────────────────────────
function IoFlyout({ household, open, onClose }) {
  const [messages, setMessages] = React.useState([
    { id: 'welcome', role: 'io', text: 'Hej! Jag är Io 🔍 Fråga mig om lägenheter, priser eller områden.' }
  ]);
  const [input, setInput]     = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef(null);
  const apiKey    = household?.anthropicKey || '';

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    if (!apiKey) {
      setMessages(prev => [...prev, {
        id: localId(), role: 'io',
        text: 'Io är inte aktiv ännu. Hushållsägaren behöver lägga till en Anthropic API-nyckel i Inställningar.',
      }]);
      return;
    }

    setMessages(prev => [...prev, { id: localId(), role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role === 'io' ? 'assistant' : 'user', content: m.text }));

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          system: IO_SYSTEM_PROMPT,
          messages: [...history, { role: 'user', content: text }],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new Error('API-nyckeln är ogiltig eller saknas.');
        if (res.status === 403) throw new Error('API-nyckeln saknar behörighet eller fakturering är inte aktiverad.');
        if (res.status === 429) throw new Error('För många förfrågningar, försök igen om en stund.');
        throw new Error(`API-fel ${res.status}`);
      }
      const reply = data.content?.[0]?.text || 'Tyvärr kunde jag inte hämta ett svar.';
      setMessages(prev => [...prev, { id: localId(), role: 'io', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: localId(), role: 'io',
        text: `Fel: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay — stänger flyouten vid klick utanför */}
      <div className="io-overlay" onClick={onClose} />

      <div className="io-flyout">
        {/* Header */}
        <div className="io-flyout__header">
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <div className="io-flyout__avatar">Io</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Io</div>
              <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>AI-assistent</div>
            </div>
          </div>
          <button className="top-bar__action" style={{ color: 'var(--text-secondary)' }}
            onClick={onClose}>✕</button>
        </div>

        {/* Meddelanden */}
        <div className="io-flyout__messages" ref={bottomRef}>
          {messages.map(m => (
            <div key={m.id} className={`chat-bubble chat-bubble--${m.role === 'io' ? 'hunter' : 'user'}`}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble chat-bubble--hunter text-muted">Tänker…</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Inmatning */}
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            rows={1}
            placeholder="Fråga Io något…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="chat-send" onClick={sendMessage} disabled={!input.trim() || loading}>
            ➤
          </button>
        </div>
      </div>
    </>
  );
}

// ── IoButton — flytande knapp för att öppna Io ───────────────────────
function IoButton({ onClick, active }) {
  return (
    <button className={`io-fab ${active ? 'io-fab--active' : ''}`} onClick={onClick}
      title="Öppna Io">
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -1 }}>Io</span>
    </button>
  );
}
