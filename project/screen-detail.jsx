// Product Detail screen
function DetailScreen({ product, onBack, onDelete, onMoveZone }) {
  if (!product) return null;
  const days = SHELFY_DATA.daysTo(product.expiry);
  const u = urgencyOf(days);
  const totalDays = Math.max(1, SHELFY_DATA.daysTo(product.expiry) - SHELFY_DATA.daysTo(product.added));
  const elapsed = Math.max(0, Math.min(1, (SHELFY_DATA.daysTo(new Date().toISOString().slice(0,10)) - SHELFY_DATA.daysTo(product.added)) / totalDays));

  return (
    <div style={{ background: T.bg, minHeight: '100%', paddingBottom: 120 }}>
      {/* header */}
      <div style={{
        padding: '60px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={onBack} style={iconBtn}>
          <Icon name="chevron-left" size={22} color={T.ink}/>
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={iconBtn}><Icon name="share" size={18} color={T.ink}/></button>
          <button style={iconBtn}><Icon name="edit" size={18} color={T.ink}/></button>
        </div>
      </div>

      {/* hero */}
      <div style={{
        margin: '8px 20px 18px', padding: 24, borderRadius: 28,
        background: product.tint || T.primarySoft,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.5), transparent 60%)',
        }}/>
        <div style={{
          fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
          fontSize: 110, color: 'rgba(20, 28, 16, 0.78)', lineHeight: 0.9, position: 'relative',
          letterSpacing: -3,
        }}>
          {product.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
        </div>
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(20,28,16,0.55)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{product.brand}</div>
          <div style={{
            fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
            fontSize: 30, color: T.ink, marginTop: 4, letterSpacing: -0.5, lineHeight: 1.1,
          }}>{product.name}</div>
          <div style={{ fontSize: 12, color: T.ink2, marginTop: 6 }}>{product.qty} · {product.category}</div>
        </div>
      </div>

      {/* expiry status card */}
      <div style={{ padding: '0 20px 14px' }}>
        <Card style={{
          background: u.soft, padding: 18, boxShadow: 'none',
          border: '0.5px solid rgba(40,50,35,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 100,
              background: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="clock" size={26} color={u.color}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: u.ink, letterSpacing: 0.4, textTransform: 'uppercase' }}>{u.label}</div>
              <div style={{
                fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
                fontSize: 28, color: u.ink, letterSpacing: -0.4, lineHeight: 1,
              }}>{shortDate(product.expiry)}</div>
              <div style={{ fontSize: 12, color: u.ink, opacity: 0.7, marginTop: 4 }}>
                Aggiunto il {shortDate(product.added)}
              </div>
            </div>
          </div>
          {/* progress bar */}
          <div style={{
            marginTop: 14, height: 6, background: 'rgba(255,255,255,0.5)', borderRadius: 100,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: (elapsed * 100) + '%',
              background: u.color, borderRadius: 100,
            }}/>
          </div>
        </Card>
      </div>

      {/* details list */}
      <SectionTitle>Conservazione</SectionTitle>
      <div style={{ padding: '0 20px', marginBottom: 18 }}>
        <Card style={{ padding: 0 }}>
          {[
            { id: 'frigo', label: 'Frigo', icon: 'fridge', sub: '4 °C' },
            { id: 'freezer', label: 'Freezer', icon: 'freezer', sub: '-18 °C' },
            { id: 'dispensa', label: 'Dispensa', icon: 'box', sub: 'Asciutto' },
          ].map((z, i, arr) => {
            const active = product.zone === z.id;
            return (
              <React.Fragment key={z.id}>
                <div onClick={() => onMoveZone && onMoveZone(z.id)} style={{
                  display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 14, cursor: 'pointer',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: active ? T.primary : T.primarySoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={z.icon} size={20} color={active ? '#fbfaf3' : T.primaryInk}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{z.label}</div>
                    <div style={{ fontSize: 11, color: T.mute, marginTop: 1 }}>{z.sub}</div>
                  </div>
                  {active && (
                    <div style={{
                      width: 22, height: 22, borderRadius: 100, background: T.primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="check" size={14} color="#fbfaf3" strokeWidth={2.5}/>
                    </div>
                  )}
                </div>
                {i < arr.length - 1 && <Divider/>}
              </React.Fragment>
            );
          })}
        </Card>
      </div>

      {/* info */}
      <SectionTitle>Dettagli</SectionTitle>
      <div style={{ padding: '0 20px', marginBottom: 18 }}>
        <Card style={{ padding: 0 }}>
          <Row label="Codice a barre" value={product.barcode}/>
          <Divider/>
          <Row label="Categoria" value={product.category}/>
          <Divider/>
          <Row label="Apporto" value={product.cal + ' kcal / 100g'}/>
        </Card>
      </div>

      {/* destructive */}
      <div style={{ padding: '0 20px' }}>
        <Pill variant="ghost" size="lg" onClick={() => onDelete(product.id)} style={{
          color: T.urgent, width: '100%', justifyContent: 'center',
          borderColor: 'rgba(189,74,48,0.2)',
        }}>
          <Icon name="trash" size={16} color={T.urgent}/> Rimuovi dalla dispensa
        </Pill>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12 }}>
      <span style={{ fontSize: 13, color: T.mute, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 14, color: T.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

const iconBtn = {
  width: 40, height: 40, borderRadius: 100, background: T.surface,
  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
};

window.DetailScreen = DetailScreen;
