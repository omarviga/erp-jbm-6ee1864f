import { describe, expect, it } from "vitest";

import {
  calcularKpisProduccion,
  esHoy,
  obtenerUltimosRegistros,
  type RegistroProduccionKpi,
} from "./kpis";

const ahora = new Date("2026-03-10T12:00:00");

const registro = (
  parcial: Partial<RegistroProduccionKpi> & { lote_id: string | null }
): RegistroProduccionKpi => ({
  peso_total_kg: 1000,
  created_at: "2026-03-10T10:00:00",
  destino: "piso_empaque",
  calibre: "V-X",
  color: "verde",
  cantidad_cajas: 50,
  ...parcial,
});

describe("calcularKpisProduccion", () => {
  it("devuelve ceros sin datos", () => {
    expect(calcularKpisProduccion([], [], ahora)).toEqual({
      eficiencia: 0,
      merma: 0,
      produccionHoy: 0,
    });
  });

  it("calcula el avance sobre los kilos netos de lotes activos", () => {
    const kpis = calcularKpisProduccion(
      [registro({ lote_id: "l1", peso_total_kg: 2500 })],
      [{ id: "l1", peso_neto: 10000 }],
      ahora
    );

    expect(kpis.eficiencia).toBe(25);
    expect(kpis.produccionHoy).toBe(2500);
  });

  it("limita la eficiencia a 100 cuando hay reprocesos", () => {
    const kpis = calcularKpisProduccion(
      [registro({ lote_id: "l1", peso_total_kg: 12000 })],
      [{ id: "l1", peso_neto: 10000 }],
      ahora
    );

    expect(kpis.eficiencia).toBe(100);
  });

  it("mide la merma como lo enviado a molino sobre lo procesado", () => {
    const kpis = calcularKpisProduccion(
      [
        registro({ lote_id: "l1", peso_total_kg: 3000 }),
        registro({
          lote_id: "l1",
          peso_total_kg: 1000,
          destino: "molino",
          calibre: "AM-X",
          color: "amarillo",
          cantidad_cajas: 0,
        }),
      ],
      [{ id: "l1", peso_neto: 10000 }],
      ahora
    );

    expect(kpis.merma).toBe(25);
  });

  it("solo suma a hoy los registros del día local actual", () => {
    const kpis = calcularKpisProduccion(
      [
        registro({ lote_id: "l1", peso_total_kg: 2000 }),
        registro({
          lote_id: "l1",
          peso_total_kg: 5000,
          created_at: "2026-03-09T23:00:00",
        }),
      ],
      [{ id: "l1", peso_neto: 10000 }],
      ahora
    );

    expect(kpis.produccionHoy).toBe(2000);
  });

  it("tolera pesos nulos sin romper los cálculos", () => {
    const kpis = calcularKpisProduccion(
      [registro({ lote_id: "l1", peso_total_kg: null })],
      [{ id: "l1", peso_neto: null }],
      ahora
    );

    expect(kpis).toEqual({ eficiencia: 0, merma: 0, produccionHoy: 0 });
  });
});

describe("esHoy", () => {
  it("compara por día local y rechaza fechas inválidas", () => {
    expect(esHoy("2026-03-10T00:00:01", ahora)).toBe(true);
    expect(esHoy("2026-03-09T23:59:59", ahora)).toBe(false);
    expect(esHoy("no-fecha", ahora)).toBe(false);
  });
});

describe("obtenerUltimosRegistros", () => {
  it("ordena por fecha descendente y respeta el límite", () => {
    const registros = [
      registro({ lote_id: "l1", created_at: "2026-03-08T10:00:00" }),
      registro({
        lote_id: "l1",
        calibre: "V-XX",
        cantidad_cajas: 20,
        created_at: "2026-03-10T10:00:00",
      }),
      registro({
        lote_id: "l1",
        calibre: "AL-X",
        color: "alimonado",
        cantidad_cajas: 30,
        created_at: "2026-03-09T10:00:00",
      }),
    ];

    const ultimos = obtenerUltimosRegistros(registros, 2);

    expect(ultimos).toEqual([
      { calibre: "V-XX", color: "verde", qty: 20 },
      { calibre: "AL-X", color: "alimonado", qty: 30 },
    ]);
  });
});
