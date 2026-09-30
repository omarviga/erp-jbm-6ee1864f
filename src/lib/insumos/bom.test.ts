import { describe, expect, it } from "vitest";
import {
  agruparStockPorTipo,
  calcularCapacidad,
  calcularCostos,
  etiquetaPluParaCalibre,
  simularCorrida,
  type LineaConsumo,
} from "./bom";

const cantidad = (lineas: LineaConsumo[], material: LineaConsumo["material"]) =>
  lineas.find((l) => l.material === material)?.cantidad;

describe("simularCorrida", () => {
  it("reproduce el ejemplo: 500 cajas export 18.14 kg", () => {
    const r = simularCorrida("exp-18", 500, "V-XX");
    expect(r.frutaKg).toBeCloseTo(9070, 6);
    expect(cantidad(r.lineas, "envase")).toBe(500);
    expect(cantidad(r.lineas, "tarimas")).toBe(10); // ceil(500/54)
    expect(cantidad(r.lineas, "esquineros")).toBe(40);
    expect(cantidad(r.lineas, "grapas")).toBe(40);
    expect(cantidad(r.lineas, "plu")).toBe(500);
    expect(r.plu).toBe("4048");
    expect(cantidad(r.lineas, "senasica")).toBe(500);
    expect(cantidad(r.lineas, "cera")).toBeCloseTo(4.535, 3);
    expect(r.ceraTambos).toBeCloseTo(0.022675, 6);
    expect(cantidad(r.lineas, "papel")).toBe(500);
  });

  it("respeta encerado y papel por presentación", () => {
    const master = simularCorrida("master-15", 60, "V");
    expect(master.plu).toBe("4045");
    expect(cantidad(master.lineas, "tarimas")).toBe(1);
    expect(cantidad(master.lineas, "cera")).toBeCloseTo(0.45, 6); // 900 kg × 0.0005
    expect(cantidad(master.lineas, "papel")).toBe(0);

    const nacional = simularCorrida("nac-20", 48, "IV");
    expect(cantidad(nacional.lineas, "tarimas")).toBe(1);
    expect(cantidad(nacional.lineas, "cera")).toBe(0);
    expect(cantidad(nacional.lineas, "papel")).toBe(0);

    const arpilla = simularCorrida("arpilla-25", 40, "III");
    expect(cantidad(arpilla.lineas, "tarimas")).toBe(1);
    expect(arpilla.presentacion.envaseTipo).toBe("arpilla");
  });

  it("redondea tarimas parciales hacia arriba", () => {
    const r = simularCorrida("gourmet-45", 121, "V-X");
    expect(cantidad(r.lineas, "tarimas")).toBe(2); // ceil(121/120)
    expect(cantidad(r.lineas, "esquineros")).toBe(8);
  });
});

describe("etiquetaPluParaCalibre", () => {
  it("asigna 4048 a calibres grandes y 4045 al resto", () => {
    expect(etiquetaPluParaCalibre("V-X")).toBe("4048");
    expect(etiquetaPluParaCalibre("V-XX")).toBe("4048");
    expect(etiquetaPluParaCalibre("V-XXX")).toBe("4048");
    expect(etiquetaPluParaCalibre("V")).toBe("4045");
    expect(etiquetaPluParaCalibre("IV")).toBe("4045");
    expect(etiquetaPluParaCalibre("III")).toBe("4045");
  });
});

describe("calcularCapacidad", () => {
  const lineas = simularCorrida("exp-18", 500, "V-XX").lineas;

  it("detecta el cuello de botella (mínimo entre materiales)", () => {
    const { maxCajas, limitante } = calcularCapacidad(lineas, {
      envase: 10000,
      tarimas: 6, // 6 × 54 = 324
      esquineros: 23, // floor(23 × 54 / 4) = 310
      grapas: 10000,
      plu: 10000,
      senasica: 10000,
      cera: 100,
      papel: 10000,
    });
    expect(maxCajas).toBe(310);
    expect(limitante).toBe("esquineros");
  });

  it("ignora materiales sin dato de stock y sin aplicación", () => {
    const nac = simularCorrida("nac-20", 48, "V").lineas;
    const r = calcularCapacidad(nac, { envase: 100 });
    expect(r.maxCajas).toBe(100);
    expect(r.limitante).toBe("envase");
    expect(
      r.porMaterial.find((p) => p.material === "cera")?.maxCajas,
    ).toBeNull();
  });

  it("devuelve null sin ningún dato de stock", () => {
    expect(calcularCapacidad(lineas, {}).maxCajas).toBeNull();
  });
});

describe("calcularCostos", () => {
  it("totaliza y prorratea por caja y por kilo", () => {
    const r = simularCorrida("exp-18", 500, "V-XX");
    const c = calcularCostos(r.lineas, r.boxes, r.frutaKg, {
      envase: 10,
      tarimas: 100,
      esquineros: 5,
      grapas: 1,
      plu: 0.5,
      senasica: 0.5,
      cera: 200,
      papel: 0.3,
    });
    // 5000 + 1000 + 200 + 40 + 250 + 250 + 907 + 150
    expect(c.total).toBeCloseTo(7797, 2);
    expect(c.porCaja).toBeCloseTo(15.594, 2);
    expect(c.porKilo).toBeCloseTo(0.8596, 3);
    expect(c.sinCosto).toEqual([]);
  });

  it("reporta materiales sin costo", () => {
    const r = simularCorrida("exp-18", 10, "V");
    const c = calcularCostos(r.lineas, r.boxes, r.frutaKg, { envase: 10 });
    expect(c.total).toBe(100);
    expect(c.sinCosto).toContain("tarimas");
  });
});

describe("agruparStockPorTipo", () => {
  it("suma stock y pondera costo por existencia", () => {
    const g = agruparStockPorTipo([
      { tipo: "caja_carton", stock: 100, costo: 10 },
      { tipo: "caja_carton", stock: 300, costo: 20 },
      { tipo: "tarima", stock: 5, costo: 100 },
    ]);
    expect(g["caja_carton"].stock).toBe(400);
    expect(g["caja_carton"].costo).toBe(17.5);
    expect(g["tarima"]).toEqual({ stock: 5, costo: 100 });
  });
});
