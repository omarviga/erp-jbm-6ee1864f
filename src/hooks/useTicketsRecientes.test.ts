import { describe, expect, it } from "vitest";
import { filaATicketReciente } from "./useTicketsRecientes";

const filaBase = {
  id: "l1",
  numero_lote: "L-000009-001",
  folio_recepcion: "REC-2026-008",
  folio_fisico: "B-10293",
  fecha_recepcion: "2026-09-20T14:00:00",
  productor_id: "p1",
  es_cosecha_propia: false,
  estado_calidad: "aceptado",
  peso_bruto: 14500,
  peso_tara: 4200,
  peso_neto: 10300,
  kilos_merma: 0,
  calidad_defectos: 2,
  precio_pactado_kg: 18.5,
  costo_bascula: 30,
  bascula_forma_pago: "liquidacion",
  cuota_maniobra_kg: 0.4,
  cuota_maniobra_concepto: "Servicios operativos y maniobra",
  cuota_maniobra_total: 4120,
  operador_bascula: "Carlos Barragan",
  variedad: "Limón Mexicano",
  productores: { nombre: "Citrícola del Valle" },
};

describe("filaATicketReciente", () => {
  it("lee los importes congelados del ticket", () => {
    const t = filaATicketReciente(filaBase);
    expect(t.productorNombre).toBe("Citrícola del Valle");
    expect(t.subtotal).toBe(190550);
    expect(t.basculaDescontada).toBe(30);
    expect(t.cuotaManiobraTotal).toBe(4120);
    expect(t.totalDeducciones).toBe(4150);
    expect(t.total).toBe(186400);
    expect(t.precioNetoEfectivo).toBe(18.1);
  });

  it("no descuenta báscula pagada en efectivo", () => {
    const t = filaATicketReciente({
      ...filaBase,
      bascula_forma_pago: "efectivo",
    });
    expect(t.basculaDescontada).toBe(0);
    expect(t.total).toBe(186430);
  });

  it("deriva la deducción desde la tasa en tickets legados", () => {
    const t = filaATicketReciente({
      ...filaBase,
      cuota_maniobra_kg: 0.04,
      cuota_maniobra_total: 0,
    });
    expect(t.cuotaManiobraTotal).toBe(412); // 10300 × 0.04
  });

  it("tolera productor y variedad ausentes", () => {
    const t = filaATicketReciente({
      ...filaBase,
      productor_id: null,
      productores: null,
      variedad: null,
      operador_bascula: null,
    });
    expect(t.productorNombre).toBe("SIN ASIGNAR");
    expect(t.variedad).toBe("");
    expect(t.operadorBascula).toBe("");
  });
});
