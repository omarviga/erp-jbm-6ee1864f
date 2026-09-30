import { describe, expect, it } from "vitest";
import {
  buscarProductores,
  calcularSaldoLiquidacion,
  calcularTotalesLiquidacion,
  clavePeriodo,
  consolidarDeducciones,
  leerDesgloseBoleta,
  nombreProductorDisplay,
  validarAbono,
  type BoletaLiquidable,
} from "../calculos";
import { recalcularSaldoProductor } from "../saldos";

const boleta = (over: Partial<BoletaLiquidable> = {}): BoletaLiquidable => ({
  id: "b1",
  folioBascula: "BAS-10492",
  fechaEntrada: "2026-09-20T14:00:00",
  pesoBruto: 18500,
  pesoTara: 6200,
  kilosNetos: 12300,
  precioKg: 8.5,
  tarifaDeduccionKg: 0.4,
  deduccionOperativaMonto: 4920, // 12300 × 0.4, congelado en el ticket
  montoNetoTicket: 99580, // 104550 − 50 − 4920, neto congelado (CxP)
  anticipos: 2000,
  cuotaBascula: 50,
  formaPagoBascula: "liquidacion",
  ...over,
});

describe("leerDesgloseBoleta", () => {
  it("lee los importes congelados del ticket sin fórmula propia", () => {
    const d = leerDesgloseBoleta(boleta());
    expect(d.subtotalFruta).toBe(104550);
    expect(d.descuentoBascula).toBe(50);
    expect(d.deduccionOperativa).toBe(4920);
    expect(d.saldoNeto).toBe(97580); // neto del ticket − anticipos
  });

  it("no descuenta báscula pagada en efectivo", () => {
    const d = leerDesgloseBoleta(
      boleta({ formaPagoBascula: "efectivo", montoNetoTicket: 99630 }),
    );
    expect(d.descuentoBascula).toBe(0);
    expect(d.saldoNeto).toBe(97630);
  });

  it("respeta el importe congelado aunque difiera de kilos × tasa", () => {
    const d = leerDesgloseBoleta(boleta({ deduccionOperativaMonto: 999 }));
    expect(d.deduccionOperativa).toBe(999);
  });
});

describe("calcularTotalesLiquidacion", () => {
  it("acumula boletas con precio promedio ponderado", () => {
    const t = calcularTotalesLiquidacion([
      boleta({
        id: "b1", kilosNetos: 10000, precioKg: 8,
        deduccionOperativaMonto: 4000, montoNetoTicket: 75950, // 80000 − 50 − 4000
      }),
      boleta({
        id: "b2", kilosNetos: 5000, precioKg: 9, anticipos: 0,
        deduccionOperativaMonto: 2000, montoNetoTicket: 42950, // 45000 − 50 − 2000
      }),
    ]);
    expect(t.nBoletas).toBe(2);
    expect(t.kilosNetos).toBe(15000);
    expect(t.subtotalFruta).toBe(125000);
    expect(t.precioPromedio).toBe(8.33); // 125000 / 15000, redondeado a 2 decimales
    expect(t.deduccionOperativa).toBe(6000);
    expect(t.deduccionBascula).toBe(100);
    expect(t.anticipos).toBe(2000);
    expect(t.totalNeto).toBe(116900); // (75950 − 2000) + 42950
  });
});

describe("calcularSaldoLiquidacion", () => {
  it("permanece PARCIAL hasta el $0.00 exacto", () => {
    expect(calcularSaldoLiquidacion(1000, [{ importe: 600 }])).toEqual({
      abonado: 600,
      saldo: 400,
      estado: "parcial",
    });
    expect(
      calcularSaldoLiquidacion(1000, [{ importe: 600 }, { importe: 400 }]),
    ).toEqual({ abonado: 1000, saldo: 0, estado: "pagada" });
  });
});

describe("validarAbono", () => {
  it("exige referencia en cheque y tope al saldo", () => {
    expect(
      validarAbono({ importe: 100, saldoPendiente: 500, metodo: "cheque", referencia: "" }).map(
        (e) => e.codigo,
      ),
    ).toContain("REFERENCIA_REQUERIDA");
    expect(
      validarAbono({ importe: 600, saldoPendiente: 500, metodo: "efectivo", referencia: "" }).map(
        (e) => e.codigo,
      ),
    ).toContain("IMPORTE_EXCEDE_SALDO");
    expect(
      validarAbono({ importe: 500, saldoPendiente: 500, metodo: "spei", referencia: "SP-1" }),
    ).toEqual([]);
  });
});

describe("alias", () => {
  const productores = [
    { id: "1", alias: "Don Angel", nombreLegal: "Don Pedro Ramírez Méndez" },
    { id: "2", alias: null, nombreLegal: "Martel Hermanos SPR" },
  ];

  it("muestra legal + alias y busca por ambos", () => {
    expect(nombreProductorDisplay(productores[0])).toBe(
      'Don Pedro Ramírez Méndez ("Don Angel")',
    );
    expect(buscarProductores(productores, "angel")).toHaveLength(1);
    expect(buscarProductores(productores, "martel")).toHaveLength(1);
    expect(buscarProductores(productores, "ramírez")).toHaveLength(1);
  });
});

describe("reporte de deducción operativa", () => {
  it("clavea periodos diario/semanal/quincenal/mensual", () => {
    expect(clavePeriodo("2026-09-20", "diario")).toBe("2026-09-20");
    expect(clavePeriodo("2026-09-20", "mensual")).toBe("2026-09");
    expect(clavePeriodo("2026-09-10", "quincenal")).toBe("2026-09-Q1");
    expect(clavePeriodo("2026-09-20", "quincenal")).toBe("2026-09-Q2");
    // 2026-09-20 es domingo → semana del lunes 2026-09-14
    expect(clavePeriodo("2026-09-20", "semanal")).toBe("S-2026-09-14");
  });

  it("consolida kilos y deducciones por productor", () => {
    const [c] = consolidarDeducciones([
      { fecha: "2026-09-20", productorId: "p1", kilosNetos: 10000, tasaKg: 0.4 },
      { fecha: "2026-09-21", productorId: "p1", kilosNetos: 5000, tasaKg: 0.4 },
    ]);
    expect(c.nBoletas).toBe(2);
    expect(c.kilosNetos).toBe(15000);
    expect(c.deduccion).toBe(6000);
  });

  it("respeta la tasa congelada de cada ticket (2023 y 2026 conviven)", () => {
    const [c] = consolidarDeducciones([
      { fecha: "2023-02-06", productorId: "p1", kilosNetos: 10000, tasaKg: 0.04 },
      { fecha: "2026-09-21", productorId: "p1", kilosNetos: 5000, tasaKg: 0.4 },
    ]);
    expect(c.deduccion).toBe(2400); // 400 + 2000
  });
});

describe("recalcularSaldoProductor", () => {
  it("suma exigible y resta anticipos con piso en cero", () => {
    expect(
      recalcularSaldoProductor({ cxpPendiente: 5000, anticiposVivos: 2000, liquidacionesParciales: 1500 }),
    ).toBe(4500);
    expect(
      recalcularSaldoProductor({ cxpPendiente: 0, anticiposVivos: 1000, liquidacionesParciales: 0 }),
    ).toBe(0);
  });
});
