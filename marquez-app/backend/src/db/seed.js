import 'dotenv/config'
import { query } from './client.js'

const PRODUCTOS = [
  { nombre: 'Pico de queso',               precio: 20,   presentacion: 'unidad',    categoria: 'Salados' },
  { nombre: 'Maleta de carne',             precio: 35,   presentacion: 'unidad',    categoria: 'Salados' },
  { nombre: 'Maleta de pollo',             precio: 30,   presentacion: 'unidad',    categoria: 'Salados' },
  { nombre: 'Pastel de piña',              precio: 25,   presentacion: 'unidad',    categoria: 'Pasteles' },
  { nombre: 'Pastel de pollo',             precio: 35,   presentacion: 'unidad',    categoria: 'Pasteles' },
  { nombre: 'Prisionero',                  precio: 25,   presentacion: 'unidad',    categoria: 'Pan dulce' },
  { nombre: 'Empanada de queso',           precio: 20,   presentacion: 'unidad',    categoria: 'Salados' },
  { nombre: 'Churro de queso',             precio: 20,   presentacion: 'unidad',    categoria: 'Salados' },
  { nombre: 'Quesadilla',                  precio: 30,   presentacion: 'unidad',    categoria: 'Pan dulce' },
  { nombre: 'Dona azucarada',              precio: 20,   presentacion: 'unidad',    categoria: 'Donas' },
  { nombre: 'Dona de chocolate',           precio: 35,   presentacion: 'unidad',    categoria: 'Donas' },
  { nombre: 'Dona glaseada',               precio: 35,   presentacion: 'unidad',    categoria: 'Donas' },
  { nombre: 'Trenza frita',                precio: 20,   presentacion: 'unidad',    categoria: 'Pan dulce' },
  { nombre: 'Repollito',                   precio: 20,   presentacion: 'unidad',    categoria: 'Pan dulce' },
  { nombre: 'Repodona',                    precio: 35,   presentacion: 'unidad',    categoria: 'Pan dulce' },
  { nombre: 'Berlinesa',                   precio: 35,   presentacion: 'unidad',    categoria: 'Pan dulce' },
  { nombre: 'Torta de naranja',            precio: 35,   presentacion: 'unidad',    categoria: 'Tortas' },
  { nombre: 'Torta de vainilla',           precio: 30,   presentacion: 'unidad',    categoria: 'Tortas' },
  { nombre: 'Torta de chocolate',          precio: 40,   presentacion: 'unidad',    categoria: 'Tortas' },
  { nombre: 'Rin de vainilla',             precio: 150,  presentacion: 'unidad',    categoria: 'Rines' },
  { nombre: 'Rin de naranja',              precio: 160,  presentacion: 'unidad',    categoria: 'Rines' },
  { nombre: 'Rin de chocolate',            precio: 190,  presentacion: 'unidad',    categoria: 'Rines' },
  { nombre: 'Pañuelo de piña',             precio: 30,   presentacion: 'unidad',    categoria: 'Hojaldre' },
  { nombre: 'Pañuelo dulce de leche',      precio: 35,   presentacion: 'unidad',    categoria: 'Hojaldre' },
  { nombre: 'Bolovan',                     precio: 50,   presentacion: 'unidad',    categoria: 'Hojaldre' },
  { nombre: 'Croissant',                   precio: 50,   presentacion: 'unidad',    categoria: 'Hojaldre' },
  { nombre: 'Flor de hojaldre',            precio: 40,   presentacion: 'unidad',    categoria: 'Hojaldre' },
  { nombre: 'Mil hojas',                   precio: 120,  presentacion: 'unidad',    categoria: 'Hojaldre' },
  { nombre: 'Palmeritas',                  precio: 60,   presentacion: 'unidad',    categoria: 'Hojaldre' },
  { nombre: 'Volteado de piña 2oz',        precio: 75,   presentacion: '2 onz',     categoria: 'Postres' },
  { nombre: 'Volteado de piña 4oz',        precio: 170,  presentacion: '4 onz',     categoria: 'Postres' },
  { nombre: 'Volteado de piña 1/2lb',      precio: 320,  presentacion: '1/2 libra', categoria: 'Postres' },
  { nombre: 'Cheesecake maracuyá porción', precio: 120,  presentacion: 'porción',   categoria: 'Cheesecakes' },
  { nombre: 'Cheesecake maracuyá libra',   precio: 1250, presentacion: 'libra',     categoria: 'Cheesecakes' },
  { nombre: 'Cheesecake fresa porción',    precio: 140,  presentacion: 'porción',   categoria: 'Cheesecakes' },
  { nombre: 'Cheesecake fresa libra',      precio: 1300, presentacion: 'libra',     categoria: 'Cheesecakes' },
  { nombre: 'Cheesecake Oreo libra',       precio: 1250, presentacion: 'libra',     categoria: 'Cheesecakes' },
  { nombre: 'Cheesecake Oreo porción',     precio: 120,  presentacion: 'porción',   categoria: 'Cheesecakes' },
  { nombre: 'Rol de canela',               precio: 35,   presentacion: 'unidad',    categoria: 'Pan dulce' },
  { nombre: 'Chemi',                       precio: 25,   presentacion: 'unidad',    categoria: 'Pan dulce' },
  { nombre: 'Cupcake de vainilla',         precio: 25,   presentacion: 'unidad',    categoria: 'Cupcakes' },
  { nombre: 'Cupcake de chocolate',        precio: 30,   presentacion: 'unidad',    categoria: 'Cupcakes' },
  { nombre: 'Galleta de avena',            precio: 20,   presentacion: 'unidad',    categoria: 'Galletas' },
  { nombre: 'Galleta de mantequilla',      precio: 20,   presentacion: 'unidad',    categoria: 'Galletas' },
  { nombre: 'Galleta margarita',           precio: 20,   presentacion: 'unidad',    categoria: 'Galletas' },
  { nombre: 'Galleta de coco',             precio: 35,   presentacion: 'unidad',    categoria: 'Galletas' },
  { nombre: 'Galleta chocochips',          precio: 40,   presentacion: 'unidad',    categoria: 'Galletas' },
  { nombre: 'Pan pizza',                   precio: 40,   presentacion: 'unidad',    categoria: 'Salados' },
  { nombre: 'Choripán',                    precio: 30,   presentacion: 'unidad',    categoria: 'Salados' },
]

async function seed() {
  console.log('🌱 Iniciando seed de productos Marquéz...')
  let insertados = 0
  let actualizados = 0

  for (const p of PRODUCTOS) {
    const { rowCount, rows } = await query(`
      INSERT INTO productos (nombre, precio, presentacion, categoria)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (nombre) DO UPDATE SET
        precio = EXCLUDED.precio,
        presentacion = EXCLUDED.presentacion,
        categoria = EXCLUDED.categoria,
        actualizado_en = NOW()
      RETURNING (xmax = 0) AS inserted
    `, [p.nombre, p.precio, p.presentacion, p.categoria])

    if (rows[0].inserted) insertados++
    else actualizados++
  }

  console.log(`✅ Seed completado:`)
  console.log(`   ${insertados} productos insertados`)
  console.log(`   ${actualizados} productos actualizados`)
  console.log(`   ${PRODUCTOS.length} total\n`)
  process.exit(0)
}

seed().catch(e => { console.error('Error en seed:', e); process.exit(1) })
