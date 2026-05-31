// screens.js — four main screens for Flat Tracker

// ── FeedScreen ───────────────────────────────────────────────────────
function FeedScreen({ user }) {
  const [listings] = React.useState(MOCK_LISTINGS);

  const newCount = listings.filter(l => l.isNew).length;

  return (
    <div className="screen">
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Watching <strong>{MOCK_AREAS.length}</strong> areas
          </div>
        </div>
        {newCount > 0 && <Chip label={`${newCount} new`} variant="error" />}
      </div>

      <div className="section-header">Latest listings</div>
      {listings.length === 0
        ? <EmptyState
            icon="🏠"
            title="No listings yet"
            text="Add streets to your watchlist to start receiving alerts."
          />
        : listings.map(l => <ListingCard key={l.id} listing={l} />)
      }
    </div>
  );
}

// ── WatchlistScreen ──────────────────────────────────────────────────
function WatchlistScreen({ user }) {
  const [areas] = React.useState(MOCK_AREAS);

  return (
    <div className="screen">
      <div className="section-header">Watched areas & streets</div>

      {areas.length === 0
        ? <EmptyState
            icon="📍"
            title="No areas yet"
            text="Add an area and select streets to watch."
            action={{ label: '+ Add area', onClick: () => {} }}
          />
        : areas.map(area => (
            <Card key={area.id}>
              <div className="flex-between">
                <div>
                  <div className="list-item__title">{area.name}</div>
                  <div className="list-item__sub">{area.city}</div>
                </div>
                <Chip label={area.popularity} variant={area.popularity === 'High' ? 'error' : 'accent'} />
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
        + Add area
      </button>
    </div>
  );
}

// ── HunterScreen ─────────────────────────────────────────────────────
function HunterScreen({ user }) {
  const [messages, setMessages] = React.useState([
    {
      id: 'welcome',
      role: 'hunter',
      text: "Hi! I'm Hunter 🤖 Ask me anything about apartments, price trends, or neighbourhood insights.",
    }
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: localId(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role === 'hunter' ? 'assistant' : 'user', content: m.text }));

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: HUNTER_SYSTEM_PROMPT,
          messages: [...history, { role: 'user', content: text }],
        }),
      });

      const data = await res.json();
      const reply = data.content?.[0]?.text || 'Sorry, I could not get a response.';
      setMessages(prev => [...prev, { id: localId(), role: 'hunter', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: localId(), role: 'hunter',
        text: 'Something went wrong. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chat-messages">
        {messages.map(m => (
          <div key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble chat-bubble--hunter text-muted">
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          rows={1}
          placeholder="Ask Hunter anything…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button className="chat-send" onClick={sendMessage} disabled={!input.trim() || loading}>
          ➤
        </button>
      </div>
    </div>
  );
}

// ── AreasScreen ──────────────────────────────────────────────────────
function AreasScreen({ user }) {
  const [areas] = React.useState(MOCK_AREAS);
  const [selected, setSelected] = React.useState(null);

  if (selected) {
    const area = areas.find(a => a.id === selected);
    return (
      <div className="screen">
        <button className="btn btn--text" style={{ marginLeft: -8 }} onClick={() => setSelected(null)}>
          ← Back
        </button>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{area.name}</div>
          <div className="text-muted">{area.city}</div>
        </div>

        <Card style={{ marginTop: 16 }}>
          <div className="section-header" style={{ marginTop: 0 }}>Overview</div>
          <div className="list-item">
            <div className="list-item__content">
              <div className="list-item__sub">Avg price / m²</div>
              <div className="list-item__title">{formatPrice(area.avgPricePerSqm)}</div>
            </div>
          </div>
          <div className="list-item">
            <div className="list-item__content">
              <div className="list-item__sub">Popularity</div>
              <div className="list-item__title">{area.popularity}</div>
            </div>
          </div>
        </Card>

        <div className="section-header">Traits</div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {area.traits.map(t => <Chip key={t} label={t} variant="success" />)}
        </div>

        <div className="section-header">Streets</div>
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
      <div className="section-header">Areas</div>
      {areas.map(area => (
        <Card key={area.id} onClick={() => setSelected(area.id)}>
          <div className="flex-between">
            <div>
              <div className="list-item__title">{area.name}</div>
              <div className="list-item__sub">{area.city} · {area.streets.length} streets</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-sm text-bold">{formatPrice(area.avgPricePerSqm)}<span className="text-muted">/m²</span></div>
              <Chip label={area.popularity} variant={area.popularity === 'High' ? 'error' : 'accent'} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
