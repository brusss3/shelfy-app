// Scanner screen — fullscreen black "camera" with animated reticle
function ScannerScreen({ onCancel, onFound }) {
  const [phase, setPhase] = React.useState('scanning'); // scanning | found
  const [found, setFound] = React.useState(null);

  React.useEffect(() => {
    // Simulate the scanner picking a random product after ~2.6s
    const t = setTimeout(() => {
      const candidates = [
        { name: 'Burro 250g', brand: 'Lurpak', barcode: '5740900403642', qty: '250 g', category: 'Latticini', zone: 'frigo', tint: '#f6efde', suggestExpiry: 14 },
        { name: 'Mozzarella di bufala', brand: 'Mandara', barcode: '8003170012345', qty: '125 g', category: 'Latticini', zone: 'frigo', tint: '#f1ede0', suggestExpiry: 7 },
        { name: 'Tonno in olio', brand: 'Rio Mare', barcode: '8004030441002', qty: '3x80 g', category: 'Conserve', zone: 'dispensa', tint: '#f4ecdc', suggestExpiry: 720 },
      ];
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setFound(pick);
      setPhase('found');
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#0a0d09', zIndex: 100,
      overflow: 'hidden', color: '#fff',
    }}>
      {/* simulated camera blur backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 40%, #1c2a1d 0%, #0a0d09 70%)',
      }}/>
      {/* subtle film grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.4, mixBlendMode: 'overlay',
        backgroundImage: 'repeating-radial-gradient(circle at 30% 20%, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px), repeating-radial-gradient(circle at 70% 80%, rgba(255,255,255,0.03) 0 1px, transparent 1px 4px)',
      }}/>

      {/* top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '60px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button onClick={onCancel} style={{
          width: 40, height: 40, borderRadius: 100, background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="x" size={20} color="#fff"/>
        </button>
        <div style={{
          background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)', borderRadius: 100, padding: '8px 14px',
          fontSize: 12, fontWeight: 600, letterSpacing: 0.3, color: '#fbfaf3',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="qr" size={14} color="#fbfaf3"/> CODICE A BARRE
        </div>
        <button style={{
          width: 40, height: 40, borderRadius: 100, background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="flash" size={20} color="#fff"/>
        </button>
      </div>

      {/* center reticle */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -52%)',
        width: 280, height: 180,
      }}>
        {/* dark cutout shadow */}
        <div style={{
          position: 'absolute', inset: -2000, boxShadow: '0 0 0 2000px rgba(0,0,0,0.55)',
          borderRadius: 24, pointerEvents: 'none',
        }}/>
        {/* corners */}
        {[
          { top: 0, left: 0, b: '4px 0 0 4px', tl: true },
          { top: 0, right: 0, b: '0 4px 0 0', tr: true },
          { bottom: 0, left: 0, b: '0 0 0 4px', bl: true },
          { bottom: 0, right: 0, b: '0 0 4px 0', br: true },
        ].map((c, i) => (
          <div key={i} style={{
            position: 'absolute', width: 32, height: 32,
            borderColor: '#bdc9ad',
            borderStyle: 'solid',
            borderWidth: c.tl ? '3px 0 0 3px' : c.tr ? '3px 3px 0 0' : c.bl ? '0 0 0 3px' : '0 3px 3px 0',
            borderTopLeftRadius: c.tl ? 14 : 0,
            borderTopRightRadius: c.tr ? 14 : 0,
            borderBottomLeftRadius: c.bl ? 14 : 0,
            borderBottomRightRadius: c.br ? 14 : 0,
            top: c.top, bottom: c.bottom, left: c.left, right: c.right,
          }}/>
        ))}
        {/* scan line */}
        {phase === 'scanning' && (
          <div style={{
            position: 'absolute', left: 12, right: 12, top: 0, height: 2,
            background: 'linear-gradient(90deg, transparent, #bdc9ad 50%, transparent)',
            boxShadow: '0 0 18px 2px rgba(189,201,173,0.7)',
            animation: 'shelfyScan 1.8s ease-in-out infinite',
          }}/>
        )}
        {/* found pulse */}
        {phase === 'found' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#3a7a4a', borderRadius: 100, padding: 14,
              boxShadow: '0 0 0 8px rgba(58,122,74,0.25), 0 0 24px rgba(58,122,74,0.5)',
            }}>
              <Icon name="check" size={28} color="#fff" strokeWidth={2.5}/>
            </div>
          </div>
        )}
      </div>

      {/* status text */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 'calc(50% + 140px)', textAlign: 'center',
        zIndex: 5,
      }}>
        <div style={{
          fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontSize: 26,
          color: '#fbfaf3', letterSpacing: -0.4,
        }}>
          {phase === 'scanning' ? 'Inquadra il codice…' : 'Trovato!'}
        </div>
        <div style={{
          fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, padding: '0 40px',
        }}>
          {phase === 'scanning'
            ? 'Tieni fermo per qualche secondo'
            : found && (found.brand + ' · ' + found.name)}
        </div>
      </div>

      {/* bottom sheet on found */}
      {phase === 'found' && found && (
        <FoundSheet product={found} onConfirm={() => onFound(found)} onRetry={() => { setPhase('scanning'); setFound(null); setTimeout(() => { setPhase('found'); setFound(found); }, 2200); }}/>
      )}

      {/* manual entry option */}
      {phase === 'scanning' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 50, textAlign: 'center',
        }}>
          <button onClick={onCancel} style={{
            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)', color: '#fbfaf3',
            border: 'none', borderRadius: 100, padding: '12px 22px', cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14, letterSpacing: -0.1,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Icon name="edit" size={16} color="#fbfaf3"/> Inserisci manualmente
          </button>
        </div>
      )}
    </div>
  );
}

function FoundSheet({ product, onConfirm, onRetry }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
      background: T.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: '24px 20px 36px',
      boxShadow: '0 -12px 36px rgba(0,0,0,0.3)',
      animation: 'shelfySheetIn 0.34s cubic-bezier(0.2, 0.8, 0.2, 1)',
    }}>
      <div style={{
        width: 36, height: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 100,
        margin: '0 auto 18px',
      }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <FoodTile product={product} size={64} radius={16}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: 0.4, textTransform: 'uppercase' }}>{product.brand}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.2, marginTop: 2 }}>{product.name}</div>
          <div style={{ fontSize: 12, color: T.mute, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="qr" size={12} color={T.mute}/> {product.barcode}
          </div>
        </div>
      </div>
      <div style={{
        background: T.primarySoft, borderRadius: 14, padding: 12, fontSize: 12,
        color: T.primaryInk, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      }}>
        <Icon name="sparkles" size={16} color={T.primary}/>
        <span><b>Scadenza suggerita:</b> circa {product.suggestExpiry} giorni · {product.zone}</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Pill variant="ghost" size="lg" onClick={onRetry} style={{ flex: 1, justifyContent: 'center' }}>Rifai scansione</Pill>
        <Pill variant="primary" size="lg" onClick={onConfirm} style={{ flex: 1.4, justifyContent: 'center' }}>
          Aggiungi <Icon name="chevron-right" size={16} color="#fbfaf3"/>
        </Pill>
      </div>
    </div>
  );
}

window.ScannerScreen = ScannerScreen;
