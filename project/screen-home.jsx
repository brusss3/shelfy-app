// Home / Dispensa screen
function HomeScreen({ products, setScreen, openProduct, startScan }) {
  const [zone, setZone] = React.useState('all');
  const [query, setQuery] = React.useState('');

  const zones = [
    { id: 'all', label: 'Tutto', icon: null },
    { id: 'frigo', label: 'Frigo', icon: 'fridge' },
    { id: 'freezer', label: 'Freezer', icon: 'freezer' },
    { id: 'dispensa', label: 'Dispensa', icon: 'box' },
  ];

  const filtered = products
    .filter(p => zone === 'all' || p.zone === zone)
    .filter(p => !query || (p.name + ' ' + p.brand).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => SHELFY_DATA.daysTo(a.expiry) - SHELFY_DATA.daysTo(b.expiry));

  const urgentCount = products.filter(p => SHELFY_DATA.daysTo(p.expiry) <= 3 && SHELFY_DATA.daysTo(p.expiry) >= 0).length;
  const expiredCount = products.filter(p => SHELFY_DATA.daysTo(p.expiry) < 0).length;
  const total = products.length;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buongiorno' : hour < 19 ? 'Buon pomeriggio' : 'Buonasera';

  return (
    <div style={{ background: T.bg, minHeight: '100%', paddingBottom: 110 }}>
      {/* Header */}
      <div style={{ padding: '64px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: T.mute, fontWeight: 500, letterSpacing: 0.1 }}>{greet}, Marta</div>
            <h1 style={{
              fontFamily: '"Instrument Serif", serif', fontWeight: 400, fontStyle: 'italic',
              fontSize: 40, color: T.ink, margin: '4px 0 0', padding: '0 0 6px',
              letterSpacing: -1, lineHeight: 1.2,
            }}>La tua dispensa</h1>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: 100, background: T.primarySoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Instrument Serif", serif', fontSize: 22, color: T.primaryInk,
            fontStyle: 'italic',
          }}>M</div>
        </div>

        {/* Stats row */}
        <div style={{
          marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        }}>
          <StatCard value={total} label="In dispensa" color={T.ink}/>
          <StatCard value={urgentCount} label="Urgenti" color={urgentCount > 0 ? T.warn : T.mute}/>
          <StatCard value={expiredCount} label="Scaduti" color={expiredCount > 0 ? T.urgent : T.mute}/>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, background: T.surface,
          borderRadius: 100, padding: '10px 16px',
          boxShadow: '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
        }}>
          <Icon name="search" size={18} color={T.mute}/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Cerca un prodotto…"
            style={{
              border: 'none', outline: 'none', flex: 1, background: 'transparent',
              fontFamily: 'inherit', fontSize: 14, color: T.ink,
            }}/>
        </div>
      </div>

      {/* Zone chips */}
      <div style={{
        display: 'flex', gap: 8, padding: '0 20px 14px', overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {zones.map(z => {
          const active = zone === z.id;
          return (
            <button key={z.id} onClick={() => setZone(z.id)} style={{
              background: active ? T.primary : T.surface,
              color: active ? '#fbfaf3' : T.ink,
              border: 'none', cursor: 'pointer', flexShrink: 0,
              borderRadius: 100, padding: '8px 14px',
              fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: active ? 'none' : '0 1px 0 rgba(40,50,35,0.04), 0 4px 12px -8px rgba(40,50,35,0.18)',
            }}>
              {z.icon && <Icon name={z.icon} size={15} color={active ? '#fbfaf3' : T.ink}/>}
              {z.label}
            </button>
          );
        })}
      </div>

      {/* Priority alert banner */}
      {(urgentCount + expiredCount > 0) && (
        <div style={{ padding: '4px 20px 14px' }}>
          <Card style={{
            background: 'linear-gradient(135deg, #f9e6c8, #f3d1b4)',
            padding: 16, display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: 'none', border: '0.5px solid rgba(140, 90, 30, 0.15)',
          }} onClick={() => setScreen('notifications')}>
            <div style={{
              width: 44, height: 44, borderRadius: 100,
              background: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="flame" size={22} color="#a86322"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4a3414' }}>
                {urgentCount + expiredCount} prodotti richiedono attenzione
              </div>
              <div style={{ fontSize: 12, color: '#7a5a26', marginTop: 2 }}>
                Tocca per vedere i suggerimenti
              </div>
            </div>
            <Icon name="chevron-right" size={20} color="#a86322"/>
          </Card>
        </div>
      )}

      {/* Product list */}
      <SectionTitle action={
        <span style={{ fontSize: 12, color: T.mute }}>
          {filtered.length} {filtered.length === 1 ? 'prodotto' : 'prodotti'}
        </span>
      }>In scadenza prima</SectionTitle>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(p => <ProductRow key={p.id} product={p} onClick={() => openProduct(p.id)}/>)}
        {filtered.length === 0 && (
          <div style={{
            padding: '40px 20px', textAlign: 'center', color: T.mute, fontSize: 14,
          }}>Nessun prodotto trovato.</div>
        )}
      </div>

      <FAB onClick={startScan}/>
    </div>
  );
}

function StatCard({ value, label, color }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 18, padding: '14px 12px',
      boxShadow: '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
    }}>
      <div style={{
        fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
        fontSize: 32, color, letterSpacing: -0.5, lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 11, color: T.mute, marginTop: 4, fontWeight: 500, letterSpacing: 0.1 }}>{label}</div>
    </div>
  );
}

function ProductRow({ product, onClick }) {
  const days = SHELFY_DATA.daysTo(product.expiry);
  const u = urgencyOf(days);
  return (
    <div onClick={onClick} style={{
      background: T.surface, borderRadius: 18, padding: 12, display: 'flex', gap: 12, alignItems: 'center',
      boxShadow: '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
      cursor: 'pointer',
    }}>
      <FoodTile product={product} size={52} radius={14}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
        <div style={{ fontSize: 12, color: T.mute, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ZoneIcon zone={product.zone} size={12}/> {product.qty} · {product.brand}
        </div>
      </div>
      <div style={{
        background: u.soft, color: u.ink, borderRadius: 100, padding: '6px 10px',
        fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: 0.1,
      }}>{u.label}</div>
    </div>
  );
}

window.HomeScreen = HomeScreen;
