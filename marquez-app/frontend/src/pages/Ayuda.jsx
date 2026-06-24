/**
 * Ayuda.jsx — Manual de usuario integrado.
 * v2.8
 *
 * Estructura:
 *   - Selector de rol (Dueño / Empleado) — cambia qué tan técnico es el texto.
 *   - Contenido por módulo: Ventas, Dashboard, Config. Fiscal (los 3 en uso real hoy).
 *   - Buscador simple que filtra por texto dentro de las preguntas.
 *   - Exportar/Imprimir usa window.print() con CSS dedicado — sin dependencias nuevas.
 *
 * Para agregar un módulo nuevo más adelante: solo añadir un objeto más
 * al array MANUAL con su propio bloque dueño/empleado.
 */
import { useState, useMemo } from 'react'
import {
  HelpCircle, ShoppingCart, LayoutDashboard, Shield, Search,
  Printer, ChevronDown, User, Users, BookOpen,
} from 'lucide-react'

// ── Contenido del manual ──────────────────────────────────────────────────────
// Cada módulo tiene dos bloques de preguntas: 'duenio' (más términos de negocio)
// y 'empleado' (lenguaje de piso de venta, sin jerga de margen/fiscal).
const MANUAL = [
  {
    id: 'ventas',
    icono: ShoppingCart,
    color: '#C29C53',
    titulo: 'Ventas',
    duenio: [
      {
        q: '¿Cómo registro una venta nueva?',
        a: 'Entra a Ventas → pestaña "Nueva venta". Toca los productos del catálogo para agregarlos al carrito (puedes filtrar por categoría o buscar por nombre). Ajusta cantidades con los botones + y −. Elige el canal (Tienda física, WhatsApp o Encargo), el método de pago, y si es efectivo escribe el monto recibido para que el sistema calcule el cambio automáticamente. Por último toca "Registrar venta".',
      },
      {
        q: '¿Qué significa el indicador "● offline" en los KPIs?',
        a: 'Significa que el navegador no pudo conectarse al servidor en ese momento. Las ventas igual se registran y quedan guardadas en el dispositivo — cuando vuelva la conexión se sincronizan solas con el servidor. No se pierde ninguna venta, solo se demora en aparecer en los reportes generales.',
      },
      {
        q: '¿Cómo hago el cierre de caja al final del día?',
        a: 'Ve a la pestaña "Cierre de caja". Ahí ves el desglose por método de pago (efectivo, tarjeta, transferencia). Cuenta el efectivo físico de la caja y escríbelo en "Efectivo contado físicamente" — el sistema calcula automáticamente si hay sobrante o faltante comparado con lo que el sistema registró. Al final puedes exportar el cierre como CSV con el botón correspondiente.',
      },
      {
        q: '¿Por qué el reporte de productos más vendidos aparece vacío?',
        a: 'Esto pasa solo si no hay ventas registradas todavía en el día. Si ya registraste ventas y sigue vacío, revisa que el backend esté conectado (sin el indicador offline) — el reporte se calcula con los datos sincronizados del servidor.',
      },
    ],
    empleado: [
      {
        q: '¿Cómo cobro a un cliente?',
        a: 'Toca el producto que el cliente está comprando — aparece en el carrito a la derecha. Si quiere más de uno, toca el botón + las veces que necesites. Cuando esté completo el pedido, elige cómo va a pagar (efectivo, tarjeta o transferencia) y toca el botón dorado "Registrar venta".',
      },
      {
        q: 'El cliente me dio más dinero del total, ¿cómo sé cuánto vuelto darle?',
        a: 'Cuando elijas "Efectivo" como método de pago, aparece un campo que dice "Monto recibido". Escribe ahí cuánto te dio el cliente y el sistema te muestra automáticamente el cambio exacto.',
      },
      {
        q: 'Me equivoqué al agregar un producto, ¿cómo lo quito?',
        a: 'En el carrito, usa el botón − para reducir la cantidad, o si quieres vaciar todo el carrito y empezar de nuevo, toca el botón "Vaciar" arriba del carrito.',
      },
    ],
  },
  {
    id: 'dashboard',
    icono: LayoutDashboard,
    color: '#263D4F',
    titulo: 'Dashboard',
    duenio: [
      {
        q: '¿Qué significan los números de "Productos activos" y "Sin receta"?',
        a: '"Productos activos" es el total de productos en tu catálogo (actualmente 49 en Marquéz). "Sin receta" cuenta cuántos de esos productos todavía no tienen una receta cargada en el sistema — sin receta, ese producto no puede pasar por el módulo de Costeo para calcular si cumple el margen mínimo del 57%.',
      },
      {
        q: '¿Qué significa "Alertas de margen"?',
        a: 'Cuenta cuántos productos, según su último costeo registrado, tienen un margen de ganancia por debajo del 57% objetivo del negocio. Si ves un número mayor a 0 ahí, conviene revisar esos productos en el módulo Costeo — puede que necesites subir el precio de venta o reducir el costo de algún ingrediente.',
      },
      {
        q: '¿Por qué la lista de "Estado de recetas" muestra tantos "Sin receta"?',
        a: 'Porque cargar las 49 recetas toma tiempo y se hace gradualmente. Prioriza primero los productos que más vendes — esos son los que más impactan tu rentabilidad real, y el Dashboard te ayuda a ver de un vistazo cuáles faltan.',
      },
    ],
    empleado: [
      {
        q: '¿Para qué sirve esta pantalla?',
        a: 'El Dashboard es un resumen general del negocio — cuántos productos hay, cuántas recetas están cargadas y si hay alguna alerta importante. Como empleado normalmente no necesitas tocar nada aquí, solo es informativo.',
      },
    ],
  },
  {
    id: 'fiscal',
    icono: Shield,
    color: '#A8813E',
    titulo: 'Config. Fiscal',
    duenio: [
      {
        q: '¿Qué es el prorrateo fiscal y por qué afecta mi margen?',
        a: 'El prorrateo fiscal reparte el pago mensual a la DGI (Cuota Fija) entre todas las piezas que produces en el mes. Por ejemplo, si pagas C$300 de Cuota Fija y produces 1,350 piezas al mes, cada pieza "carga" C$0.22 de impuesto. Ese costo adicional se suma al costo de producción real, y puede hacer que un producto que parecía cumplir el margen del 57% en realidad no lo cumpla una vez se incluyen los impuestos.',
      },
      {
        q: '¿Cómo elijo entre Cuota Fija y Régimen General?',
        a: 'Cuota Fija aplica generalmente si tus ingresos anuales son menores a C$1,200,000 — pagas un monto mensual fijo a la DGI. Régimen General aplica para ingresos mayores, y ahí declaras IVA (15%) e Impuesto sobre la Renta según utilidades. Si no estás seguro de cuál te corresponde, lo más seguro es consultar con un contador colegiado (CCPN Nicaragua) — el sistema no sustituye esa asesoría, solo ayuda a calcular el impacto en tus márgenes una vez que sabes tu régimen.',
      },
      {
        q: '¿Qué pasa si no configuro nada en este módulo?',
        a: 'El sistema sigue funcionando normal — el costeo y el cálculo de márgenes se hacen sin incluir el prorrateo fiscal. Es decir, verías el margen "antes de impuestos". En cuanto guardes tu configuración aquí, el módulo de Costeo empieza a mostrarte ambos números: margen sin fiscal y margen con fiscal, para que veas la diferencia real.',
      },
      {
        q: '¿Qué número pongo en "Producción mensual estimada"?',
        a: 'Es la suma de todas las piezas de todos tus productos que produces en un mes típico — no solo de un producto. Mientras más preciso sea este número, más exacto será el prorrateo por pieza. Puedes ajustarlo cada mes si tu producción cambia notablemente.',
      },
    ],
    empleado: [
      {
        q: '¿Necesito tocar este módulo?',
        a: 'No. La configuración fiscal la define el dueño del negocio porque tiene que ver con impuestos y declaraciones ante la DGI. Como empleado de mostrador no necesitas entrar a esta sección.',
      },
    ],
  },
]

export default function Ayuda() {
  const [rol, setRol] = useState('duenio')          // 'duenio' | 'empleado'
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null)       // id de la pregunta expandida

  const manualFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return MANUAL.map(modulo => {
      const preguntas = modulo[rol].filter(p =>
        !texto || p.q.toLowerCase().includes(texto) || p.a.toLowerCase().includes(texto)
      )
      return { ...modulo, preguntas }
    }).filter(m => m.preguntas.length > 0)
  }, [rol, busqueda])

  const toggle = (key) => setAbierto(prev => prev === key ? null : key)

  return (
    <div className="max-w-3xl">

      {/* Header — oculto al imprimir, se reemplaza por uno simple */}
      <div className="flex items-center gap-3 mb-4 print:hidden">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#263D4F' }}>
          <HelpCircle size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Manual de usuario</h2>
          <p className="text-xs text-gray-400">Guía rápida de Master Baker — Marquéz Panadería & Repostería</p>
        </div>
        <button onClick={() => window.print()}
          className="ml-auto btn-secondary flex items-center gap-1.5 text-xs">
          <Printer size={13} /> Exportar / Imprimir
        </button>
      </div>

      {/* Encabezado solo visible al imprimir */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#263D4F' }}>Master Baker — Manual de Usuario</h1>
        <p className="text-sm text-gray-500">Marquéz Panadería & Repostería · Rol: {rol === 'duenio' ? 'Dueño / Administrador' : 'Empleado de mostrador'}</p>
      </div>

      {/* Selector de rol + buscador */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 print:hidden">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => setRol('duenio')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 ${rol === 'duenio' ? 'bg-white font-medium shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <User size={13} /> Dueño
          </button>
          <button onClick={() => setRol('empleado')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 ${rol === 'empleado' ? 'bg-white font-medium shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Users size={13} /> Empleado
          </button>
        </div>

        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar en el manual… ej: cierre de caja, prorrateo, vuelto"
            className="pl-8"
          />
        </div>
      </div>

      {/* Aviso si la búsqueda no encontró nada */}
      {busqueda && manualFiltrado.length === 0 && (
        <div className="card text-center py-8 text-sm text-gray-400 print:hidden">
          No encontramos nada para "{busqueda}". Intenta con otra palabra o revisa la sección de un módulo específico.
        </div>
      )}

      {/* Módulos */}
      <div className="space-y-4">
        {manualFiltrado.map(modulo => {
          const Icono = modulo.icono
          return (
            <div key={modulo.id} className="card print:break-inside-avoid">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${modulo.color}1A` }}>
                  <Icono size={14} style={{ color: modulo.color }} />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">{modulo.titulo}</h3>
                <span className="ml-auto text-[10px] text-gray-400 print:hidden">
                  {modulo.preguntas.length} {modulo.preguntas.length === 1 ? 'tema' : 'temas'}
                </span>
              </div>

              <div className="space-y-1.5">
                {modulo.preguntas.map((p, i) => {
                  const key = `${modulo.id}-${i}`
                  const estaAbierto = abierto === key
                  return (
                    <div key={key} className="border border-gray-100 rounded-lg overflow-hidden print:border-0">
                      <button
                        onClick={() => toggle(key)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors print:hidden"
                      >
                        <span className="text-xs font-medium text-gray-700">{p.q}</span>
                        <ChevronDown size={13} className={`text-gray-400 flex-shrink-0 transition-transform ${estaAbierto ? 'rotate-180' : ''}`} />
                      </button>

                      {/* En pantalla solo se ve si está abierto; al imprimir siempre se ve */}
                      <div className={`${estaAbierto ? 'block' : 'hidden'} print:block px-3 pb-2.5 print:px-0 print:pb-3`}>
                        <p className="text-[10px] font-semibold text-gray-500 mb-1 print:text-xs print:font-bold">{p.q}</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{p.a}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Nota de cierre */}
      <div className="mt-5 p-3 rounded-xl flex items-start gap-2 text-xs print:hidden"
        style={{ background: '#FBF6EC', border: '0.5px solid #C29C53', color: '#7A5E2C' }}>
        <BookOpen size={13} className="flex-shrink-0 mt-0.5" />
        <span>Este manual cubre los módulos en uso activo (Ventas, Dashboard, Config. Fiscal). Se irán agregando más secciones a medida que se incorporen Recetas, Costeo, Inventario y el resto del sistema.</span>
      </div>

    </div>
  )
}
