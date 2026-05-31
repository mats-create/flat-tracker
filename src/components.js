// components.js — delade UI-komponenter för Flat Tracker

// ── TopBar ───────────────────────────────────────────────────────────
function TopBar({ title, action }) {
  return (
    <div className="top-bar">
      <span className="top-bar__logo">🏢</span>
      <span className="top-bar__title">{title || APP_NAME}</span>
      {action && (
        <button className="top-bar__action" onClick={action.onClick} title={action.label}>
          {action.icon}
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
      <div className="login-screen__logo">🏢</div>
      <div className="login-screen__title">Flat Tracker</div>
      <div className="login-screen__sub">
        Få direktnotiser när lägenheter publiceras på dina bevakade gator.
      </div>
      <button className="btn--google" onClick={onLogin}>
        <span>G</span>
        <span>Logga in med Google</span>
      </button>
    </div>
  );
}
