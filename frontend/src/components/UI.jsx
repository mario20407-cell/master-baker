// ─────────────────────────────────────────────────────────────
// Master Baker — Sistema de Componentes UI v1.0
// Paleta: Navy #1B2A4A | Gray #888B8D | Gold #C29C53 | White #fff
// ─────────────────────────────────────────────────────────────

// ── CARD ─────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff',
      border: '0.5px solid #c8cbcd',
      borderRadius: 10,
      padding: '16px',
      ...style
    }}>
      {children}
    </div>
  )
}

// ── KPI CARD ─────────────────────────────────────────────────
const kpiColors = {
  navy:  '#1B2A4A',
  green: '#1A7A4A',
  red:   '#C0392B',
  gold:  '#C29C53',
  amber: '#D68910',
  blue:  '#2980B9',
  gray:  '#888B8D',
}

export function KpiCard({ label, value, sub, color = 'navy', style = {} }) {
  return (
    <div style={{
      background: '#fff',
      border: '0.5px solid #c8cbcd',
      borderRadius: 8,
      borderTop: `3px solid ${kpiColors[color] || color}`,
      padding: '10px 12px',
      ...style
    }}>
      <div style={{ color:'#888B8D', fontSize:9, textTransform:'uppercase', letterSpacing:'.03em', marginBottom:4 }}>{label}</div>
      <div style={{ color: kpiColors[color] || color, fontSize:22, fontWeight:700, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ color:'#888B8D', fontSize:9, marginTop:2 }}>{sub}</div>}
    </div>
  )
}

// ── PAGE HEADER ───────────────────────────────────────────────
export function PageHeader({ title, badge, actions, subtitle }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <h1 style={{ color:'#1B2A4A', fontSize:20, fontWeight:700, margin:0 }}>{title}</h1>
        {badge && <Badge variant={badge}>{badge}</Badge>}
        {subtitle && <span style={{ color:'#888B8D', fontSize:12 }}>{subtitle}</span>}
      </div>
      {actions && <div style={{ display:'flex', gap:8 }}>{actions}</div>}
    </div>
  )
}

// ── BADGE ─────────────────────────────────────────────────────
const badgeDefs = {
  NEW:    { bg:'#1A7A4A', color:'#fff' },
  CLAVE:  { bg:'#854F0B', color:'#fff' },
  DGI:    { bg:'#1B2A4A', color:'#fff' },
  NUEVO:  { bg:'#1A7A4A', color:'#fff' },
  BETA:   { bg:'#2980B9', color:'#fff' },
  PRO:    { bg:'#C29C53', color:'#fff' },
}

export function Badge({ children, variant, style = {} }) {
  const def = badgeDefs[variant] || { bg:'#888B8D', color:'#fff' }
  return (
    <span style={{
      fontSize:9, fontWeight:700,
      padding:'2px 6px', borderRadius:3,
      background: def.bg, color: def.color,
      ...style
    }}>{children}</span>
  )
}

// ── STATUS BADGE ─────────────────────────────────────────────
const statusDefs = {
  success: { bg:'#E8F5E9', color:'#1A7A4A' },
  danger:  { bg:'#FDEDEC', color:'#C0392B' },
  warning: { bg:'#FEF9E7', color:'#D68910' },
  info:    { bg:'#EBF5FB', color:'#2980B9' },
  neutral: { bg:'#f0f2f5', color:'#888B8D' },
}

export function StatusBadge({ children, status = 'neutral', style = {} }) {
  const def = statusDefs[status]
  return (
    <span style={{
      fontSize:10, fontWeight:700,
      padding:'2px 8px', borderRadius:4,
      background: def.bg, color: def.color,
      ...style
    }}>{children}</span>
  )
}

// ── BUTTON ───────────────────────────────────────────────────
const btnDefs = {
  primary:   { bg:'#1B2A4A', color:'#fff', border:'none' },
  secondary: { bg:'#fff', color:'#1B2A4A', border:'0.5px solid #c8cbcd' },
  danger:    { bg:'#C0392B', color:'#fff', border:'none' },
  gold:      { bg:'#C29C53', color:'#fff', border:'none' },
  ghost:     { bg:'transparent', color:'#1B2A4A', border:'0.5px solid #c8cbcd' },
}

export function Btn({ children, variant = 'secondary', onClick, icon: Icon, style = {}, disabled = false }) {
  const def = btnDefs[variant]
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display:'flex', alignItems:'center', gap:6,
      padding:'7px 14px',
      background: def.bg, color: def.color,
      border: def.border,
      borderRadius:7, fontSize:12, fontWeight:700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      ...style
    }}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  )
}

// ── CARD TITLE ───────────────────────────────────────────────
export function CardTitle({ children, icon: Icon }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
      {Icon && <Icon size={14} style={{ color:'#C29C53', flexShrink:0 }} />}
      <span style={{ color:'#1B2A4A', fontSize:12, fontWeight:700 }}>{children}</span>
    </div>
  )
}

// ── EMPTY STATE ──────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 16px', textAlign:'center' }}>
      {Icon && <Icon size={32} style={{ color:'#c8cbcd', marginBottom:10 }} />}
      <div style={{ color:'#1B2A4A', fontSize:13, fontWeight:700, marginBottom:4 }}>{title}</div>
      {sub && <div style={{ color:'#888B8D', fontSize:11, marginBottom:12 }}>{sub}</div>}
      {action}
    </div>
  )
}

// ── DATA ROW ─────────────────────────────────────────────────
export function DataRow({ label, value, valueColor = '#1B2A4A', border = true }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'6px 0',
      borderBottom: border ? '0.5px solid #f0f2f5' : 'none'
    }}>
      <span style={{ color:'#888B8D', fontSize:10, textTransform:'uppercase', letterSpacing:'.03em' }}>{label}</span>
      <span style={{ color:valueColor, fontSize:11, fontWeight:700 }}>{value}</span>
    </div>
  )
}

// ── MARGIN BAR ───────────────────────────────────────────────
export function MarginBar({ label, pct, costo }) {
  const color = pct >= 57 ? '#1A7A4A' : pct >= 40 ? '#D68910' : '#C0392B'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
      <span style={{ color:'#1B2A4A', fontSize:10, fontWeight:700, width:100, flexShrink:0 }}>{label}</span>
      {costo && <span style={{ color:'#888B8D', fontSize:9, width:70, flexShrink:0 }}>C${costo}</span>}
      <div style={{ flex:1, height:6, background:'#f0f2f5', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3 }} />
      </div>
      <span style={{ color, fontSize:10, fontWeight:700, width:36, textAlign:'right' }}>{pct}%</span>
    </div>
  )
}

// ── SEARCH INPUT ─────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f0f2f5', border:'0.5px solid #c8cbcd', borderRadius:6, padding:'6px 10px' }}>
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='#888B8D' strokeWidth='2'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ border:'none', background:'transparent', fontSize:12, color:'#1B2A4A', outline:'none', width:160 }}
      />
    </div>
  )
}

// ── FILTER CHIP ──────────────────────────────────────────────
export function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight: active ? 700 : 400,
      background: active ? '#1B2A4A' : '#fff',
      color: active ? '#fff' : '#888B8D',
      border: active ? 'none' : '0.5px solid #c8cbcd',
      cursor:'pointer'
    }}>{children}</button>
  )
}

// ── SECTION GRID ─────────────────────────────────────────────
export function Grid({ cols = 2, gap = 12, children, style = {} }) {
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap,
      ...style
    }}>{children}</div>
  )
}

// ── KPI GRID ─────────────────────────────────────────────────
export function KpiGrid({ children, cols = 4 }) {
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap:10, marginBottom:16
    }}>{children}</div>
  )
}

// ── PAGE WRAPPER ─────────────────────────────────────────────
export function Page({ children }) {
  return (
    <div style={{ maxWidth:1200, margin:'0 auto' }}>
      {children}
    </div>
  )
}
