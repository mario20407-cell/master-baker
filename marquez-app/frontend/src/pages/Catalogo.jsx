// ─── pages/Catalogo.jsx ───────────────────────────────────────────────────────
import { useState } from 'react'
import { PRODUCTOS, CATEGORIAS, CAT_COLORS } from '../lib/catalogo'
import { Search, Calculator, Scale } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function Catalogo() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todos')
  const navigate = useNavigate()

  const lista = PRODUCTOS.filter(p =>
    (cat === 'Todos' || p.cat === cat) &&
    (!q || p.n.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="max-w-5xl">
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto..." />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {['Todos', ...CATEGORIAS].map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1 text-xs rounded-lg border transition-all ${cat === c
              ? 'border-brand-400 text-white font-medium'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            style={cat === c ? { background: '#C29C53' } : {}}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {lista.map(p => {
          const color = CAT_COLORS[p.cat] || { bg: '#F1EFE8', text: '#444441' }
          const costoMax = (p.p * 0.43).toFixed(2)
          return (
            <div key={p.n} className="card hover:shadow-card-hover transition-shadow cursor-default">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={{ background: color.bg, color: color.text }}>{p.cat}</span>
              </div>
              <div className="text-sm font-medium text-gray-900 mb-1 leading-tight">{p.n}</div>
              <div className="text-xl font-semibold mb-1" style={{ color: '#C29C53' }}>C$ {p.p}</div>
              <div className="text-xs text-gray-400 mb-3">{p.pr}</div>
              <div className="text-xs text-gray-500 mb-3 p-2 rounded-lg" style={{ background: '#FAEEDA' }}>
                Costo máx (60%): <strong>C$ {costoMax}</strong>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => navigate('/costeo', { state: { producto: p.n } })}
                  className="flex-1 btn-primary text-xs py-1.5 flex items-center justify-center gap-1">
                  <Calculator size={11} /> Costear
                </button>
                <button onClick={() => navigate('/escalado', { state: { producto: p.n } })}
                  className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
                  <Scale size={11} /> Escalar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Catalogo
