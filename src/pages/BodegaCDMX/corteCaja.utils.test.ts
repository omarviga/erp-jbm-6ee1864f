import { describe, expect, it } from "vitest";

import {
  construirConciliacionPeriodo,
  obtenerIncidenciasAuditoria,
  type TicketPeriodoCorte,
  type VentaAuditadaCorte,
} from "./corteCaja.utils";

describe("corteCaja utils", () => {
  it("detecta ventas auditadas con pago faltante, duplicado o descuadrado", () => {
    const ventas: VentaAuditadaCorte[] = [
      {
        id: "venta-ok",
        numero_venta: "POS-001",
        total: 100,
        created_at: "2026-03-13T10:00:00.000Z",
        pagos_clientes: [{ id: "pago-1", monto: 100, forma_pago: "efectivo" }],
      },
      {
        id: "venta-sin-pago",
        numero_venta: "POS-002",
        total: 120,
        created_at: "2026-03-13T11:00:00.000Z",
        pagos_clientes: [],
      },
      {
        id: "venta-duplicada",
        numero_venta: "POS-003",
        total: 130,
        created_at: "2026-03-13T12:00:00.000Z",
        pagos_clientes: [
          { id: "pago-2", monto: 65, forma_pago: "efectivo" },
          { id: "pago-3", monto: 65, forma_pago: "transferencia" },
        ],
      },
      {
        id: "venta-descuadrada",
        numero_venta: "POS-004",
        total: 150,
        created_at: "2026-03-13T13:00:00.000Z",
        pagos_clientes: [{ id: "pago-4", monto: 149, forma_pago: "cheque" }],
      },
    ];

    const incidencias = obtenerIncidenciasAuditoria(ventas);

    expect(incidencias.map((venta) => venta.numero_venta)).toEqual([
      "POS-002",
      "POS-003",
      "POS-004",
    ]);
  });

  it("concilia tickets contra ventas y reporta faltantes, descuadres y huerfanos", () => {
    const tickets: TicketPeriodoCorte[] = [
      {
        id: "ticket-ok",
        venta_id: "venta-ok",
        numero_venta: "POS-001",
        cliente_nombre: "Cliente A",
        metodo_pago: "efectivo",
        total: 100,
        created_at: "2026-03-13T10:00:00.000Z",
        items: [],
      },
      {
        id: "ticket-mismatch",
        venta_id: "venta-mismatch",
        numero_venta: "POS-002",
        cliente_nombre: "Cliente B",
        metodo_pago: "transferencia",
        total: 80,
        created_at: "2026-03-13T11:00:00.000Z",
        items: [],
      },
      {
        id: "ticket-huerfano",
        venta_id: "venta-huerfana",
        numero_venta: "POS-999",
        cliente_nombre: "Cliente C",
        metodo_pago: "cheque",
        total: 60,
        created_at: "2026-03-13T14:00:00.000Z",
        items: [],
      },
    ];

    const ventas: VentaAuditadaCorte[] = [
      {
        id: "venta-ok",
        numero_venta: "POS-001",
        total: 100,
        created_at: "2026-03-13T10:00:00.000Z",
        pagos_clientes: [{ id: "pago-1", monto: 100, forma_pago: "efectivo" }],
      },
      {
        id: "venta-mismatch",
        numero_venta: "POS-002",
        total: 90,
        created_at: "2026-03-13T11:00:00.000Z",
        pagos_clientes: [{ id: "pago-2", monto: 80, forma_pago: "transferencia" }],
      },
      {
        id: "venta-sin-ticket",
        numero_venta: "POS-003",
        total: 110,
        created_at: "2026-03-13T12:00:00.000Z",
        pagos_clientes: [{ id: "pago-3", monto: 110, forma_pago: "efectivo" }],
      },
      {
        id: "venta-sin-pago",
        numero_venta: "POS-004",
        total: 70,
        created_at: "2026-03-13T13:00:00.000Z",
        pagos_clientes: [],
      },
    ];

    const resultado = construirConciliacionPeriodo(tickets, ventas);

    expect(resultado.totalVentas).toBe(4);
    expect(resultado.totalTickets).toBe(3);
    expect(resultado.cuadrado).toBe(false);
    expect(resultado.incidencias.map((incidencia) => incidencia.detalle)).toEqual([
      "Ticket en bitacora sin venta POS encontrada en el periodo",
      "Venta con pago pero sin ticket en bitacora separada",
      "Venta sin pago asociado",
      "Venta con pago pero sin ticket en bitacora separada",
      "Monto ticket $80.00 vs venta $90.00",
      "Pago $80.00 vs venta $90.00",
    ]);
  });

  it("marca cuadrado cuando ventas, tickets y pagos coinciden", () => {
    const tickets: TicketPeriodoCorte[] = [
      {
        id: "ticket-1",
        venta_id: "venta-1",
        numero_venta: "POS-001",
        cliente_nombre: "Cliente A",
        metodo_pago: "efectivo",
        total: 100,
        created_at: "2026-03-13T10:00:00.000Z",
        items: [],
      },
    ];

    const ventas: VentaAuditadaCorte[] = [
      {
        id: "venta-1",
        numero_venta: "POS-001",
        total: 100,
        created_at: "2026-03-13T10:00:00.000Z",
        pagos_clientes: [{ id: "pago-1", monto: 100, forma_pago: "efectivo" }],
      },
    ];

    const resultado = construirConciliacionPeriodo(tickets, ventas);

    expect(resultado.incidencias).toHaveLength(0);
    expect(resultado.cuadrado).toBe(true);
  });
});
