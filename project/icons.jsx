// Shelfy icons — single inline SVG component
function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.7, style }) {
  const s = { width: size, height: size, display: 'inline-block', verticalAlign: 'middle', ...style };
  const stroke = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const fill = { fill: color };
  switch (name) {
    case 'pantry':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M4 8h16M4 8v12h16V8M4 8l2-4h12l2 4M9 12v4M15 12v4" {...stroke}/></svg>);
    case 'bell':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7zM10 19a2 2 0 0 0 4 0" {...stroke}/></svg>);
    case 'chef':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M7 14a4 4 0 1 1 2-7.5A4 4 0 0 1 17 8a4 4 0 0 1 0 6H7zM7 14v5h10v-5" {...stroke}/></svg>);
    case 'scan':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3M3 12h18" {...stroke}/></svg>);
    case 'plus':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M5 12h14" {...stroke}/></svg>);
    case 'x':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M6 6l12 12M18 6L6 18" {...stroke}/></svg>);
    case 'chevron-left':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M15 6l-6 6 6 6" {...stroke}/></svg>);
    case 'chevron-right':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M9 6l6 6-6 6" {...stroke}/></svg>);
    case 'chevron-down':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M6 9l6 6 6-6" {...stroke}/></svg>);
    case 'search':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="11" cy="11" r="6.5" {...stroke}/><path d="M16.5 16.5L21 21" {...stroke}/></svg>);
    case 'filter':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M4 6h16M7 12h10M10 18h4" {...stroke}/></svg>);
    case 'fridge':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="6" y="3" width="12" height="18" rx="2" {...stroke}/><path d="M6 10h12M9 6.5v1.5M9 13v3" {...stroke}/></svg>);
    case 'freezer':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 3v18M5 7l14 10M5 17L19 7M9 4l3 2 3-2M9 20l3-2 3 2M3 9l2 3-2 3M21 9l-2 3 2 3" {...stroke}/></svg>);
    case 'box':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" {...stroke}/></svg>);
    case 'clock':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...stroke}/><path d="M12 7v5l3 2" {...stroke}/></svg>);
    case 'flame':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 0 0 2 1 3-3z" {...stroke}/></svg>);
    case 'check':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M5 12l4 4 10-10" {...stroke}/></svg>);
    case 'edit':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M14 4l6 6L8 22H2v-6L14 4zM12 6l6 6" {...stroke}/></svg>);
    case 'trash':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" {...stroke}/></svg>);
    case 'share':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="6" cy="12" r="2.5" {...stroke}/><circle cx="18" cy="6" r="2.5" {...stroke}/><circle cx="18" cy="18" r="2.5" {...stroke}/><path d="M8 11l8-4M8 13l8 4" {...stroke}/></svg>);
    case 'shopping':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M4 7h16l-2 11H6L4 7zM9 7V5a3 3 0 0 1 6 0v2" {...stroke}/></svg>);
    case 'minus':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M5 12h14" {...stroke}/></svg>);
    case 'leaf':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M20 4C8 4 4 10 4 16c0 2 1 4 1 4s8 0 12-4 3-12 3-12zM4 20l8-8" {...stroke}/></svg>);
    case 'sparkles':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" {...stroke}/></svg>);
    case 'flash':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" {...stroke}/></svg>);
    case 'image':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="3" y="5" width="18" height="14" rx="2" {...stroke}/><circle cx="9" cy="10" r="1.5" {...fill}/><path d="M5 18l5-5 4 4 3-3 4 4" {...stroke}/></svg>);
    case 'qr':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="3" y="3" width="7" height="7" rx="1" {...stroke}/><rect x="14" y="3" width="7" height="7" rx="1" {...stroke}/><rect x="3" y="14" width="7" height="7" rx="1" {...stroke}/><path d="M14 14h3v3M20 14v3M14 20h3M20 20v.01" {...stroke}/></svg>);
    case 'bolt':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M13 2L3 14h7l-1 8 11-13h-7l0-7z" {...stroke}/></svg>);
    default:
      return null;
  }
}
window.Icon = Icon;
