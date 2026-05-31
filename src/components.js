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
  const [copied, setCopied] = React.useState(false);

  function copyCode() {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={e => e.stopPropagation()}>

        {/* Handtag */}
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
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--divider)', marginBottom: 20 }} />

        {/* Hushåll */}
        <div className="section-header" style={{ marginTop: 0 }}>Hushåll</div>
        <Card style={{ marginBottom: 16 }}>
          <div className="list-item__sub" style={{ marginBottom: 6 }}>Hushållets namn</div>
          <div style={{ fontWeight: 500 }}>{household?.name || '—'}</div>

          <div style={{ height: 1, background: 'var(--divider)', margin: '12px 0' }} />

          <div className="list-item__sub" style={{ marginBottom: 8 }}>Inbjudningskod</div>
          <div className="flex-between">
            <div style={{
              fontSize: 24, fontWeight: 700, letterSpacing: 6,
              fontFamily: 'monospace', color: 'var(--primary)',
            }}>
              {household?.inviteCode || '——'}
            </div>
            <button className="btn btn--text" style={{ padding: '6px 12px' }} onClick={copyCode}>
              {copied ? '✓ Kopierad' : 'Kopiera'}
            </button>
          </div>
          <div className="text-sm text-muted" style={{ marginTop: 4 }}>
            Dela med din medsökare för att gå med i hushållet
          </div>

          <div style={{ height: 1, background: 'var(--divider)', margin: '12px 0' }} />

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
