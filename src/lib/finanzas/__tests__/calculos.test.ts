import { describe, expect, it } from "vitest";
import {
  buscarProductores,
  calcularDesgloseBoleta,
  calcularSaldoLiquidacion,
  calcularTotalesLiquidacion,
  clavePeriodo,
  consolidarDeducciones,
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
  anticipos: 2000,
  cuotaBascula: 50,
  formaPagoBascula: "liquidacion",
  ...over,
});

describe("calcularDesgloseBoleta", () => {
  it("aplica $30 fijos + $0.04/kg separados de báscula", () => {
    const d = calcularDesgloseBoleta(boleta());
    expect(d.subtotalFruta).toBe(104550);
    expect(d.descuentoBascula).toBe(50);
    expect(d.deduccionOperativaFija).toBe(30);
    expect(d.provisionOperativa).toBe(492); // 12300 × 0.04
    expect(d.saldoNeto).toBe(101978); // 104550 − 2000 − 50 − 30 − 492
  });

  it("no descuenta báscula pagada en efectivo", () => {
    const d = calcularDesgloseBoleta(boleta({ formaPagoBascula: "efectivo" }));
    expect(d.descuentoBascula).toBe(0);
    expect(d.saldoNeto).toBe(102028);
  });
});

describe("calcularTotalesLiquidacion", () => {
  it("acumula boletas con precio promedio ponderado", () => {
    const t = calcularTotalesLiquidacion([
      boleta({ id: "b1", kilosNetos: 10000, precioKg: 8 }),
      boleta({ id: "b2", kilosNetos: 5000, precioKg: 9, anticipos: 0 }),
    ]);
    expect(t.nBoletas).toBe(2);
    expect(t.kilosNetos).toBe(15000);
    expect(t.subtotalFruta).toBe(125000);
    expect(t.precioPromedio).toBe(8.33); // 125000 / 15000, redondeado a 2 decimales
    expect(t.deduccionOperativaFija).toBe(60); // 2 × 30
    expect(t.provisionOperativa).toBe(600); // 15000 × 0.04
    expect(t.anticipos).toBe(2000);
    expect(t.totalNeto).toBe(122240); // 125000 − 2000 − 100 − 60 − 600
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
      { fecha: "2026-09-20", productorId: "p1", kilosNetos: 10000 },
      { fecha: "2026-09-21", productorId: "p1", kilosNetos: 5000 },
    ]);
    expect(c.nBoletas).toBe(2);
    expect(c.kilosNetos).toBe(15000);
    expect(c.deduccionFija).toBe(60);
    expect(c.provision).toBe(600);
    expect(c.total).toBe(660);
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
