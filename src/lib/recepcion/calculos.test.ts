import { describe, expect, it } from "vitest";

import {
  calcularHistorialPrecios,
  calcularPagoCortador,
  calcularRecepcion,
  formatearFolioRecepcion,
  obtenerDictamen,
  validarPasoRecepcion,
  type EntradaCalculoRecepcion,
  type PrecioHistorico,
} from "./calculos";

const entradaBase: EntradaCalculoRecepcion = {
  pesoBruto: 10000,
  taraVehiculo: 3200,
  taraRejasKg: 0,
  precioKg: 5,
  defectosPct: 0,
  incluirBascula: false,
  costoBascula: 50,
  basculaFormaPago: "liquidacion",
  incluirManiobra: false,
  cuotaManiobraKg: 0,
  rejas: 0,
  segundaPesadaCapturada: true,
  requiereHuerto: false,
  huertoSeleccionado: false,
};

describe("calcularRecepcion", () => {
  it("calcula el peso neto descontando la tara del vehículo", () => {
    const resultado = calcularRecepcion(entradaBase);

    expect(resultado.taraTotal).toBe(3200);
    expect(resultado.pesoNetoFisico).toBe(6800);
    expect(resultado.pesoNeto).toBe(6800);
    expect(resultado.subtotal).toBe(34000);
    expect(resultado.totalLiquidar).toBe(34000);
    expect(resultado.errores).toEqual([]);
  });

  it("suma la tara de rejas/tarimas dentro de la tara total", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      taraRejasKg: 180,
      rejas: 12,
    });

    expect(resultado.taraTotal).toBe(3380);
    expect(resultado.pesoNeto).toBe(6620);
    expect(resultado.subtotal).toBe(33100);
  });

  it("registra la merma por defectos sin descontarla del pago (regla de peso neto)", () => {
    const resultado = calcularRecepcion({ ...entradaBase, defectosPct: 15 });

    expect(resultado.kilosMerma).toBe(1020);
    expect(resultado.pesoNeto).toBe(6800);
    expect(resultado.subtotal).toBe(34000);
    expect(resultado.dictamen).toBe("observado");
  });

  it("descuenta la báscula cuando se liquida contra el lote", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      incluirBascula: true,
      basculaFormaPago: "liquidacion",
    });

    expect(resultado.basculaDescontada).toBe(50);
    expect(resultado.basculaEnEfectivo).toBe(0);
    expect(resultado.totalDeducciones).toBe(50);
    expect(resultado.totalLiquidar).toBe(33950);
  });

  it("no descuenta la báscula cuando se cobró en efectivo al momento", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      incluirBascula: true,
      basculaFormaPago: "efectivo",
    });

    expect(resultado.basculaDescontada).toBe(0);
    expect(resultado.basculaEnEfectivo).toBe(50);
    expect(resultado.totalLiquidar).toBe(34000);
    expect(
      resultado.advertencias.some((a) => a.includes("efectivo"))
    ).toBe(true);
  });

  it("cobra la maniobra por kilo sobre el peso neto junto con la báscula", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      incluirBascula: true,
      basculaFormaPago: "liquidacion",
      incluirManiobra: true,
      cuotaManiobraKg: 0.35,
    });

    expect(resultado.cuotaManiobraTotal).toBe(2380);
    expect(resultado.totalDeducciones).toBe(2430);
    expect(resultado.totalLiquidar).toBe(31570);
  });

  it("nunca deja el total a liquidar en negativo", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      precioKg: 0.01,
      incluirBascula: true,
      basculaFormaPago: "liquidacion",
      costoBascula: 500,
    });

    expect(resultado.totalLiquidar).toBe(0);
  });

  it("bloquea el registro cuando la tara es mayor o igual al peso bruto", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      pesoBruto: 3000,
      taraVehiculo: 3200,
    });

    expect(resultado.pesoNetoFisico).toBe(0);
    expect(resultado.errores).toHaveLength(1);
    expect(resultado.errores[0]).toContain("tara total");
  });

  it("exige huerto en cosecha propia", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      requiereHuerto: true,
      huertoSeleccionado: false,
    });

    expect(resultado.errores).toContain(
      "La cosecha propia requiere seleccionar el huerto de origen."
    );
  });

  it("rechaza el lote con 20% o más de defectos", () => {
    const resultado = calcularRecepcion({ ...entradaBase, defectosPct: 20 });

    expect(resultado.dictamen).toBe("rechazado");
    expect(resultado.errores.some((e) => e.includes("no puede ingresar"))).toBe(
      true
    );
  });

  it("advierte cuando falta la segunda pesada o la tara de rejas", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      taraVehiculo: 0,
      segundaPesadaCapturada: false,
      rejas: 10,
      taraRejasKg: 0,
    });

    expect(resultado.advertencias).toHaveLength(2);
    expect(resultado.advertencias[0]).toContain("segunda pesada");
    expect(resultado.advertencias[1]).toContain("10 reja");
  });

  it("tolera entradas vacías sin romper los cálculos", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      pesoBruto: Number.NaN,
      taraVehiculo: Number.NaN,
      precioKg: Number.NaN,
      defectosPct: Number.NaN,
    });

    expect(resultado.pesoNeto).toBe(0);
    expect(resultado.totalLiquidar).toBe(0);
    expect(resultado.errores[0]).toContain("peso bruto");
  });
});

describe("obtenerDictamen", () => {
  it("clasifica por umbrales de defectos", () => {
    expect(obtenerDictamen(0)).toBe("aceptado");
    expect(obtenerDictamen(9.99)).toBe("aceptado");
    expect(obtenerDictamen(10)).toBe("observado");
    expect(obtenerDictamen(19.99)).toBe("observado");
    expect(obtenerDictamen(20)).toBe("rechazado");
  });
});

describe("validarPasoRecepcion", () => {
  const base = {
    origen: "terceros" as const,
    folioFisico: "B-1029",
    productorId: "productor-1",
    huertoId: "",
    variedad: "Limón Persa",
    pesoBruto: 10000,
    taraTotal: 3200,
    precioKg: 5,
    dictamen: "aceptado" as const,
  };

  it("no bloquea el paso 1 con lo mínimo capturado", () => {
    expect(validarPasoRecepcion({ ...base, paso: 1 })).toEqual([]);
  });

  it("exige huerto y variedad en cosecha propia", () => {
    const errores = validarPasoRecepcion({
      ...base,
      paso: 1,
      origen: "propia",
      huertoId: "",
      variedad: "",
    });

    expect(errores).toHaveLength(2);
    expect(errores[0]).toContain("huerto de procedencia");
    expect(errores[1]).toContain("variedad");
  });

  it("exige peso bruto válido en el paso 2", () => {
    const errores = validarPasoRecepcion({
      ...base,
      paso: 2,
      pesoBruto: 0,
    });

    expect(errores[0]).toContain("peso bruto");
  });

  it("exige precio solo en compra a terceros", () => {
    expect(
      validarPasoRecepcion({ ...base, paso: 3, precioKg: 0 })
    ).toHaveLength(1);
    expect(
      validarPasoRecepcion({
        ...base,
        paso: 3,
        precioKg: 0,
        origen: "propia",
      })
    ).toHaveLength(0);
  });

  it("bloquea la confirmación cuando el dictamen es rechazado", () => {
    const errores = validarPasoRecepcion({
      ...base,
      paso: 4,
      dictamen: "rechazado",
    });

    expect(errores[0]).toContain("RECHAZADO");
  });
});

describe("calcularHistorialPrecios", () => {
  const filas: PrecioHistorico[] = [
    {
      folio: "REC-2026-003",
      fecha: "2026-03-10T10:00:00.000Z",
      precio: 6,
      kilos: 1000,
      variedad: "Limón Persa",
    },
    {
      folio: "REC-2026-002",
      fecha: "2026-03-05T10:00:00.000Z",
      precio: 4,
      kilos: 900,
      variedad: "Limón Persa",
    },
    {
      folio: "REC-2026-001",
      fecha: "2026-03-01T10:00:00.000Z",
      precio: 5,
      kilos: 800,
      variedad: "Limón Persa",
    },
  ];

  it("resume precios reales del productor", () => {
    const historial = calcularHistorialPrecios(filas);

    expect(historial.lotesRegistrados).toBe(3);
    expect(historial.ultimo).toBe(6);
    expect(historial.promedio).toBe(5);
    expect(historial.minimo).toBe(4);
    expect(historial.maximo).toBe(6);
    expect(historial.variacionPct).toBe(20);
  });

  it("ignora lotes sin precio y devuelve un historial vacío coherente", () => {
    const conCero = calcularHistorialPrecios([
      { ...filas[0], precio: 0 },
      { ...filas[1], precio: 0 },
    ]);

    expect(conCero.precios).toEqual([]);
    expect(conCero.promedio).toBeNull();
    expect(conCero.variacionPct).toBeNull();
    expect(calcularHistorialPrecios([]).lotesRegistrados).toBe(0);
  });
});

describe("utilidades varias", () => {
  it("calcula el pago al cortador con el 30% del precio por caja", () => {
    expect(calcularPagoCortador(100, 100)).toBe(3000);
    expect(calcularPagoCortador(0, 100)).toBe(0);
  });

  it("formatea el folio consecutivo oficial", () => {
    expect(formatearFolioRecepcion(2026, 1)).toBe("REC-2026-001");
    expect(formatearFolioRecepcion(2026, 42)).toBe("REC-2026-042");
    expect(formatearFolioRecepcion(2026, 1234)).toBe("REC-2026-1234");
  });
});
