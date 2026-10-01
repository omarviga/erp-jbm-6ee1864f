import { describe, expect, it } from "vitest";
import {
  ERP_BASE_URL,
  urlCartaPorte,
  urlEstatusRecepcion,
  urlLote,
} from "./urls";
import { ERP_STATUS_BASE, urlConsultaPago } from "./recepcion/textoTicket";

describe("Base única de QR (erp.jbm.com.mx)", () => {
  it("fija el dominio público del ERP", () => {
    expect(ERP_BASE_URL).toBe("https://erp.jbm.com.mx");
  });

  it("construye todas las URLs de QR sobre la misma base", () => {
    expect(urlEstatusRecepcion("REC-2026-008")).toBe(
      "https://erp.jbm.com.mx/status/rec-2026-008"
    );
    expect(urlLote("abc-123")).toBe("https://erp.jbm.com.mx/lotes/abc-123");
    expect(urlCartaPorte("CP-2026-0001")).toBe(
      "https://erp.jbm.com.mx/logistica/carta-porte/CP-2026-0001"
    );
  });

  it("deriva el estatus de recepción de la base única", () => {
    expect(ERP_STATUS_BASE).toBe(`${ERP_BASE_URL}/status`);
    expect(urlConsultaPago("REC-2026-008", "https://otro/x")).toBe(
      urlEstatusRecepcion("REC-2026-008")
    );
  });
});
