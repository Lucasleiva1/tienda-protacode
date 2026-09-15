/* -------------------------------------------------------------------------- */
/*  DATOS DE DESARROLLO — NO SON DATOS DEFINITIVOS                            */
/*                                                                            */
/*  Fuente temporal de productos mientras se construye la tienda. Se reemplaza */
/*  por datos administrables desde el panel Admin.                            */
/*                                                                            */
/*  ANTES DE VENDER hay que confirmar, producto por producto:                 */
/*    1. que el `appId` coincida EXACTAMENTE con el registrado en RXW-CORE;   */
/*    2. los precios: los de acá son provisionales;                           */
/*    3. las funciones y los requisitos: están redactados a partir de lo que  */
/*       cada programa hace por definición, sin detalle técnico confirmado.   */
/*                                                                            */
/*  Ningún componente importa este archivo: la interfaz usa los helpers de    */
/*  `@/features/products/queries`.                                            */
/* -------------------------------------------------------------------------- */

import type { Product } from "@/types/product";

export const DEV_PRODUCTS: readonly Product[] = [
  {
    id: "dev-001",
    slug: "whisper",
    appId: "whisper-solution",
    name: "Whisper Solution",
    shortDescription: "Escribí hablando, sin tocar el teclado.",
    description:
      "Whisper Solution convierte tu voz en texto para que puedas escribir hablando en aplicaciones o sitios donde normalmente tendrías que usar el teclado. Dictás, y el texto aparece escrito donde estabas trabajando.",
    price: {
      ARS: { amount: 2490000, currency: "ARS" },
      USD: { amount: 1900, currency: "USD" },
    },
    currency: "ARS",
    platforms: ["windows"],
    version: "1.0.0",
    licenseType: "perpetual",
    images: [],
    heroImage: null,
    downloadType: "installer",
    category: "productividad",
    features: [
      {
        name: "Dictado a texto",
        description: "Hablás y el programa escribe lo que dijiste.",
      },
      {
        name: "Funciona sobre otras aplicaciones",
        description:
          "El texto va a donde estabas escribiendo, sin copiar y pegar.",
      },
      {
        name: "Procesamiento en tu equipo",
        description: "El audio se transcribe en tu computadora.",
      },
    ],
    useCases: ["Trabajo", "Estudio", "Redacción"],
    systemRequirements: [
      { label: "Sistema operativo", value: "Windows 10 o posterior" },
      { label: "Micrófono", value: "Requerido" },
    ],
    licenseNote: null,
    published: true,
    featured: true,
    sortOrder: 10,
    archived: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
  {
    id: "dev-002",
    slug: "biblioteca",
    appId: "biblioteca-visual",
    name: "Biblioteca Visual",
    shortDescription: "Todas tus imágenes y referencias en un solo lugar.",
    description:
      "Biblioteca Visual reúne tus diseños, fotos y referencias en una sola ventana para que puedas encontrarlos rápido, en vez de ir abriendo carpeta por carpeta.",
    price: {
      ARS: { amount: 2990000, currency: "ARS" },
      USD: { amount: 2300, currency: "USD" },
    },
    currency: "ARS",
    platforms: ["windows"],
    version: "1.0.0",
    licenseType: "perpetual",
    images: [],
    heroImage: null,
    downloadType: "installer",
    category: "diseno",
    features: [
      {
        name: "Vista de biblioteca",
        description: "Mirás muchas imágenes juntas sin abrirlas una por una.",
      },
      {
        name: "Búsqueda",
        description: "Encontrás una referencia por su nombre.",
      },
      {
        name: "Trabaja sobre tus carpetas",
        description: "Usa los archivos donde ya los tenés guardados.",
      },
    ],
    useCases: ["Diseño", "Organización"],
    systemRequirements: [
      { label: "Sistema operativo", value: "Windows 10 o posterior" },
    ],
    licenseNote: null,
    published: true,
    featured: false,
    sortOrder: 20,
    archived: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
  {
    id: "dev-003",
    slug: "storyboard",
    appId: "storyboard-wana",
    name: "Storyboard Wana",
    shortDescription: "Armá el guion visual de un proyecto, cuadro por cuadro.",
    description:
      "Storyboard Wana ordena las escenas de un proyecto audiovisual en una grilla de cuadros, con una nota por escena, para poder ver el proyecto entero de un vistazo y compartirlo con el equipo.",
    price: {
      ARS: { amount: 3490000, currency: "ARS" },
      USD: { amount: 2700, currency: "USD" },
    },
    currency: "ARS",
    platforms: ["windows"],
    version: "1.0.0",
    licenseType: "perpetual",
    images: [],
    heroImage: null,
    downloadType: "installer",
    category: "diseno",
    features: [
      {
        name: "Cuadros en grilla",
        description: "Cada escena es un cuadro y se ven todos juntos.",
      },
      {
        name: "Notas por escena",
        description: "Escribís al lado de cada cuadro lo que pasa.",
      },
      {
        name: "Exportación",
        description: "Sacás el guion armado para compartirlo.",
      },
    ],
    useCases: ["Audiovisual", "Diseño", "Trabajo en equipo"],
    systemRequirements: [
      { label: "Sistema operativo", value: "Windows 10 o posterior" },
    ],
    licenseNote: null,
    published: true,
    featured: false,
    sortOrder: 30,
    archived: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
  {
    id: "dev-004",
    slug: "catalogador",
    appId: "catalogador-codigos",
    name: "Catalogador de productos",
    shortDescription: "Tu catálogo con códigos de barras listos para escanear.",
    description:
      "Catalogador arma la lista de productos de tu negocio y le genera a cada uno su código de barras, listo para imprimir y para escanear desde el mostrador.",
    price: {
      ARS: { amount: 1990000, currency: "ARS" },
      USD: { amount: 1500, currency: "USD" },
    },
    currency: "ARS",
    platforms: ["windows"],
    version: "0.9.0",
    licenseType: "perpetual",
    images: [],
    heroImage: null,
    downloadType: "installer",
    category: "comercio",
    features: [
      {
        name: "Lista de productos",
        description: "Cargás cada producto con su nombre y su precio.",
      },
      {
        name: "Códigos de barras",
        description: "Genera el código de cada producto de la lista.",
      },
      {
        name: "Impresión",
        description: "Sacás las etiquetas para pegar en la mercadería.",
      },
    ],
    useCases: ["Comercio", "Depósito", "Organización"],
    systemRequirements: [
      { label: "Sistema operativo", value: "Windows 10 o posterior" },
      { label: "Impresora", value: "Necesaria para imprimir etiquetas" },
    ],
    licenseNote:
      "Esta versión es previa a la 1.0 y su alcance puede cambiar antes del lanzamiento.",
    published: true,
    featured: false,
    sortOrder: 40,
    archived: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
  {
    id: "dev-005",
    slug: "calculadora",
    appId: "calculadora-cobro",
    name: "Calculadora de cobro",
    shortDescription: "Cuánto lleva, cuánto te da, cuánto va de vuelto.",
    description:
      "Calculadora de cobro resuelve la cuenta del mostrador: suma lo que lleva el cliente, toma lo que te entrega y te dice el vuelto, sin tener que hacerlo de memoria.",
    price: {
      ARS: { amount: 990000, currency: "ARS" },
      USD: { amount: 800, currency: "USD" },
    },
    currency: "ARS",
    platforms: ["windows"],
    version: "0.5.0",
    licenseType: "perpetual",
    images: [],
    heroImage: null,
    downloadType: "portable",
    category: "comercio",
    // Sin funciones ni requisitos cargados a propósito: sirve para comprobar que la
    // ficha no dibuja secciones vacías cuando el producto todavía no tiene datos.
    features: [],
    useCases: [],
    systemRequirements: [],
    licenseNote: null,
    // Sin publicar A PROPÓSITO: comprueba que `getPublishedProducts()` filtra de
    // verdad y que la ficha de un slug no publicado devuelve 404.
    published: false,
    featured: false,
    sortOrder: 50,
    archived: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
];
