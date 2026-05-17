// Shared components: theme, tiles, buttons, urgency utilities
const T = {
  ink: '#1a2018',
  ink2: '#525a4f',
  mute: '#8b9387',
  line: 'rgba(40, 50, 35, 0.10)',
  bg: '#f5f3ec',
  surface: '#ffffff',
  primary: '#2f4a31',       // forest
  primaryInk: '#0d1f10',
  primarySoft: '#dde6d6',
  sage: '#bdc9ad',
  warn: '#c08833',          // amber
  warnSoft: '#f6e7c6',
  urgent: '#bd4a30',        // terracotta
  urgentSoft: '#f3d6c9',
  ok: '#3f7a4a',
  okSoft: '#dce9d5',
};
window.T = T;

// Urgency classification by days remaining
function urgencyOf(days) {
  if (days < 0)  return { key: 'scaduto',   label: 'Scaduto',          color: T.urgent, soft: T.urgentSoft, ink: '#4d1a10' };
  if (days === 0) return { key: 'oggi',     label: 'Scade oggi',       color: T.urgent, soft: T.urgentSoft, ink: '#4d1a10' };
  if (days === 1) return { key: 'domani',   label: 'Scade domani',     color: T.warn,   soft: T.warnSoft,   ink: '#4a3414' };
  if (days <= 3)  return { key: 'urgente',  label: days + ' giorni',   color: T.warn,   soft: T.warnSoft,   ink: '#4a3414' };
  if (days <= 7)  return { key: 'prossimo', label: days + ' giorni',   color: T.ok,     soft: T.okSoft,     ink: '#1b3320' };
  if (days <= 30) return { key: 'ok',       label: days + ' giorni',   color: '#5f7a55', soft: '#e8ede0',   ink: '#2c3a26' };
  return            { key: 'lungo',         label: Math.round(days/30) + ' mesi', color: '#7a8473', soft: '#eceee5', ink: '#36392f' };
}
window.urgencyOf = urgencyOf;

// Soft tinted product tile — colored square w/ serif monogram
function FoodTile({ product, size = 56, radius = 14, fontScale = 1 }) {
  const initials = product.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: product.tint || T.primarySoft,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: 'inset 0 0 0 0.5px rgba(40, 50, 35, 0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5,
        background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.7), transparent 55%)',
      }} />
      <span style={{
        fontFamily: '"Instrument Serif", "Times New Roman", serif',
        fontSize: size * 0.5 * fontScale, fontStyle: 'italic', fontWeight: 400,
        color: 'rgba(20, 28, 16, 0.78)', letterSpacing: -0.5, position: 'relative',
      }}>{initials}</span>
    </div>
  );
}
window.FoodTile = FoodTile;

// Generic surface card
function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.surface, borderRadius: 20, padding: 14,
      boxShadow: '0 1px 0 rgba(40,50,35,0.04), 0 6px 18px -10px rgba(40,50,35,0.18)',
      ...style,
    }}>{children}</div>
  );
}
window.Card = Card;

// Pill button (primary / ghost)
function Pill({ children, onClick, variant = 'primary', size = 'md', style }) {
  const sizes = { sm: { p: '8px 14px', f: 13 }, md: { p: '12px 18px', f: 14 }, lg: { p: '16px 24px', f: 16 } };
  const sz = sizes[size];
  const variants = {
    primary: { background: T.primary, color: '#fbfaf3', border: 'none' },
    ghost:   { background: 'transparent', color: T.primary, border: '1px solid ' + T.line },
    soft:    { background: T.primarySoft, color: T.primaryInk, border: 'none' },
    warn:    { background: T.warn, color: '#fff', border: 'none' },
    danger:  { background: T.urgent, color: '#fff', border: 'none' },
  };
  return (
    <button onClick={onClick} style={{
      ...variants[variant], padding: sz.p, fontSize: sz.f, fontWeight: 600,
      borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
      letterSpacing: -0.1, display: 'inline-flex', alignItems: 'center', gap: 6,
      ...style,
    }}>{children}</button>
  );
}
window.Pill = Pill;

// Floating Action Button — primary scan
function FAB({ onClick, label = 'Scansiona' }) {
  return (
    <button onClick={onClick} style={{
      position: 'absolute', bottom: 92, right: 18, zIndex: 30,
      background: T.primary, color: '#fbfaf3', border: 'none', cursor: 'pointer',
      borderRadius: 100, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: 'inherit', fontWeight: 600, fontSize: 14, letterSpacing: -0.1,
      boxShadow: '0 12px 28px -10px rgba(20,40,18,0.55), 0 2px 4px rgba(0,0,0,0.15)',
    }}>
      <Icon name="scan" size={20} color="#fbfaf3" />
      {label}
    </button>
  );
}
window.FAB = FAB;

// Bottom navigation bar
function BottomNav({ screen, setScreen }) {
  const items = [
    { id: 'home', label: 'Dispensa', icon: 'pantry' },
    { id: 'notifications', label: 'Avvisi', icon: 'bell' },
    { id: 'recipes', label: 'Ricette', icon: 'chef' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 25,
      paddingBottom: 28, paddingTop: 8, paddingLeft: 12, paddingRight: 12,
      background: 'linear-gradient(to top, rgba(245,243,236,0.96) 60%, rgba(245,243,236,0))',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {items.map(it => {
        const active = screen === it.id;
        return (
          <button key={it.id} onClick={() => setScreen(it.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 18px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: active ? T.primary : T.mute, fontFamily: 'inherit',
            fontSize: 11, fontWeight: 600, letterSpacing: 0.2,
          }}>
            <Icon name={it.icon} size={22} color={active ? T.primary : T.mute} strokeWidth={active ? 2 : 1.7}/>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
window.BottomNav = BottomNav;

// Zone glyph (small icon used inline)
function ZoneIcon({ zone, size = 14, color }) {
  const map = { frigo: 'fridge', freezer: 'freezer', dispensa: 'box' };
  return <Icon name={map[zone] || 'box'} size={size} color={color || T.ink2} strokeWidth={1.7}/>;
}
window.ZoneIcon = ZoneIcon;

// Italian short-date formatter (e.g. 17 mag)
const _months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
function shortDate(iso) {
  const d = new Date(iso);
  return d.getDate() + ' ' + _months[d.getMonth()];
}
window.shortDate = shortDate;

// Section heading
function SectionTitle({ children, action, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '0 20px', marginBottom: 14, gap: 12, ...style,
    }}>
      <h3 style={{
        fontFamily: '"Instrument Serif", serif', fontWeight: 400, fontStyle: 'italic',
        fontSize: 22, color: T.ink, letterSpacing: -0.3, margin: 0, lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
      }}>{children}</h3>
      {action}
    </div>
  );
}
window.SectionTitle = SectionTitle;
