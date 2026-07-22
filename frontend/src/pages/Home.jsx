import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Clock, 
  MapPin, 
  Phone, 
  Instagram, 
  Facebook, 
  ArrowRight, 
  Menu, 
  X, 
  ChefHat, 
  Award, 
  Heart, 
  Sparkles,
  ShoppingBag,
  ExternalLink
} from 'lucide-react'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Productos de especialidad usando las imágenes reales en public/images/productos/
  const productosDestacados = [
    {
      id: 1,
      nombre: 'Volteado de Piña Familiar',
      descripcion: 'Nuestra especialidad de la casa. Suave bizcocho caramelizado con rebanadas de piña seleccionada y cerezas.',
      precio: 'C$ 450.00',
      imagen: '/images/productos/volteado-de-pina-completo.jpg'
    },
    {
      id: 2,
      nombre: 'Pastel de Piña Tradicional',
      descripcion: 'Receta artesanal nicaragüense, relleno con jalea de piña casera y decorado con merengue clásico.',
      precio: 'C$ 380.00',
      imagen: '/images/productos/pastel-de-pina.jpg'
    },
    {
      id: 3,
      nombre: 'Roles de Canela Premium',
      descripcion: 'Esponjosos roles horneados a diario con un toque perfecto de canela y un glaseado cremoso de queso.',
      precio: 'C$ 45.00 c/u',
      imagen: '/images/productos/rol-de-canela.jpg'
    },
    {
      id: 4,
      nombre: 'Repodona',
      descripcion: 'La fusión perfecta y crujiente de repostería hojaldrada y dona azucarada, rellena de crema pastelera.',
      precio: 'C$ 50.00',
      imagen: '/images/productos/repodona.jpg'
    },
    {
      id: 5,
      nombre: 'Dona de Chocolate',
      descripcion: 'Clásica dona esponjosa cubierta con una generosa capa de ganache de chocolate semi-amargo.',
      precio: 'C$ 35.00',
      imagen: '/images/productos/dona-de-chocolate.jpg'
    },
    {
      id: 6,
      nombre: 'Dona Azucarada',
      descripcion: 'La favorita de siempre, horneada a la perfección y espolvoreada con azúcar fina y canela.',
      precio: 'C$ 25.00',
      imagen: '/images/productos/dona-azucarada.jpg'
    }
  ]

  const scrollToSection = (id) => {
    setMobileMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-navy-900 dark:bg-navy-950 dark:text-gray-100 transition-colors duration-300">
      
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-navy-900/80 backdrop-blur-md border-b border-brand-100 dark:border-navy-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer" onClick={() => scrollToSection('inicio')}>
                <img src="/branding/logo-emblema.png" alt="Logo Emblema" className="h-12 w-12 object-contain" />
                <div className="hidden sm:block">
                  <span className="text-xl font-bold tracking-wider text-navy-600 dark:text-brand-100 block">
                    MARQUÉZ
                  </span>
                  <span className="text-xs uppercase tracking-widest text-brand-400 font-semibold block -mt-1">
                    Panadería & Repostería
                  </span>
                </div>
              </div>
            </div>

            {/* Menú Escritorio */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection('inicio')} className="text-navy-400 hover:text-brand-400 dark:text-gray-300 dark:hover:text-brand-400 font-medium transition-colors">Inicio</button>
              <button onClick={() => scrollToSection('historia')} className="text-navy-400 hover:text-brand-400 dark:text-gray-300 dark:hover:text-brand-400 font-medium transition-colors">Historia</button>
              <button onClick={() => scrollToSection('especialidades')} className="text-navy-400 hover:text-brand-400 dark:text-gray-300 dark:hover:text-brand-400 font-medium transition-colors">Especialidades</button>
              <button onClick={() => scrollToSection('contacto')} className="text-navy-400 hover:text-brand-400 dark:text-gray-300 dark:hover:text-brand-400 font-medium transition-colors">Contacto</button>
              
              <Link to="/login" className="btn-primary flex items-center gap-2 px-5 py-2.5 shadow-sm shadow-brand-400/20">
                Acceso Personal
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* Botón menú móvil */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-navy-600 dark:text-gray-300 hover:text-brand-400 focus:outline-none p-2 rounded-md"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Menú Móvil */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-navy-900 border-b border-brand-100 dark:border-navy-800 px-4 pt-2 pb-6 space-y-3 transition-all">
            <button onClick={() => scrollToSection('inicio')} className="block w-full text-left py-2 text-base text-navy-400 hover:text-brand-400 dark:text-gray-300 dark:hover:text-brand-400 font-medium">Inicio</button>
            <button onClick={() => scrollToSection('historia')} className="block w-full text-left py-2 text-base text-navy-400 hover:text-brand-400 dark:text-gray-300 dark:hover:text-brand-400 font-medium">Historia</button>
            <button onClick={() => scrollToSection('especialidades')} className="block w-full text-left py-2 text-base text-navy-400 hover:text-brand-400 dark:text-gray-300 dark:hover:text-brand-400 font-medium">Especialidades</button>
            <button onClick={() => scrollToSection('contacto')} className="block w-full text-left py-2 text-base text-navy-400 hover:text-brand-400 dark:text-gray-300 dark:hover:text-brand-400 font-medium">Contacto</button>
            <div className="pt-4">
              <Link to="/login" className="btn-primary block text-center py-3 w-full">
                Acceso Personal
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <header id="inicio" className="relative overflow-hidden py-16 md:py-28 lg:py-36 flex items-center justify-center">
        {/* Decoraciones de fondo */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-brand-50 dark:bg-brand-900/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-100/50 dark:bg-navy-900/20 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-100 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-6 animate-pulse">
            <Sparkles size={14} /> Recetas familiares hechas con amor
          </div>
          
          <img src="/branding/logo-completo.png" alt="Marquéz Logo" className="h-44 sm:h-56 mx-auto mb-8 drop-shadow-md select-none dark:invert dark:opacity-90" style={{ mixBlendMode: 'multiply' }} />
          
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-navy-600 dark:text-white max-w-4xl mx-auto leading-tight">
            El sabor artesanal que alegra tu mesa en <span className="text-brand-400">Chichigalpa</span>
          </h1>
          
          <p className="mt-6 text-base sm:text-xl text-gray-500 dark:text-gray-300 max-w-2xl mx-auto font-light leading-relaxed">
            Panadería caliente todos los días, repostería fina, pasteles de piña tradicionales y las mejores repodonas. Elaborados con ingredientes frescos y la pasión de nuestra familia.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="https://wa.me/50588888888" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-primary px-8 py-4 text-base font-semibold shadow-md shadow-brand-400/20 flex items-center justify-center gap-3 hover:bg-brand-600"
            >
              <Phone size={18} />
              Haz tu Pedido por WhatsApp
            </a>
            
            <button 
              onClick={() => scrollToSection('especialidades')}
              className="btn-secondary px-8 py-4 text-base font-semibold flex items-center justify-center gap-2 hover:border-brand-400"
            >
              <ShoppingBag size={18} />
              Ver Especialidades
            </button>
          </div>
        </div>
      </header>

      {/* METRICAS / LOGROS */}
      <section className="bg-white dark:bg-navy-900 border-y border-brand-100 dark:border-navy-800 transition-colors duration-300 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="flex items-center gap-4 p-4">
              <div className="p-3 bg-brand-50 dark:bg-brand-900/30 text-brand-400 rounded-2xl">
                <ChefHat size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-600 dark:text-white">Ingredientes Selectos</h3>
                <p className="text-sm text-gray-400">Calidad en cada harina, piña y mantequilla.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 border-y md:border-y-0 md:border-x border-gray-100 dark:border-navy-800">
              <div className="p-3 bg-brand-50 dark:bg-brand-900/30 text-brand-400 rounded-2xl">
                <Award size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-600 dark:text-white">Receta Tradicional</h3>
                <p className="text-sm text-gray-400">El sabor original que recuerdas desde niño.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4">
              <div className="p-3 bg-brand-50 dark:bg-brand-900/30 text-brand-400 rounded-2xl">
                <Heart size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-600 dark:text-white">Horneado Diario</h3>
                <p className="text-sm text-gray-400">Fresco y caliente, directamente del horno.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECCIÓN SOBRE NOSOTROS */}
      <section id="historia" className="py-20 md:py-28 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Foto de la repostería */}
            <div className="lg:col-span-5 relative">
              <div className="absolute -inset-2 bg-gradient-to-tr from-brand-400 to-amber-200 rounded-3xl opacity-20 blur-lg" />
              <div className="relative bg-white dark:bg-navy-900 p-3 rounded-3xl shadow-card border border-brand-100 dark:border-navy-800">
                <img 
                  src="/images/productos/volteado-de-pina.jpg" 
                  alt="Preparación del Volteado de Piña" 
                  className="rounded-2xl w-full h-[400px] object-cover" 
                />
                <div className="absolute bottom-6 right-6 bg-brand-400 text-white p-4 rounded-2xl shadow-lg flex items-center gap-2">
                  <span className="text-2xl font-bold">100%</span>
                  <span className="text-xs uppercase tracking-widest leading-none font-semibold">Artesanal<br/>Nicaragüense</span>
                </div>
              </div>
            </div>

            {/* Texto de historia */}
            <div className="lg:col-span-7 space-y-6">
              <div className="text-brand-400 font-bold uppercase tracking-widest text-sm">
                Nuestra Historia
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-600 dark:text-white leading-tight">
                Tradición familiar convertida en dulzura
              </h2>
              <p className="text-gray-500 dark:text-gray-300 leading-relaxed text-lg">
                Nacidos en el corazón de Chichigalpa, en **Repostería Márquez** nos dedicamos a rescatar y enaltecer las recetas clásicas de nuestra tierra. Cada pastel de piña, cada rol de canela y cada pieza de repostería lleva consigo años de perfeccionamiento, amor por el oficio y el compromiso de endulzar la vida de nuestros vecinos.
              </p>
              <p className="text-gray-500 dark:text-gray-300 leading-relaxed">
                Nuestras repodonas y volteados de piña ya son una parada obligatoria para los chichigalpinos y visitantes. No somos solo una panadería; somos parte de tus celebraciones familiares, tus desayunos de domingo y tus tardes de café.
              </p>
              <div className="pt-4 flex items-center gap-4">
                <div className="text-center p-4 border border-brand-200 dark:border-brand-900 rounded-xl bg-white dark:bg-navy-900 w-28">
                  <span className="text-sm font-black text-brand-400 block">Chichigalpa</span>
                  <span className="text-[10px] uppercase text-gray-400 tracking-wider font-semibold">Origen</span>
                </div>
                <div className="text-center p-4 border border-brand-200 dark:border-brand-900 rounded-xl bg-white dark:bg-navy-900 w-28">
                  <span className="text-sm font-black text-brand-400 block">Diario</span>
                  <span className="text-[10px] uppercase text-gray-400 tracking-wider font-semibold">Frescura</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECCIÓN ESPECIALIDADES */}
      <section id="especialidades" className="py-20 md:py-28 bg-white dark:bg-navy-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="text-brand-400 font-bold uppercase tracking-widest text-sm">
              Menú Destacado
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-600 dark:text-white">
              Nuestras Especialidades
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm">
              Horneados frescos todos los días. Pregunta por existencias o encarga tu pastel especial para eventos familiares.
            </p>
          </div>

          {/* Grid de productos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {productosDestacados.map((prod) => (
              <div 
                key={prod.id} 
                className="group bg-[#FAF8F4] dark:bg-navy-950 rounded-2xl overflow-hidden border border-brand-100 dark:border-navy-800 shadow-sm hover:shadow-card-hover transition-all duration-300 flex flex-col"
              >
                <div className="h-64 overflow-hidden relative">
                  <img 
                    src={prod.imagen} 
                    alt={prod.nombre} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="absolute top-4 right-4 bg-brand-400 text-white font-bold text-sm px-4 py-1.5 rounded-full shadow-md">
                    {prod.precio}
                  </div>
                </div>
                
                <div className="p-6 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-navy-600 dark:text-white group-hover:text-brand-400 transition-colors">
                      {prod.nombre}
                    </h3>
                    <p className="mt-3 text-sm text-gray-505 dark:text-gray-300 leading-relaxed font-light">
                      {prod.descripcion}
                    </p>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-brand-100 dark:border-navy-800 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Disponible hoy</span>
                    <a 
                      href={`https://wa.me/50588888888?text=Hola,%20quisiera%20pedir%20el%20producto:%20${encodeURIComponent(prod.nombre)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-brand-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                    >
                      Pedir ahora <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN HORARIOS Y CONTACTO */}
      <section id="contacto" className="py-20 md:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-navy-900 rounded-3xl border border-brand-100 dark:border-navy-800 shadow-card overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              
              {/* Información y horarios */}
              <div className="lg:col-span-7 p-8 sm:p-12 space-y-8 flex flex-col justify-between">
                <div>
                  <div className="text-brand-400 font-bold uppercase tracking-widest text-sm mb-2">
                    Visítanos
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-600 dark:text-white">
                    Te esperamos con el café servido
                  </h2>
                  <p className="mt-4 text-gray-500 dark:text-gray-300 text-sm leading-relaxed">
                    Estamos ubicados en una zona central y de fácil acceso en Chichigalpa. Ven a disfrutar de un aroma inconfundible y llévate lo mejor de nuestra repostería para compartir en familia.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-4">
                  <div className="space-y-3">
                    <h3 className="font-bold text-navy-600 dark:text-white flex items-center gap-2">
                      <Clock size={18} className="text-brand-400" />
                      Horarios de Atención
                    </h3>
                    <div className="text-sm text-gray-500 dark:text-gray-300 space-y-1">
                      <p><span className="font-semibold text-navy-400">Lunes a Sábado:</span> 7:00 AM - 6:00 PM</p>
                      <p><span className="font-semibold text-navy-400">Domingos:</span> 8:00 AM - 1:00 PM</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-navy-600 dark:text-white flex items-center gap-2">
                      <MapPin size={18} className="text-brand-400" />
                      Nuestra Ubicación
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      Del Parque Central 1 cuadra al norte, 75 varas al este.<br />
                      Chichigalpa, Chinandega, Nicaragua.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-brand-100 dark:border-navy-800">
                  <a 
                    href="https://wa.me/50588888888" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3"
                  >
                    <Phone size={16} /> Enviar Mensaje de Consulta
                  </a>
                </div>
              </div>

              {/* Mapa de fantasía o branding */}
              <div className="lg:col-span-5 bg-brand-50 dark:bg-navy-950 p-8 sm:p-12 flex flex-col items-center justify-center text-center border-t lg:border-t-0 lg:border-l border-brand-100 dark:border-navy-800">
                <img src="/branding/logo-emblema.png" alt="Emblema Márquez" className="h-32 w-32 object-contain mb-6 animate-bounce" />
                <h3 className="text-xl font-bold text-navy-600 dark:text-white">Repostería Márquez</h3>
                <p className="text-xs text-brand-400 uppercase tracking-widest font-bold mt-1">Chichigalpa, Nicaragua</p>
                <p className="mt-4 text-xs text-gray-400 max-w-xs leading-relaxed">
                  "Danos el pan nuestro de cada día" - Comprometidos con alimentar a las familias de Chichigalpa con calidad, higiene y el auténtico sabor tradicional.
                </p>
                
                {/* Redes sociales */}
                <div className="flex gap-4 mt-8">
                  <a href="#" className="p-3 bg-white dark:bg-navy-900 border border-brand-100 dark:border-navy-800 rounded-full text-brand-400 hover:bg-brand-400 hover:text-white transition-all shadow-sm">
                    <Facebook size={20} />
                  </a>
                  <a href="#" className="p-3 bg-white dark:bg-navy-900 border border-brand-100 dark:border-navy-800 rounded-full text-brand-400 hover:bg-brand-400 hover:text-white transition-all shadow-sm">
                    <Instagram size={20} />
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-navy-900 text-gray-400 py-12 border-t border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <img src="/branding/logo-emblema.png" alt="Logo Emblema" className="h-10 w-10 brightness-0 invert" />
            <span className="text-lg font-bold tracking-wider text-white">MARQUÉZ</span>
          </div>
          
          <p className="text-sm max-w-md mx-auto">
            © {new Date().getFullYear()} Repostería Márquez. Todos los derechos reservados.
          </p>

          <p className="text-xs text-gray-500">
            Desarrollado por <span className="text-brand-200">Leiva Cruz Developments</span> · Chichigalpa, Nicaragua
          </p>

          <div className="pt-4 border-t border-navy-800 flex justify-center gap-6 text-xs">
            <Link to="/login" className="hover:text-brand-400 transition-colors">Portal de Administración</Link>
            <span>·</span>
            <Link to="/registro" className="hover:text-brand-400 transition-colors">Registra tu negocio</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
