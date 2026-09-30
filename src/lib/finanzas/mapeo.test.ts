import { describe, expect, it } from "vitest";
import {
  construirCuentasCorrientes,
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
        monto_total: 104550, monto_pagado: 0, saldo_pendiente: 104550,
      },
      {
        id: "l1", productor_id: "p1", folio_fisico: "BAS-10492",
        fecha_recepcion: "2026-09-20T14:00:00", peso_bruto: 18500, peso_tara: 6200,
        peso_neto: 12300, costo_bascula: 50, bascula_forma_pago: "liquidacion", anticipos: 2000,
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
      anticipos: 2000,
      cuotaBascula: 50,
      formaPagoBascula: "liquidacion",
    });
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
  });
});

describe("loteAMovimiento", () => {
  it("extrae fecha, productor y kilos netos", () => {
    expect(
      loteAMovimiento({
        id: "l1", productor_id: "p1", folio_fisico: "BAS-1",
        fecha_recepcion: "2026-09-20T14:00:00", peso_bruto: 18500, peso_tara: 6200,
        peso_neto: 12300, costo_bascula: 50, bascula_forma_pago: "liquidacion",
      }),
    ).toEqual({
      fecha: "2026-09-20T14:00:00",
      productorId: "p1",
      kilosNetos: 12300,
      folioBascula: "BAS-1",
    });
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
