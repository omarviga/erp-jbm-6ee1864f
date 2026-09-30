import { describe, expect, it } from "vitest";

import {
  calcularHistorialPrecios,
  calcularPagoCortador,
  calcularRecepcion,
  formatearFolioRecepcion,
  nombreDesdeEmail,
  obtenerDictamen,
  validarRecepcion,
  CONCEPTO_MANIOBRA_DEFAULT,
  TARIFA_MANIOBRA_DEFAULT,
  type EntradaCalculoRecepcion,
  type EntradaValidacionRecepcion,
  type PrecioHistorico,
} from "./calculos";

const entradaBase: EntradaCalculoRecepcion = {
  pesoBruto: 14500,
  taraVehiculo: 4200,
  precioKg: 18.5,
  defectosPct: 0,
  incluirBascula: true,
  costoBascula: 50,
  basculaFormaPago: "liquidacion",
  incluirManiobra: true,
  cuotaManiobraKg: 0.4,
};

describe("calcularRecepcion", () => {
  it("calcula peso neto, subtotal y deducciones como el flujo operativo", () => {
    const resultado = calcularRecepcion(entradaBase);

    expect(resultado.taraTotal).toBe(4200);
    expect(resultado.pesoNeto).toBe(10300);
    expect(resultado.subtotal).toBe(190550);
    expect(resultado.cuotaManiobraTotal).toBe(4120);
    expect(resultado.basculaDescontada).toBe(50);
    expect(resultado.totalDeducciones).toBe(4170);
    expect(resultado.totalLiquidar).toBe(186380);
    expect(resultado.precioNetoEfectivo).toBe(18.1);
  });

  it("aplica la tara como única deducción de peso", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      pesoBruto: 12450,
      taraVehiculo: 4200,
      precioKg: 18,
      costoBascula: 120,
      incluirManiobra: true,
      cuotaManiobraKg: 0.4,
    });

    expect(resultado.pesoNeto).toBe(8250);
    expect(resultado.subtotal).toBe(148500);
    expect(resultado.cuotaManiobraTotal).toBe(3300);
    expect(resultado.totalDeducciones).toBe(3420);
    expect(resultado.totalLiquidar).toBe(145080);
    // 145080 / 8250 = 17.5854... → 17.59 con dos decimales
    expect(resultado.precioNetoEfectivo).toBe(17.59);
  });

  it("registra la merma por defectos sin descontarla del pago (regla de peso neto)", () => {
    const resultado = calcularRecepcion({ ...entradaBase, defectosPct: 15 });

    expect(resultado.kilosMerma).toBe(1545);
    expect(resultado.pesoNeto).toBe(10300);
    expect(resultado.subtotal).toBe(190550);
    expect(resultado.dictamen).toBe("observado");
  });

  it("no descuenta la báscula cuando se pagó en efectivo al momento", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      basculaFormaPago: "efectivo",
      incluirManiobra: false,
      cuotaManiobraKg: 0,
    });

    expect(resultado.basculaDescontada).toBe(0);
    expect(resultado.basculaEnEfectivo).toBe(50);
    expect(resultado.totalDeducciones).toBe(0);
    expect(resultado.totalLiquidar).toBe(190550);
    expect(
      resultado.advertencias.some((a) => a.includes("efectivo"))
    ).toBe(true);
  });

  it("ignora la báscula y la maniobra cuando vienen desactivadas", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      incluirBascula: false,
      incluirManiobra: false,
    });

    expect(resultado.costoBascula).toBe(0);
    expect(resultado.cuotaManiobraTotal).toBe(0);
    expect(resultado.totalDeducciones).toBe(0);
    expect(resultado.totalLiquidar).toBe(resultado.subtotal);
  });

  it("nunca deja el total a liquidar en negativo", () => {
    const resultado = calcularRecepcion({
      ...entradaBase,
      precioKg: 0.01,
      costoBascula: 500,
      cuotaManiobraKg: 1,
    });

    expect(resultado.totalLiquidar).toBe(0);
    expect(resultado.precioNetoEfectivo).toBe(0);
  });

  it("advierte cuando la tara es inválida o falta", () => {
    const sinTara = calcularRecepcion({
      ...entradaBase,
      taraVehiculo: 0,
    });
    expect(
      sinTara.advertencias.some((a) => a.includes("Falta la tara"))
    ).toBe(true);

    const taraMayor = calcularRecepcion({
      ...entradaBase,
      taraVehiculo: 15000,
    });
    expect(
      taraMayor.advertencias.some((a) => a.includes("no puede ser mayor o igual"))
    ).toBe(true);
    expect(taraMayor.pesoNeto).toBe(0);
  });

  it("advierte cuando el precio está en cero y cuando el lote se rechaza", () => {
    const sinPrecio = calcularRecepcion({ ...entradaBase, precioKg: 0 });
    expect(
      sinPrecio.advertencias.some((a) => a.includes("no generará pago"))
    ).toBe(true);

    const rechazado = calcularRecepcion({ ...entradaBase, defectosPct: 20 });
    expect(rechazado.dictamen).toBe("rechazado");
    expect(
      rechazado.advertencias.some((a) => a.includes("no puede ingresar"))
    ).toBe(true);
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
    expect(resultado.subtotal).toBe(0);
    expect(resultado.totalLiquidar).toBe(0);
    expect(resultado.precioNetoEfectivo).toBe(0);
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

describe("validarRecepcion", () => {
  const base: EntradaValidacionRecepcion = {
    origen: "terceros",
    productorId: "productor-1",
    huertoId: "",
    pesoBruto: 14500,
    taraTotal: 4200,
    precioKg: 18.5,
    operadorBascula: "Carlos Barragán",
    dictamen: "aceptado",
  };

  it("no bloquea con los datos completos de una compra a terceros", () => {
    expect(validarRecepcion(base)).toEqual([]);
  });

  it("no exige huerto en compra a terceros pero sí en cosecha propia", () => {
    expect(validarRecepcion(base)).toEqual([]);

    const propia = validarRecepcion({ ...base, origen: "propia" });
    expect(propia).toHaveLength(1);
    expect(propia[0]).toContain("huerto de procedencia");
  });

  it("exige productor, peso bruto y tara", () => {
    const errores = validarRecepcion({
      ...base,
      productorId: "",
      pesoBruto: 0,
    });

    expect(errores.some((e) => e.includes("productor"))).toBe(true);
    expect(errores.some((e) => e.includes("peso bruto"))).toBe(true);
  });

  it("exige la tara del vehículo (segunda pesada)", () => {
    const errores = validarRecepcion({ ...base, taraTotal: 0 });

    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain("tara del vehículo");
  });

  it("bloquea cuando la tara es mayor o igual al peso bruto", () => {
    const errores = validarRecepcion({ ...base, taraTotal: 14500 });

    expect(errores[0]).toContain("menor al peso bruto");
  });

  it("exige precio solo en compra a terceros", () => {
    expect(validarRecepcion({ ...base, precioKg: 0 })).toHaveLength(1);
    expect(
      validarRecepcion({
        ...base,
        precioKg: 0,
        origen: "propia",
        huertoId: "huerto-1",
      })
    ).toHaveLength(0);
  });

  it("exige el operador de báscula responsable", () => {
    const errores = validarRecepcion({ ...base, operadorBascula: "   " });

    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain("operador de báscula");
  });

  it("bloquea el registro cuando el dictamen es rechazado", () => {
    const errores = validarRecepcion({ ...base, dictamen: "rechazado" });

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
      variedad: "Limón Mexicano",
    },
    {
      folio: "REC-2026-002",
      fecha: "2026-03-05T10:00:00.000Z",
      precio: 4,
      kilos: 900,
      variedad: "Limón Mexicano",
    },
    {
      folio: "REC-2026-001",
      fecha: "2026-03-01T10:00:00.000Z",
      precio: 5,
      kilos: 800,
      variedad: "Limón Mexicano",
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

  it("sugiere el nombre del operador a partir del correo", () => {
    expect(nombreDesdeEmail("carlos.barragan@jbm.com.mx")).toBe("Carlos Barragan");
    expect(nombreDesdeEmail("arturo_mendoza@jbm.com.mx")).toBe("Arturo Mendoza");
    expect(nombreDesdeEmail("")).toBe("");
    expect(nombreDesdeEmail(null)).toBe("");
  });

  it("expone los valores habituales del cargo operativo", () => {
    expect(TARIFA_MANIOBRA_DEFAULT).toBe(0.4);
    expect(CONCEPTO_MANIOBRA_DEFAULT).toBe("Servicios operativos y maniobra");
  });
});
