import type { Product } from "@/types/product";
import { pick, type Locale } from "./shared";

type ProductCopy = Partial<
  Pick<
    Product,
    | "name"
    | "shortDescription"
    | "description"
    | "features"
    | "useCases"
    | "systemRequirements"
    | "licenseNote"
  >
>;

const ENGLISH_PRODUCTS: Record<string, ProductCopy> = {
  whisper: {
    shortDescription: "Write by speaking, without touching the keyboard.",
    description:
      "Whisper Solution turns your voice into text so you can write by speaking in apps and websites where you would normally use a keyboard. Dictate, and the text appears wherever you were working.",
    features: [
      { name: "Speech to text", description: "Speak and the program writes what you said." },
      {
        name: "Works across applications",
        description: "Text goes where you were typing, without copying and pasting.",
      },
      {
        name: "On-device processing",
        description: "Audio is transcribed on your computer.",
      },
    ],
    useCases: ["Work", "Study", "Writing"],
    systemRequirements: [
      { label: "Operating system", value: "Windows 10 or later" },
      { label: "Microphone", value: "Required" },
    ],
  },
  biblioteca: {
    shortDescription: "All your images and references in one place.",
    description:
      "Biblioteca Visual brings your designs, photos, and references together in one window so you can find them quickly instead of opening one folder after another.",
    features: [
      {
        name: "Library view",
        description: "See many images together without opening them one at a time.",
      },
      { name: "Search", description: "Find a reference by name." },
      {
        name: "Works with your folders",
        description: "Uses files where you already keep them.",
      },
    ],
    useCases: ["Design", "Organization"],
    systemRequirements: [
      { label: "Operating system", value: "Windows 10 or later" },
    ],
  },
  storyboard: {
    shortDescription: "Plan a project's visual story, frame by frame.",
    description:
      "Storyboard Wana arranges the scenes of an audiovisual project in a grid of frames, with a note for each scene, so you can see the whole project at a glance and share it with your team.",
    features: [
      {
        name: "Frame grid",
        description: "Each scene is a frame and you can see them all together.",
      },
      {
        name: "Scene notes",
        description: "Write what happens beside each frame.",
      },
      {
        name: "Export",
        description: "Export the completed storyboard to share it.",
      },
    ],
    useCases: ["Audiovisual", "Design", "Teamwork"],
    systemRequirements: [
      { label: "Operating system", value: "Windows 10 or later" },
    ],
  },
  catalogador: {
    name: "Product Cataloger",
    shortDescription: "Your catalog with barcodes ready to scan.",
    description:
      "Product Cataloger builds your business's product list and generates a barcode for each item, ready to print and scan at the counter.",
    features: [
      {
        name: "Product list",
        description: "Add each product with its name and price.",
      },
      {
        name: "Barcodes",
        description: "Generates a barcode for every product in the list.",
      },
      {
        name: "Printing",
        description: "Print labels to attach to your goods.",
      },
    ],
    useCases: ["Retail", "Warehouse", "Organization"],
    systemRequirements: [
      { label: "Operating system", value: "Windows 10 or later" },
      { label: "Printer", value: "Required to print labels" },
    ],
    licenseNote:
      "This is a pre-1.0 release. Its scope may change before launch.",
  },
};

const PORTUGUESE_PRODUCTS: Record<string, ProductCopy> = {
  whisper: {
    shortDescription: "Escreva falando, sem tocar no teclado.",
    description:
      "O Whisper Solution transforma sua voz em texto para você escrever falando em aplicativos e sites onde normalmente usaria o teclado. Dite, e o texto aparece onde você estava trabalhando.",
    features: [
      { name: "Voz para texto", description: "Fale e o programa escreve o que você disse." },
      {
        name: "Funciona em qualquer aplicativo",
        description: "O texto vai para onde você estava digitando, sem copiar e colar.",
      },
      {
        name: "Processamento no computador",
        description: "O áudio é transcrito no seu próprio computador.",
      },
    ],
    useCases: ["Trabalho", "Estudo", "Escrita"],
    systemRequirements: [
      { label: "Sistema operacional", value: "Windows 10 ou superior" },
      { label: "Microfone", value: "Necessário" },
    ],
  },
  biblioteca: {
    shortDescription: "Todas as suas imagens e referências em um só lugar.",
    description:
      "O Biblioteca Visual reúne seus designs, fotos e referências em uma única janela para você encontrá-los rápido, sem abrir uma pasta depois da outra.",
    features: [
      {
        name: "Visualização em biblioteca",
        description: "Veja muitas imagens juntas sem abrir uma por uma.",
      },
      { name: "Busca", description: "Encontre uma referência pelo nome." },
      {
        name: "Funciona com suas pastas",
        description: "Usa os arquivos onde você já os guarda.",
      },
    ],
    useCases: ["Design", "Organização"],
    systemRequirements: [
      { label: "Sistema operacional", value: "Windows 10 ou superior" },
    ],
  },
  storyboard: {
    shortDescription: "Monte o roteiro visual de um projeto, quadro a quadro.",
    description:
      "O Storyboard Wana organiza as cenas de um projeto audiovisual em uma grade de quadros, com uma nota para cada cena, para você ver o projeto inteiro de relance e compartilhá-lo com sua equipe.",
    features: [
      {
        name: "Grade de quadros",
        description: "Cada cena é um quadro e você vê todas juntas.",
      },
      {
        name: "Notas por cena",
        description: "Escreva o que acontece ao lado de cada quadro.",
      },
      {
        name: "Exportação",
        description: "Exporte o storyboard pronto para compartilhar.",
      },
    ],
    useCases: ["Audiovisual", "Design", "Trabalho em equipe"],
    systemRequirements: [
      { label: "Sistema operacional", value: "Windows 10 ou superior" },
    ],
  },
  catalogador: {
    name: "Catalogador de Produtos",
    shortDescription: "Seu catálogo com códigos de barras prontos para escanear.",
    description:
      "O Catalogador de Produtos monta a lista de produtos do seu negócio e gera um código de barras para cada item, pronto para imprimir e escanear no balcão.",
    features: [
      {
        name: "Lista de produtos",
        description: "Adicione cada produto com nome e preço.",
      },
      {
        name: "Códigos de barras",
        description: "Gera um código de barras para cada produto da lista.",
      },
      {
        name: "Impressão",
        description: "Imprima etiquetas para colar nas suas mercadorias.",
      },
    ],
    useCases: ["Comércio", "Depósito", "Organização"],
    systemRequirements: [
      { label: "Sistema operacional", value: "Windows 10 ou superior" },
      { label: "Impressora", value: "Necessária para imprimir etiquetas" },
    ],
    licenseNote:
      "Esta é uma versão anterior à 1.0. O alcance pode mudar antes do lançamento.",
  },
};

/**
 * These translations affect presentation only. Product IDs, prices, licenses,
 * and order data always come from the original catalog record.
 */
export function localizeProduct(product: Product, locale: Locale): Product {
  if (locale === "es") return product;
  const copy = (locale === "pt" ? PORTUGUESE_PRODUCTS : ENGLISH_PRODUCTS)[product.slug];
  if (copy === undefined) return product;
  return {
    ...product,
    ...copy,
    heroImage:
      product.heroImage === null
        ? null
        : {
            ...product.heroImage,
            alt:
              product.slug === "biblioteca"
                ? pick(locale, product.heroImage.alt, "Biblioteca Visual software box.", "Caixa do software Biblioteca Visual.")
                : product.heroImage.alt,
          },
  };
}
