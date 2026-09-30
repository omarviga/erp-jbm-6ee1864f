import { describe, expect, it } from "vitest";
import {
  calcularAnticipoRecepcion,
  calcularPesoNeto,
  calcularResumenRecepcion,
  validarBoletaRecepcion,
} from "../calculos";

describe("calcularPesoNeto", () => {
  it("resta tara del bruto (única base de pago)", () => {
    expect(calcularPesoNeto(18500, 6200)).toBe(12300);
  });
});

describe("calcularResumenRecepcion", () => {
  const base = {
    pesoBruto: 18500,
    pesoTara: 6200,
    precioKg: 8.5,
    cuotaBascula: 50,
    tarifaManiobraKg: 0.4,
  };

  it("descuenta báscula y maniobra cuando es a liquidación", () => {
    const r = calcularResumenRecepcion({ ...base, formaPagoBascula: "liquidacion" });
    expect(r.pesoNeto).toBe(12300);
    expect(r.subtotalFruta).toBe(104550);
    expect(r.descuentoBascula).toBe(50);
    expect(r.cargoManiobraTotal).toBe(4920);
    expect(r.totalLiquidar).toBe(99580);
    expect(r.precioNetoEfectivo).toBe(8.1); // 99580 / 12300, redondeado a 2 decimales
  });

  it("no descuenta báscula cuando se pagó en efectivo", () => {
    const r = calcularResumenRecepcion({ ...base, formaPagoBascula: "efectivo" });
    expect(r.descuentoBascula).toBe(0);
    expect(r.totalLiquidar).toBe(99630);
  });

  it("blinda neto negativo en ceros para importes", () => {
    const r = calcularResumenRecepcion({
      ...base,
      pesoBruto: 5000,
      pesoTara: 6200,
      formaPagoBascula: "liquidacion",
    });
    expect(r.subtotalFruta).toBe(0);
    expect(r.cargoManiobraTotal).toBe(0);
    expect(r.precioNetoEfectivo).toBe(0);
  });
});

describe("validarBoletaRecepcion", () => {
  const ok = {
    productorId: "prod-1",
    folioBascula: "BAS-10492",
    pesoBruto: 18500,
    pesoTara: 6200,
    precioKg: 8.5,
  };

  it("acepta una captura válida", () => {
    expect(validarBoletaRecepcion(ok)).toEqual([]);
  });

  it("bloquea bruto ≤ 0", () => {
    expect(validarBoletaRecepcion({ ...ok, pesoBruto: 0 }).map((e) => e.codigo)).toContain(
      "BRUTO_INVALIDO",
    );
  });

  it("bloquea tara ≥ bruto", () => {
    expect(validarBoletaRecepcion({ ...ok, pesoTara: 18500 }).map((e) => e.codigo)).toContain(
      "TARA_INVALIDA",
    );
  });

  it("bloquea precio $0.00", () => {
    expect(validarBoletaRecepcion({ ...ok, precioKg: 0 }).map((e) => e.codigo)).toContain(
      "PRECIO_INVALIDO",
    );
  });

  it("exige productor y folio físico", () => {
    const codigos = validarBoletaRecepcion({ ...ok, productorId: "", folioBascula: " " }).map(
      (e) => e.codigo,
    );
    expect(codigos).toContain("PRODUCTOR_REQUERIDO");
    expect(codigos).toContain("FOLIO_REQUERIDO");
  });

  it("bloquea anticipo en $0.00 y anticipo mayor al total", () => {
    expect(
      validarBoletaRecepcion({ ...ok, tipoPago: "anticipo", montoAnticipo: 0, totalEstimado: 99580 }).map(
        (e) => e.codigo,
      ),
    ).toContain("ANTICIPO_INVALIDO");
    expect(
      validarBoletaRecepcion({ ...ok, tipoPago: "anticipo", montoAnticipo: 100000, totalEstimado: 99580 }).map(
        (e) => e.codigo,
      ),
    ).toContain("ANTICIPO_EXCEDE_TOTAL");
    expect(
      validarBoletaRecepcion({ ...ok, tipoPago: "anticipo", montoAnticipo: 2000, totalEstimado: 99580 }),
    ).toEqual([]);
  });
});

describe("calcularAnticipoRecepcion", () => {
  it("pendiente no registra anticipos", () => {
    expect(
      calcularAnticipoRecepcion({ tipoPago: "pendiente", montoAnticipo: 0, totalEstimado: 99580 }),
    ).toEqual({ anticipos: 0, remanenteEstimado: 99580 });
  });

  it("anticipo parcial deja remanente", () => {
    expect(
      calcularAnticipoRecepcion({ tipoPago: "anticipo", montoAnticipo: 2000, totalEstimado: 99580 }),
    ).toEqual({ anticipos: 2000, remanenteEstimado: 97580 });
  });

  it("pago total anticipa el estimado completo", () => {
    expect(
      calcularAnticipoRecepcion({ tipoPago: "total", montoAnticipo: 0, totalEstimado: 99580 }),
    ).toEqual({ anticipos: 99580, remanenteEstimado: 0 });
  });
});
