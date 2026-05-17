// Notifications screen — priority cards with suggested actions
function NotificationsScreen({ products, openProduct, openRecipe, onAction }) {
  // Bucket by urgency
  const scaduti = products.filter(p => SHELFY_DATA.daysTo(p.expiry) < 0);
  const oggi    = products.filter(p => SHELFY_DATA.daysTo(p.expiry) === 0);
  const urgenti = products.filter(p => { const d = SHELFY_DATA.daysTo(p.expiry); return d > 0 && d <= 3; });
  const prossimi = products.filter(p => { const d = SHELFY_DATA.daysTo(p.expiry); return d > 3 && d <= 7; });

  return (
    <div style={{ background: T.bg, minHeight: '100%', paddingBottom: 110 }}>
      <div style={{ padding: '64px 20px 14px' }}>
        <div style={{ fontSize: 13, color: T.mute, fontWeight: 500 }}>Avvisi & azioni</div>
        <h1 style={{
          fontFamily: '"Instrument Serif", serif', fontWeight: 400, fontStyle: 'italic',
          fontSize: 40, color: T.ink, margin: '4px 0 14px', padding: '0 0 4px',
          letterSpacing: -1, lineHeight: 1.2,
        }}>Da gestire oggi</h1>

        {/* summary chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SummaryChip count={scaduti.length} label="scaduti" tone="urgent"/>
          <SummaryChip count={oggi.length} label="oggi"      tone="urgent"/>
          <SummaryChip count={urgenti.length} label="entro 3 giorni" tone="warn"/>
          <SummaryChip count={prossimi.length} label="questa settimana" tone="ok"/>
        </div>
      </div>

      {scaduti.length > 0 && (
        <Section title="Scaduti">
          {scaduti.map(p => <PriorityCard key={p.id} product={p} urgency="scaduto"
            onOpen={() => openProduct(p.id)} onAction={onAction}/>)}
        </Section>
      )}
      {oggi.length > 0 && (
        <Section title="Scadono oggi">
          {oggi.map(p => <PriorityCard key={p.id} product={p} urgency="oggi"
            onOpen={() => openProduct(p.id)} onAction={onAction} onRecipe={openRecipe}/>)}
        </Section>
      )}
      {urgenti.length > 0 && (
        <Section title="Nei prossimi giorni">
          {urgenti.map(p => <PriorityCard key={p.id} product={p} urgency="urgente"
            onOpen={() => openProduct(p.id)} onAction={onAction} onRecipe={openRecipe}/>)}
        </Section>
      )}
      {prossimi.length > 0 && (
        <Section title="Questa settimana">
          {prossimi.map(p => <PriorityCard key={p.id} product={p} urgency="prossimo"
            onOpen={() => openProduct(p.id)} onAction={onAction} compact/>)}
        </Section>
      )}

      {(scaduti.length + oggi.length + urgenti.length + prossimi.length) === 0 && (
        <EmptyState/>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function SummaryChip({ count, label, tone }) {
  const palette = {
    urgent: { bg: T.urgentSoft, ink: '#4d1a10', dot: T.urgent },
    warn:   { bg: T.warnSoft,   ink: '#4a3414', dot: T.warn },
    ok:     { bg: T.okSoft,     ink: '#1b3320', dot: T.ok },
  }[tone];
  return (
    <div style={{
      background: palette.bg, color: palette.ink, padding: '8px 12px', borderRadius: 100,
      fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 100, background: palette.dot }}/>
      <b style={{ fontWeight: 800 }}>{count}</b> {label}
    </div>
  );
}

function PriorityCard({ product, urgency, onOpen, onAction, onRecipe, compact }) {
  const days = SHELFY_DATA.daysTo(product.expiry);
  const u = urgencyOf(days);

  // Suggested actions vary by urgency + zone
  const actions = [];
  if (urgency === 'scaduto') {
    actions.push({ id: 'remove', label: 'Rimuovi', icon: 'trash', variant: 'danger' });
    actions.push({ id: 'log', label: 'Spreco?', icon: 'edit', variant: 'soft' });
  } else if (urgency === 'oggi' || urgency === 'urgente') {
    if (product.zone === 'frigo' || product.zone === 'dispensa') {
      actions.push({ id: 'cook', label: 'Cucina ora', icon: 'flame', variant: 'primary' });
    }
    if (product.zone === 'frigo' && ['Pesce','Carne','Pane','Verdura'].includes(product.category)) {
      actions.push({ id: 'freeze', label: 'In freezer', icon: 'freezer', variant: 'soft' });
    }
    actions.push({ id: 'consumed', label: 'Consumato', icon: 'check', variant: 'ghost' });
  } else {
    actions.push({ id: 'consumed', label: 'Consumato', icon: 'check', variant: 'ghost' });
    actions.push({ id: 'remind', label: 'Ricorda', icon: 'bell', variant: 'soft' });
  }

  if (compact) {
    return (
      <Card style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }} onClick={onOpen}>
        <FoodTile product={product} size={48} radius={12}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
          <div style={{ fontSize: 12, color: T.mute, marginTop: 2 }}>
            Scade {shortDate(product.expiry)} · {product.zone}
          </div>
        </div>
        <span style={{
          background: u.soft, color: u.ink, borderRadius: 100, padding: '5px 10px',
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
        }}>{u.label}</span>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* urgency strip */}
      <div style={{
        height: 4, background: u.color,
      }}/>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} onClick={onOpen}>
          <FoodTile product={product} size={56} radius={14}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{
                background: u.soft, color: u.ink, borderRadius: 100, padding: '3px 8px',
                fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
              }}>{u.label}</span>
              <span style={{ fontSize: 11, color: T.mute, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ZoneIcon zone={product.zone} size={11}/> {product.zone}
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: -0.2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
            <div style={{ fontSize: 12, color: T.mute, marginTop: 2 }}>
              {product.qty} · {product.brand}
            </div>
          </div>
        </div>

        {/* suggestion */}
        <div style={{
          marginTop: 12, background: T.bg, borderRadius: 12, padding: 10,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Icon name="sparkles" size={14} color={T.primary}/>
          <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.4 }}>
            {suggestionFor(product, urgency)}
          </div>
        </div>

        {/* actions */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions.map(a => (
            <Pill key={a.id} variant={a.variant} size="sm" onClick={(e) => {
              e.stopPropagation();
              if (a.id === 'cook' && onRecipe) onRecipe(product);
              else onAction(product.id, a.id);
            }}>
              <Icon name={a.icon} size={14} color={
                a.variant === 'primary' || a.variant === 'danger' || a.variant === 'warn' ? '#fbfaf3' :
                a.variant === 'soft' ? T.primaryInk : T.primary
              }/>
              {a.label}
            </Pill>
          ))}
        </div>
      </div>
    </Card>
  );
}

function suggestionFor(product, urgency) {
  if (urgency === 'scaduto') return 'Verifica se è ancora sicuro o registralo come spreco per migliorare le statistiche.';
  if (product.zone === 'frigo' && ['Carne','Pesce','Pane','Verdura'].includes(product.category))
    return 'Puoi congelarlo per estenderne la durata fino a 3 mesi.';
  if (product.category === 'Latticini') return 'Perfetto per una frittata, una crema o un risotto.';
  if (product.category === 'Verdura')   return 'Ottimo per un soffritto veloce o una vellutata.';
  if (product.category === 'Pasta' || product.category === 'Riso') return 'Provalo con i pomodorini che hai in frigo.';
  return 'Ti suggeriamo di consumarlo presto o cucinarlo questa sera.';
}

function EmptyState() {
  return (
    <div style={{ padding: '40px 32px', textAlign: 'center' }}>
      <div style={{
        width: 80, height: 80, borderRadius: 100, background: T.okSoft,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Icon name="leaf" size={36} color={T.ok}/>
      </div>
      <div style={{
        fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
        fontSize: 26, color: T.ink, letterSpacing: -0.4,
      }}>Tutto sotto controllo</div>
      <div style={{ fontSize: 13, color: T.mute, marginTop: 6 }}>
        Nessun prodotto in scadenza nei prossimi giorni.
      </div>
    </div>
  );
}

window.NotificationsScreen = NotificationsScreen;
