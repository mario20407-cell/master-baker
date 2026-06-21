// lib/catalogo.js v3.2
// Solo colores. Productos en Supabase via useCatalogo()

export const CAT_COLORS = {
  Salados:     { bg: '#E6F1FB', text: '#0C447C' },
  'Pan dulce': { bg: '#FAEEDA', text: '#633806' },
  Pasteles:    { bg: '#FBEAF0', text: '#72243E' },
  Donas:       { bg: '#FCEBEB', text: '#791F1F' },
  Tortas:      { bg: '#EAF3DE', text: '#27500A' },
  Rines:       { bg: '#E1F5EE', text: '#085041' },
  Hojaldre:    { bg: '#F1EFE8', text: '#444441' },
  Postres:     { bg: '#EEEDFE', text: '#3C3489' },
  Cheesecakes: { bg: '#FAECE7', text: '#712B13' },
  Cupcakes:    { bg: '#FBEAF0', text: '#72243E' },
  Galletas:    { bg: '#EAF3DE', text: '#27500A' },
}

export const getImagenUrl = (producto) =>
  producto?.img ? `/images/productos/${producto.img}` : null
