import { describe, expect, it } from "vitest";
import { payloadADatosRecepcion } from "./mapeo";
import type { RecepcionPayload } from "./types";

const payload: RecepcionPayload = {
  productorId: "prod-1",
  folioBascula: "BAS-10492",
  pesoBruto: 18500,
  pesoTara: 6200,
  precioKg: 8.5,
  formaPagoBascula: "liquidacion",
  cuotaBascula: 50,
  tarifaManiobraKg: 0.4,
  conceptoManiobra: "Maniobra de descarga",
  operadorBascula: "Carlos Barragan",
  tipoPagoRecepcion: "anticipo",
  anticipos: 2000,
  resumen: {
    pesoNeto: 12300,
    subtotalFruta: 104550,
    descuentoBascula: 50,
    cargoManiobraTotal: 4920,
    totalLiquidar: 99580,
    precioNetoEfectivo: 8.1,
  },
};

describe("payloadADatosRecepcion", () => {
  it("mapea la boleta rápida a compra externa con anticipos", () => {
    const d = payloadADatosRecepcion(payload);
    expect(d.productor_id).toBe("prod-1");
    expect(d.folio_fisico).toBe("BAS-10492");
    expect(d.peso_bruto).toBe(18500);
    expect(d.peso_tara).toBe(6200);
    expect(d.precio_pactado_kg).toBe(8.5);
    expect(d.costo_bascula).toBe(50);
    expect(d.bascula_forma_pago).toBe("liquidacion");
    expect(d.cuota_maniobra_kg).toBe(0.4);
    expect(d.operador_bascula).toBe("Carlos Barragan");
    expect(d.es_cosecha_propia).toBe(false);
    expect(d.origen).toBe("externo");
    expect(d.calidad_defectos).toBe(0);
    expect(d.estado_calidad).toBe("aceptado");
    expect(d.anticipos).toBe(2000);
    expect(d.tipo_pago_recepcion).toBe("anticipo");
  });
});
