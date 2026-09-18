import assert from "node:assert/strict";
import test from "node:test";
import { getVisitSummary, recordVisit, visitDay } from "@/features/analytics/visits";
import { MemoryStore } from "@/test-support/world";

test("el día se corta en hora de Argentina, no en UTC", () => {
  // 02:30 UTC del 1/10 todavía es 30/9 a la noche en Argentina (UTC-3).
  assert.equal(visitDay(new Date("2026-10-01T02:30:00Z")), "2026-09-30");
  assert.equal(visitDay(new Date("2026-10-01T03:30:00Z")), "2026-10-01");
});

test("cada visita suma en el día, el mes y el año", async () => {
  const store = new MemoryStore();
  await recordVisit("2026-09-17", store);
  await recordVisit("2026-09-18", store);
  await recordVisit("2026-09-18", store);
  await recordVisit("2026-08-02", store);

  const resumen = await getVisitSummary(new Date("2026-09-18T15:00:00Z"), store);
  assert.equal(resumen.hoy, 2);
  assert.equal(resumen.ayer, 1);
  assert.equal(resumen.mes, 3);
  assert.equal(resumen.anio, 4);
  assert.equal(resumen.dias.length, 14);
  assert.equal(resumen.dias.at(-1)?.dia, "2026-09-18");
  assert.deepEqual(
    resumen.meses.slice(-2).map((m) => [m.mes, m.visitas]),
    [["2026-08", 1], ["2026-09", 3]],
  );
});

test("visitas simultáneas no se pisan", async () => {
  const store = new MemoryStore();
  await Promise.all(Array.from({ length: 6 }, () => recordVisit("2026-09-18", store)));
  const resumen = await getVisitSummary(new Date("2026-09-18T15:00:00Z"), store);
  assert.equal(resumen.hoy, 6);
  assert.equal(resumen.anio, 6);
});
