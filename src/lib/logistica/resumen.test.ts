import { describe, expect, it } from "vitest";

import {
  calcularKpisLogistica,
  filtrarGuias,
  folioGuia,
  generarCsvContable,
  type ResumenGuia,
} from "./resumen";

const guia = (parcial: Partial<ResumenGuia> & { id: string }): ResumenGuia => ({
  folio: `CP-${parcial.id}`,
  estado: "generada",
  total_cajas: 100,
  peso_total: 1800,
  valor_total: 50000,
  certificado_fitosanitario: true,
  lugar_origen: "Apatzingán",
  lugar_destino: "CDMX",
  created_at: "2026-03-10T10:00:00",
  clientes: { nombre: "Cliente CDMX" },
  ...parcial,
});

describe("calcularKpisLogistica", () => {
  it("devuelve ceros y nulo sin guías", () => {
    expect(calcularKpisLogistica([])).toEqual({
      embarquesActivos: 0,
      cajasDespachadas: 0,
      toneladas: 0,
      cumplimientoFito: null,
    });
  });

  it("cuenta activas, cajas y toneladas", () => {
    const kpis = calcularKpisLogistica([
      guia({ id: "1", total_cajas: 100, peso_total: 1800 }),
      guia({ id: "2", estado: "validada", total_cajas: 50, peso_total: 900 }),
      guia({ id: "3", estado: "cancelada", total_cajas: 999, peso_total: 99999 }),
      guia({ id: "4", estado: "borrador", total_cajas: 999, peso_total: 99999 }),
    ]);

    expect(kpis.embarquesActivos).toBe(2);
    expect(kpis.cajasDespachadas).toBe(150);
    expect(kpis.toneladas).toBe(2.7);
  });

  it("mide el cumplimiento fitosanitario excluyendo canceladas", () => {
    const kpis = calcularKpisLogistica([
      guia({ id: "1", certificado_fitosanitario: true }),
      guia({ id: "2", certificado_fitosanitario: false }),
      guia({ id: "3", estado: "cancelada", certificado_fitosanitario: false }),
    ]);

    expect(kpis.cumplimientoFito).toBe(50);
  });
});

describe("folioGuia", () => {
  it("prefiere folio y cae a número de guía", () => {
    expect(folioGuia({ folio: "CP-1", numero_guia: "G-1" })).toBe("CP-1");
    expect(folioGuia({ folio: null, numero_guia: "G-1" })).toBe("G-1");
    expect(folioGuia({})).toBe("—");
  });
});

describe("filtrarGuias", () => {
  const guias = [
    guia({ id: "1", folio: "CP30-JBM-001", clientes: { nombre: "Texas Fresh" } }),
    guia({ id: "2", folio: "CP30-JBM-002", estado: "cancelada", clientes: { nombre: "CDMX Abasto" } }),
  ];

  it("filtra por texto en folio o cliente", () => {
    expect(filtrarGuias(guias, { texto: "texas", estado: "todos" })).toHaveLength(1);
    expect(filtrarGuias(guias, { texto: "CP30-JBM-002", estado: "todos" })[0].id).toBe("2");
  });

  it("filtra por estado exacto", () => {
    expect(filtrarGuias(guias, { texto: "", estado: "cancelada" }).map((g) => g.id)).toEqual(["2"]);
    expect(filtrarGuias(guias, { texto: "abasto", estado: "generada" })).toHaveLength(0);
  });
});

describe("generarCsvContable", () => {
  it("genera encabezado y filas estables en español", () => {
    const csv = generarCsvContable([guia({ id: "1", folio: "CP-1" })]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Folio;Fecha;Cliente;Origen;Destino;Estado;Cajas;Peso kg;Valor MXN;Fitosanitario");
    expect(csv).toContain("CP-1;10/03/2026;Cliente CDMX;Apatzingán;CDMX;generada;100;1800,00;50000,00;SI");
  });

  it("marca NO sin certificado y tolera vacíos", () => {
    const csv = generarCsvContable([
      guia({ id: "9", folio: null, numero_guia: "G-9", certificado_fitosanitario: false, clientes: null }),
    ]);

    expect(csv).toContain("G-9;");
    expect(csv).toContain(";NO");
  });
});
