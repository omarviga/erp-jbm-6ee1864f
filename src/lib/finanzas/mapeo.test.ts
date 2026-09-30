import { describe, expect, it } from "vitest";
import {
  construirCuentasCorrientes,
  construirDetalleTickets,
  cxpYLoteABoleta,
  loteAMovimiento,
  productorACuenta,
} from "./mapeo";

describe("productorACuenta", () => {
  it("conserva id, legal y alias", () => {
    expect(
      productorACuenta({ id: "p1", nombre: "Don Pedro Ramírez Méndez", alias: "Don Angel" }),
    ).toEqual({ id: "p1", alias: "Don Angel", nombreLegal: "Don Pedro Ramírez Méndez" });
    expect(productorACuenta({ id: "p2", nombre: "X" }).alias).toBeNull();
  });
});

describe("cxpYLoteABoleta", () => {
  it("combina nota CxP con físico del lote", () => {
    const b = cxpYLoteABoleta(
      {
        id: "cxp1", productor_id: "p1", lote_id: "l1", numero_lote: "L-0001",
        fecha_ticket: "2026-09-20T14:00:00", kilos_netos: 12300, precio_kg: 8.5,
        monto_total: 99580, monto_pagado: 0, saldo_pendiente: 99580,
      },
      {
        id: "l1", productor_id: "p1", folio_fisico: "BAS-10492",
        fecha_recepcion: "2026-09-20T14:00:00", peso_bruto: 18500, peso_tara: 6200,
        peso_neto: 12300, costo_bascula: 50, bascula_forma_pago: "liquidacion", anticipos: 2000,
        cuota_maniobra_kg: 0.4, cuota_maniobra_total: 4920,
      },
    );
    expect(b).toEqual({
      id: "cxp1",
      productorId: "p1",
      folioBascula: "BAS-10492",
      fechaEntrada: "2026-09-20T14:00:00",
      pesoBruto: 18500,
      pesoTara: 6200,
      kilosNetos: 12300,
      precioKg: 8.5,
      tarifaDeduccionKg: 0.4,
      deduccionOperativaMonto: 4920,
      montoNetoTicket: 99580,
      anticipos: 2000,
      cuotaBascula: 50,
      formaPagoBascula: "liquidacion",
    });
  });

  it("deriva el importe desde la tasa congelada en tickets legados", () => {
    const b = cxpYLoteABoleta(
      {
        id: "cxp3", productor_id: "p1", lote_id: "l3", numero_lote: "L-0003",
        fecha_ticket: "2023-02-06", kilos_netos: 1695, precio_kg: 14.96,
        monto_total: 25259.4, monto_pagado: 0, saldo_pendiente: 25259.4,
      },
      {
        id: "l3", productor_id: "p1", folio_fisico: "3702",
        fecha_recepcion: "2023-02-06", peso_bruto: 3665, peso_tara: 1970,
        peso_neto: 1695, costo_bascula: 30, bascula_forma_pago: "liquidacion",
        cuota_maniobra_kg: 0.04, cuota_maniobra_total: null,
      },
    );
    expect(b.tarifaDeduccionKg).toBe(0.04);
    expect(b.deduccionOperativaMonto).toBe(67.8); // 1695 × 0.04
  });

  it("usa numero_lote si no hay folio físico ni lote", () => {
    const b = cxpYLoteABoleta(
      {
        id: "cxp2", productor_id: "p1", lote_id: "l9", numero_lote: "L-0002",
        fecha_ticket: "2026-09-21", kilos_netos: 1000, precio_kg: 8,
        monto_total: 8000, monto_pagado: 0, saldo_pendiente: 8000,
      },
      undefined,
    );
    expect(b.folioBascula).toBe("L-0002");
    expect(b.pesoBruto).toBe(0);
    expect(b.formaPagoBascula).toBe("liquidacion");
    expect(b.deduccionOperativaMonto).toBe(0);
    expect(b.montoNetoTicket).toBe(8000);
  });
});

describe("loteAMovimiento", () => {
  it("extrae fecha, productor, kilos y tasa congelada", () => {
    expect(
      loteAMovimiento({
        id: "l1", productor_id: "p1", folio_fisico: "BAS-1",
        fecha_recepcion: "2026-09-20T14:00:00", peso_bruto: 18500, peso_tara: 6200,
        peso_neto: 12300, costo_bascula: 50, bascula_forma_pago: "liquidacion",
        cuota_maniobra_kg: 0.4,
      }),
    ).toEqual({
      fecha: "2026-09-20T14:00:00",
      productorId: "p1",
      kilosNetos: 12300,
      tasaKg: 0.4,
      folioBascula: "BAS-1",
    });
  });
});

describe("construirDetalleTickets", () => {
  const cxp = (over = {}) => ({
    id: "cxp1", productor_id: "p1", lote_id: "l1", numero_lote: "L-0001",
    fecha_ticket: "2026-09-20T14:00:00", kilos_netos: 10300, precio_kg: 18.5,
    monto_total: 186400, monto_pagado: 0, saldo_pendiente: 186400,
    ...over,
  });
  const lote = (over = {}) => ({
    id: "l1", productor_id: "p1", folio_fisico: "BAS-10492",
    fecha_recepcion: "2026-09-20T14:00:00", peso_bruto: 14500, peso_tara: 4200,
    peso_neto: 10300, costo_bascula: 30, bascula_forma_pago: "liquidacion",
    cuota_maniobra_kg: 0.4, cuota_maniobra_total: 4120,
    ...over,
  });

  it("une CxP con lote y lee los importes congelados", () => {
    const [f] = construirDetalleTickets([cxp()], [lote()], { p1: "Don Pedro" });
    expect(f).toEqual({
      id: "cxp1",
      fecha: "2026-09-20T14:00:00",
      ticket: "BAS-10492",
      productorId: "p1",
      productorDisplay: "Don Pedro",
      kilosNetos: 10300,
      precioKg: 18.5,
      subtotal: 190550,
      deduccion: 4120,
      bascula: 30,
      neto: 186400,
    });
  });

  it("báscula en efectivo no descuenta y ordena por fecha", () => {
    const filas = construirDetalleTickets(
      [
        cxp({ id: "cxp2", lote_id: "l2", fecha_ticket: "2026-09-21", numero_lote: "L-2" }),
        cxp({ id: "cxp1", fecha_ticket: "2026-09-20" }),
      ],
      [
        lote({ id: "l2", folio_fisico: "BAS-2", bascula_forma_pago: "efectivo", costo_bascula: 30 }),
        lote(),
      ],
      { p1: "Don Pedro" },
    );
    expect(filas.map((f) => f.id)).toEqual(["cxp1", "cxp2"]);
    expect(filas[1].bascula).toBe(0);
  });

  it("tolera fecha_ticket nula sin romper el reporte", () => {
    const [f] = construirDetalleTickets(
      [cxp({ fecha_ticket: null })],
      [lote()],
      { p1: "Don Pedro" },
    );
    expect(f.fecha).toBe("");
    expect(f.ticket).toBe("BAS-10492");
  });

  it("usa numero_lote cuando no hay folio físico ni lote", () => {
    const [f] = construirDetalleTickets(
      [cxp({ lote_id: "l9", numero_lote: "L-9" })],
      [],
      {},
    );
    expect(f.ticket).toBe("L-9");
    expect(f.productorDisplay).toBe("p1");
    expect(f.deduccion).toBe(0);
    expect(f.bascula).toBe(0);
  });
});

describe("construirCuentasCorrientes", () => {
  it("agrega kilos, promedio ponderado, pagos y pendientes", () => {
    const [c] = construirCuentasCorrientes(
      [{ id: "p1", nombre: "Prod", alias: null }],
      [
        { id: "n1", productor_id: "p1", lote_id: "l1", numero_lote: "L-1", fecha_ticket: "2026-09-20", kilos_netos: 10000, precio_kg: 8, monto_total: 80000, monto_pagado: 80000, saldo_pendiente: 0 },
        { id: "n2", productor_id: "p1", lote_id: "l2", numero_lote: "L-2", fecha_ticket: "2026-09-21", kilos_netos: 5000, precio_kg: 9, monto_total: 45000, monto_pagado: 0, saldo_pendiente: 45000 },
      ],
      [{ productor_id: "p1", monto: 80000 }],
    );
    expect(c.kilosEntregados).toBe(15000);
    expect(c.precioPromedio).toBe(8.33);
    expect(c.pagosDispersados).toBe(80000);
    expect(c.porLiquidar).toBe(45000);
    expect(c.nBoletasPendientes).toBe(1);
  });
});
