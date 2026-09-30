import { describe, expect, it } from "vitest";

import {
  calcularRendimientoLote,
  listarLotesConProduccion,
  obtenerSemaforo,
  UMBRAL_BUENO,
  UMBRAL_EXCELENTE,
  UMBRAL_REGULAR,
  type RegistroRendimiento,
} from "./rendimiento";

const registro = (parcial: Partial<RegistroRendimiento>): RegistroRendimiento => ({
  lote_id: "l1",
  peso_total_kg: 1000,
  calidad: "primera",
  costo_fruta: 5000,
  costo_insumos: 500,
  costo_total: 5500,
  cantidad_cajas: 50,
  ...parcial,
});

describe("calcularRendimientoLote", () => {
  it("reparte el balance por calidad sobre lo procesado", () => {
    const r = calcularRendimientoLote(
      [
        registro({ peso_total_kg: 7000, calidad: "primera" }),
        registro({ peso_total_kg: 2000, calidad: "segunda" }),
        registro({ peso_total_kg: 1000, calidad: "industria", cantidad_cajas: 0 }),
      ],
      20000
    );

    expect(r.totalKg).toBe(10000);
    expect(r.pctVerde).toBe(70);
    expect(r.pctAlimonado).toBe(20);
    expect(r.pctAmarillo).toBe(10);
    expect(r.avance).toBe(50);
    expect(r.semaforo).toBe("excelente");
  });

  it("acumula costos y calcula el costo real por caja", () => {
    const r = calcularRendimientoLote(
      [
        registro({ costo_fruta: 5000, costo_insumos: 500, costo_total: 5500, cantidad_cajas: 50 }),
        registro({ costo_fruta: 5000, costo_insumos: 500, costo_total: 5500, cantidad_cajas: 50 }),
      ],
      10000
    );

    expect(r.cajas).toBe(100);
    expect(r.costoFruta).toBe(10000);
    expect(r.costoInsumos).toBe(1000);
    expect(r.costoTotal).toBe(11000);
    expect(r.costoPorCaja).toBe(110);
  });

  it("devuelve ceros y semáforo crítico sin registros", () => {
    const r = calcularRendimientoLote([], 10000);

    expect(r).toMatchObject({
      totalKg: 0,
      pctVerde: 0,
      avance: 0,
      cajas: 0,
      costoPorCaja: 0,
      semaforo: "critico",
    });
  });

  it("ignora registros sin kilos y tolera nulos", () => {
    const r = calcularRendimientoLote(
      [registro({ peso_total_kg: null, calidad: null, costo_total: null, cantidad_cajas: null })],
      0
    );

    expect(r.totalKg).toBe(0);
    expect(r.avance).toBe(0);
  });
});

describe("obtenerSemaforo", () => {
  it("respeta los umbrales configurados", () => {
    expect(obtenerSemaforo(UMBRAL_EXCELENTE * 100)).toBe("excelente");
    expect(obtenerSemaforo(UMBRAL_EXCELENTE * 100 - 0.1)).toBe("bueno");
    expect(obtenerSemaforo(UMBRAL_BUENO * 100)).toBe("bueno");
    expect(obtenerSemaforo(UMBRAL_REGULAR * 100)).toBe("regular");
    expect(obtenerSemaforo(UMBRAL_REGULAR * 100 - 0.1)).toBe("critico");
    expect(obtenerSemaforo(Number.NaN)).toBe("critico");
  });
});

describe("listarLotesConProduccion", () => {
  it("lista cada lote una vez con su número", () => {
    const opciones = listarLotesConProduccion(
      [
        registro({ lote_id: "l2" }),
        registro({ lote_id: "l1" }),
        registro({ lote_id: "l2" }),
        registro({ lote_id: null }),
      ],
      { l1: "L-0001", l2: "L-0002" }
    );

    expect(opciones).toEqual([
      { id: "l1", numero: "L-0001" },
      { id: "l2", numero: "L-0002" },
    ]);
  });
});
