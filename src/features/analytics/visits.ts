import "server-only";

import { getKeyValueStore, STORES, type KeyValueStore } from "@/lib/storage/store";

/**
 * Contador de visitas de la tienda.
 *
 * Una "visita" es una persona (un navegador) que entra a la tienda en un día. Si
 * recarga o recorre varias páginas ese mismo día, no vuelve a sumar. Se guardan
 * solo totales: ni IP, ni navegador, ni datos personales.
 *
 * Cada visita suma en tres contadores a la vez (día, mes y año), así el panel lee
 * pocos valores y no tiene que recorrer todos los días del año.
 *
 * Los días se cortan en hora de Argentina, que es donde se opera la tienda.
 */

const ZONA = "America/Argentina/Buenos_Aires";

interface Contador {
  readonly visitas: number;
  readonly updatedAt: string;
}

/** Fecha `AAAA-MM-DD` en hora de Argentina. */
export function visitDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const claveDia = (dia: string) => `dia:${dia}`;
const claveMes = (dia: string) => `mes:${dia.slice(0, 7)}`;
const claveAnio = (dia: string) => `anio:${dia.slice(0, 4)}`;

/** Suma 1 con escritura condicional: dos visitas simultáneas no se pisan. */
async function sumarUno(store: KeyValueStore, clave: string): Promise<void> {
  for (let intento = 0; intento < 8; intento += 1) {
    const ahora = new Date().toISOString();
    const actual = await store.getWithVersion<Contador>(clave);
    if (actual === null) {
      if (await store.setIfAbsent<Contador>(clave, { visitas: 1, updatedAt: ahora })) return;
      continue;
    }
    const siguiente: Contador = { visitas: actual.value.visitas + 1, updatedAt: ahora };
    if (await store.setIfVersion(clave, siguiente, actual.version)) return;
  }
  // Tras varios choques seguidos se pierde esta visita: es un contador, no contabilidad.
}

export async function recordVisit(
  dia: string = visitDay(),
  store: KeyValueStore = getKeyValueStore(STORES.visits),
): Promise<void> {
  await Promise.all([
    sumarUno(store, claveDia(dia)),
    sumarUno(store, claveMes(dia)),
    sumarUno(store, claveAnio(dia)),
  ]);
}

/* ------------------------------ lectura ------------------------------ */

export interface VisitSummary {
  readonly hoy: number;
  readonly ayer: number;
  readonly mes: number;
  readonly anio: number;
  /** Últimos 14 días, del más viejo al de hoy. */
  readonly dias: readonly { readonly dia: string; readonly visitas: number }[];
  /** Meses del año en curso hasta el actual. */
  readonly meses: readonly { readonly mes: string; readonly visitas: number }[];
}

function restarDias(dia: string, cantidad: number): string {
  // Mediodía UTC: evita saltar de fecha por el cambio de zona horaria.
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - cantidad);
  return fecha.toISOString().slice(0, 10);
}

export async function getVisitSummary(
  now: Date = new Date(),
  store: KeyValueStore = getKeyValueStore(STORES.visits),
): Promise<VisitSummary> {
  const hoy = visitDay(now);
  const leer = async (clave: string) => (await store.get<Contador>(clave))?.visitas ?? 0;

  const ultimosDias = Array.from({ length: 14 }, (_, i) => restarDias(hoy, 13 - i));
  const anio = hoy.slice(0, 4);
  const mesActual = Number(hoy.slice(5, 7));
  const mesesDelAnio = Array.from(
    { length: mesActual },
    (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`,
  );

  const [dias, meses, totalAnio] = await Promise.all([
    Promise.all(ultimosDias.map(async (dia) => ({ dia, visitas: await leer(claveDia(dia)) }))),
    Promise.all(mesesDelAnio.map(async (mes) => ({ mes, visitas: await leer(`mes:${mes}`) }))),
    leer(claveAnio(hoy)),
  ]);

  return {
    hoy: dias[dias.length - 1]?.visitas ?? 0,
    ayer: dias[dias.length - 2]?.visitas ?? 0,
    mes: meses[meses.length - 1]?.visitas ?? 0,
    anio: totalAnio,
    dias,
    meses,
  };
}
