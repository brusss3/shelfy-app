// Add Product screen — manual or post-scan
function AddScreen({ scanned, onCancel, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultExpiry = new Date(Date.now() + (scanned?.suggestExpiry || 7) * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [name, setName] = React.useState(scanned?.name || '');
  const [brand, setBrand] = React.useState(scanned?.brand || '');
  const [qty, setQty] = React.useState(scanned?.qty || '');
  const [zone, setZone] = React.useState(scanned?.zone || 'frigo');
  const [expiry, setExpiry] = React.useState(defaultExpiry);

  const zones = [
    { id: 'frigo', label: 'Frigo', icon: 'fridge' },
    { id: 'freezer', label: 'Freezer', icon: 'freezer' },
    { id: 'dispensa', label: 'Dispensa', icon: 'box' },
  ];

  return (
    <div style={{ background: T.bg, minHeight: '100%', paddingBottom: 110 }}>
      {/* header */}
      <div style={{
        padding: '60px 16px 14px', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <button onClick={onCancel} style={{
          width: 40, height: 40, borderRadius: 100, background: T.surface, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
        }}>
          <Icon name="x" size={20} color={T.ink}/>
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: T.ink2 }}>
          Nuovo prodotto
        </div>
        <div style={{ width: 40 }}/>
      </div>

      {/* product header */}
      <div style={{
        display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 10,
        padding: '0 20px 24px',
      }}>
        <FoodTile product={{ name: name || 'Nuovo', tint: scanned?.tint || T.primarySoft }} size={92} radius={22}/>
        <div style={{
          fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontSize: 28,
          color: T.ink, letterSpacing: -0.4, textAlign: 'center',
        }}>{name || 'Senza nome'}</div>
        {scanned && (
          <div style={{
            background: T.surface, borderRadius: 100, padding: '6px 12px',
            fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="qr" size={12} color={T.mute}/> {scanned.barcode}
          </div>
        )}
      </div>

      {/* form */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card style={{ padding: 0 }}>
          <Field label="Nome">
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle}/>
          </Field>
          <Divider/>
          <Field label="Marca">
            <input value={brand} onChange={e => setBrand(e.target.value)} style={inputStyle}/>
          </Field>
          <Divider/>
          <Field label="Quantità">
            <input value={qty} onChange={e => setQty(e.target.value)} style={inputStyle}/>
          </Field>
        </Card>

        {/* zone */}
        <div style={{ marginTop: 4 }}>
          <Label>Conservazione</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {zones.map(z => {
              const active = zone === z.id;
              return (
                <button key={z.id} onClick={() => setZone(z.id)} style={{
                  flex: 1, background: active ? T.primary : T.surface,
                  color: active ? '#fbfaf3' : T.ink, border: 'none', cursor: 'pointer',
                  borderRadius: 16, padding: '14px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
                  boxShadow: active ? 'inset 0 0 0 0.5px rgba(0,0,0,0.1)' : '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
                }}>
                  <Icon name={z.icon} size={22} color={active ? '#fbfaf3' : T.ink}/>
                  {z.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* expiry */}
        <div style={{ marginTop: 4 }}>
          <Label>Scadenza</Label>
          <Card style={{ padding: 0 }}>
            <Field label="Data">
              <input type="date" value={expiry} min={today}
                onChange={e => setExpiry(e.target.value)} style={inputStyle}/>
            </Field>
            <Divider/>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: T.mute }}>Rimangono</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.primaryInk }}>
                {SHELFY_DATA.daysTo(expiry)} giorni
              </span>
            </div>
          </Card>
          {/* quick presets */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { d: 3, l: '3 giorni' }, { d: 7, l: '1 settimana' },
              { d: 30, l: '1 mese' }, { d: 180, l: '6 mesi' }, { d: 365, l: '1 anno' },
            ].map(p => (
              <button key={p.d} onClick={() => {
                setExpiry(new Date(Date.now() + p.d * 86400000).toISOString().slice(0, 10));
              }} style={{
                background: T.surface, color: T.ink2, border: 'none', borderRadius: 100,
                padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: 0.1,
                boxShadow: '0 1px 0 rgba(40,50,35,0.04)',
              }}>+ {p.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* sticky save */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 12,
        padding: '12px 20px 28px',
        background: 'linear-gradient(to top, rgba(245,243,236,0.98) 50%, rgba(245,243,236,0))',
        display: 'flex', gap: 10,
      }}>
        <Pill variant="ghost" size="lg" onClick={onCancel} style={{ flex: 1, justifyContent: 'center' }}>Annulla</Pill>
        <Pill variant="primary" size="lg" onClick={() => onSave({
          name, brand, qty, zone, expiry,
          barcode: scanned?.barcode,
          tint: scanned?.tint || T.primarySoft,
          category: scanned?.category || '',
        })} style={{ flex: 1.8, justifyContent: 'center' }}>
          <Icon name="check" size={18} color="#fbfaf3"/> Salva nel diario
        </Pill>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink2, width: 80 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </label>
  );
}
function Divider() {
  return <div style={{ height: 0.5, background: T.line, marginLeft: 16 }}/>;
}
function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: T.mute, textTransform: 'uppercase',
      letterSpacing: 0.6, padding: '0 8px 8px',
    }}>{children}</div>
  );
}
const inputStyle = {
  border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit',
  fontSize: 15, color: T.ink, width: '100%', padding: 0, fontWeight: 500, letterSpacing: -0.1,
};

window.AddScreen = AddScreen;
