import { describe, expect, it } from "vitest";

import {
  calcularReporteDescarte,
  generarCsvDescarte,
  obtenerDetalleMerma,
  obtenerDetalleMolino,
  TIPO_MERMA,
  TIPO_MOLINO,
  type LoteDescarte,
  type RegistroDescarte,
} from "./descarte";

const ahora = new Date("2026-03-10T12:00:00");

const registro = (
  parcial: Partial<RegistroDescarte> & { lote_id: string | null }
): RegistroDescarte => ({
  peso_total_kg: 1000,
  created_at: "2026-03-10T10:00:00",
  destino: "piso_empaque",
  calibre: "V-X",
  ...parcial,
});

const lote = (parcial: Partial<LoteDescarte> & { id: string }): LoteDescarte => ({
  numero_lote: `L-${parcial.id}`,
  peso_neto: 10000,
  kilos_merma: 500,
  fecha_recepcion: "2026-03-10T08:00:00",
  ...parcial,
});

describe("calcularReporteDescarte", () => {
  it("devuelve vacío sin descarte", () => {
    expect(
      calcularReporteDescarte([registro({ lote_id: "l1" })], [lote({ id: "l1", kilos_merma: 0 })], ahora)
    ).toEqual([]);
    expect(calcularReporteDescarte([], [], ahora)).toEqual([]);
  });

  it("reporta el molino con su impacto sobre lo procesado", () => {
    const filas = calcularReporteDescarte(
      [
        registro({ lote_id: "l1", peso_total_kg: 3000 }),
        registro({ lote_id: "l1", peso_total_kg: 1000, destino: "molino", calibre: "AM-X" }),
      ],
      [lote({ id: "l1", kilos_merma: 0 })],
      ahora
    );

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ tipo: TIPO_MOLINO, kg: 1000, impacto: 25 });
  });

  it("suma la merma solo de lotes con producción", () => {
    const filas = calcularReporteDescarte(
      [registro({ lote_id: "l1", peso_total_kg: 2000 })],
      [
        lote({ id: "l1", kilos_merma: 400, peso_neto: 10000 }),
        lote({ id: "l2", kilos_merma: 9000, peso_neto: 10000 }),
      ],
      ahora
    );

    const merma = filas.find((f) => f.tipo === TIPO_MERMA);
    expect(merma).toMatchObject({ kg: 400, impacto: 4 });
  });

  it("marca Alza cuando el descarte crece contra la semana previa", () => {
    const filas = calcularReporteDescarte(
      [
        registro({ lote_id: "l1", peso_total_kg: 100, destino: "molino", created_at: "2026-02-28T10:00:00" }),
        registro({ lote_id: "l1", peso_total_kg: 1000, destino: "molino", created_at: "2026-03-10T10:00:00" }),
      ],
      [lote({ id: "l1", kilos_merma: 0 })],
      ahora
    );

    expect(filas[0].tendencia).toBe("Alza");
  });

  it("marca Estable sin movimiento en ambas ventanas", () => {
    const filas = calcularReporteDescarte(
      [
        registro({ lote_id: "l1", peso_total_kg: 500, destino: "molino", created_at: "2026-01-05T10:00:00" }),
      ],
      [lote({ id: "l1", kilos_merma: 0 })],
      ahora
    );

    expect(filas[0].tendencia).toBe("Estable");
  });
});

describe("obtenerDetalleMolino", () => {
  it("resuelve el número de lote y ordena por fecha", () => {
    const detalle = obtenerDetalleMolino(
      [
        registro({ lote_id: "l1", peso_total_kg: 100, destino: "molino", calibre: "AM-X", created_at: "2026-03-09T10:00:00" }),
        registro({ lote_id: "l9", peso_total_kg: 200, destino: "molino", calibre: "AM-XX", created_at: "2026-03-10T10:00:00" }),
        registro({ lote_id: "l1", peso_total_kg: 300, destino: "piso_empaque" }),
      ],
      { l1: "L-0001" }
    );

    expect(detalle).toEqual([
      { fecha: "2026-03-10T10:00:00", lote: "—", calibre: "AM-XX", kg: 200 },
      { fecha: "2026-03-09T10:00:00", lote: "L-0001", calibre: "AM-X", kg: 100 },
    ]);
  });
});

describe("obtenerDetalleMerma", () => {
  it("ordena por kilos de merma y calcula el porcentaje", () => {
    const detalle = obtenerDetalleMerma(
      [
        lote({ id: "l1", numero_lote: "L-1", kilos_merma: 200, peso_neto: 10000 }),
        lote({ id: "l2", numero_lote: "L-2", kilos_merma: 800, peso_neto: 10000 }),
        lote({ id: "l3", numero_lote: "L-3", kilos_merma: 5000, peso_neto: 10000 }),
      ],
      { l1: 1000, l2: 2000 }
    );

    expect(detalle).toEqual([
      { lote: "L-2", mermaKg: 800, pct: 8 },
      { lote: "L-1", mermaKg: 200, pct: 2 },
    ]);
  });
});

describe("generarCsvDescarte", () => {
  it("genera encabezado y filas en formato Excel español", () => {
    const csv = generarCsvDescarte([
      { tipo: TIPO_MOLINO, kg: 1000, impacto: 25, tendencia: "Alza" },
      { tipo: TIPO_MERMA, kg: 400.5, impacto: 4, tendencia: "Estable" },
    ]);

    expect(csv).toContain("Tipo;Kilos (kg);Impacto (%);Tendencia");
    expect(csv).toContain("Fruta a molino;1000,00;25,0;Alza");
    expect(csv).toContain("Merma de recepción;400,50;4,0;Estable");
  });
});
