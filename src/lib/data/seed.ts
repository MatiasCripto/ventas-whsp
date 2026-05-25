// ── Seed data for testing / demo ────────────────────────────

export const SEED_CATEGORIES = [
  { name: 'Remeras', slug: 'remeras' },
  { name: 'Pantalones', slug: 'pantalones' },
  { name: 'Buzos', slug: 'buzos' },
  { name: 'Camperas', slug: 'camperas' },
  { name: 'Shorts', slug: 'shorts' },
  { name: 'Accesorios', slug: 'accesorios' },
  { name: 'Calzado', slug: 'calzado' },
  { name: 'Ropa Interior', slug: 'ropa-interior' },
]

export const SEED_PRODUCTS = [
  { name: 'Remera Básica Algodón', slug: 'remera-basica-algodon', price: 4500, comparePrice: 5500, category: 'Remeras', tags: ['basica', 'algodon', 'casual'], colors: ['Blanco', 'Negro', 'Gris', 'Azul'], sizes: ['S', 'M', 'L', 'XL'], stock: 50 },
  { name: 'Remera Oversize', slug: 'remera-oversize', price: 5800, comparePrice: null, category: 'Remeras', tags: ['oversize', 'moda', 'holgada'], colors: ['Blanco', 'Negro', 'Beige', 'Verde Militar'], sizes: ['M', 'L', 'XL', 'XXL'], stock: 35 },
  { name: 'Jean Clásico', slug: 'jean-clasico', price: 12000, comparePrice: 15000, category: 'Pantalones', tags: ['jean', 'denim', 'clasico'], colors: ['Azul Claro', 'Azul Oscuro', 'Negro'], sizes: ['38', '40', '42', '44'], stock: 25 },
  { name: 'Jogging Deportivo', slug: 'jogging-deportivo', price: 8500, comparePrice: null, category: 'Pantalones', tags: ['jogging', 'deportivo', 'algodon'], colors: ['Negro', 'Gris', 'Azul Marino'], sizes: ['S', 'M', 'L', 'XL'], stock: 40 },
  { name: 'Buzo Canguro', slug: 'buzo-canguro', price: 9500, comparePrice: 11000, category: 'Buzos', tags: ['buzo', 'canguro', 'abrigo'], colors: ['Negro', 'Gris', 'Borgoña'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], stock: 20 },
  { name: 'Campera Rompevientos', slug: 'campera-rompevientos', price: 15000, comparePrice: 18500, category: 'Camperas', tags: ['campera', 'rompevientos', 'abrigo'], colors: ['Negro', 'Verde', 'Azul'], sizes: ['M', 'L', 'XL'], stock: 15 },
  { name: 'Short Deportivo', slug: 'short-deportivo', price: 5500, comparePrice: null, category: 'Shorts', tags: ['short', 'deportivo', 'verano'], colors: ['Negro', 'Gris', 'Rojo'], sizes: ['S', 'M', 'L', 'XL'], stock: 30 },
  { name: 'Boxer Algodón x2', slug: 'boxer-algodon-x2', price: 3500, comparePrice: 4500, category: 'Ropa Interior', tags: ['boxer', 'interior', 'algodon'], colors: ['Negro', 'Blanco', 'Gris'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], stock: 60 },
  { name: 'Gorra Visera Plana', slug: 'gorra-visera-plana', price: 3800, comparePrice: null, category: 'Accesorios', tags: ['gorra', 'accesorio', 'urbano'], colors: ['Negro', 'Rojo', 'Azul', 'Blanco'], sizes: ['Unico'], stock: 45 },
  { name: 'Mochila Urbana', slug: 'mochila-urbana', price: 8500, comparePrice: null, category: 'Accesorios', tags: ['mochila', 'urbana', 'accesorio'], colors: ['Negro', 'Gris'], sizes: ['Unico'], stock: 12 },
  { name: 'Zapatillas Urbanas', slug: 'zapatillas-urbanas', price: 22000, comparePrice: 28000, category: 'Calzado', tags: ['zapatillas', 'urbano', 'moda'], colors: ['Blanco', 'Negro'], sizes: ['38', '39', '40', '41', '42', '43', '44'], stock: 18 },
  { name: 'Medias Algodón x3', slug: 'medias-algodon-x3', price: 2500, comparePrice: null, category: 'Accesorios', tags: ['medias', 'algodon', 'basico'], colors: ['Negro', 'Blanco', 'Mixto'], sizes: ['Unico'], stock: 80 },
]

export const SEED_STORE_POLICIES = {
  shipping: 'Envíos a todo el país. Gratis desde $15.000. Entrega 3-7 días hábiles.',
  payment: 'Efectivo, transferencia bancaria, Mercado Pago (débito/crédito)',
  returns: 'Cambios dentro de los 30 días. Productos sin uso y con etiqueta.',
  freeShippingFrom: 15000,
}
