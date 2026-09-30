import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TicketBascula, type TicketRecepcion } from "./TicketBascula";
import { formatearResumenWhatsApp } from "@/lib/recepcion/textoTicket";
import { COMPANY_INFO } from "@/lib/company";

const ticketBase: TicketRecepcion = {
  folioOficial: "REC-2026-008",
  folioFisico: "B-10293",
  numeroLote: "L-000009-001",
  productor: "Citrícola del Valle",
  origen: "Compra externa",
  huerto: "—",
  localidad: "",
  variedad: "Limón Mexicano",
  operador: "Carlos Barragan",
  pesoBruto: 14500,
  tara: 4200,
  pesoNeto: 10300,
  kilosMerma: 0,
  defectosPct: 0,
  precioKg: 18.5,
  subtotal: 190550,
  costoBascula: 50,
  basculaFormaPago: "liquidacion",
  cuotaManiobraKg: 0.4,
  cuotaManiobraConcepto: "Servicios operativos y maniobra",
  cuotaManiobra: 4120,
  totalDeducciones: 4170,
  total: 186380,
  precioNetoEfectivo: 18.1,
  fecha: "10/03/2026, 10:00:00",
  statusUrl: "https://jbm.mx/status/REC-2026-008",
  borrador: false,
};

describe("formatearResumenWhatsApp", () => {
  it("resume la boleta con el ejemplo operativo", () => {
    const texto = formatearResumenWhatsApp(ticketBase);

    expect(texto).toContain("REC-2026-008");
    expect(texto).toContain("Citrícola del Valle");
    expect(texto).toContain("10,300.00 kg");
    expect(texto).toContain("$190,550.00");
    expect(texto).toContain("-$4,120.00");
    expect(texto).toContain("-$50.00");
    expect(texto).toContain("$186,380.00");
    expect(texto).toContain("$18.10/kg");
  });

  it("aclara cuando la báscula se pagó en efectivo", () => {
    const texto = formatearResumenWhatsApp({
      ...ticketBase,
      basculaFormaPago: "efectivo",
      totalDeducciones: 4120,
      total: 186430,
    });

    expect(texto).toContain("efectivo, no deducida");
    expect(texto).not.toContain("Báscula (deducción)");
  });

  it("omite líneas opcionales vacías sin romper el formato", () => {
    const texto = formatearResumenWhatsApp({
      ...ticketBase,
      folioOficial: "",
      folioFisico: "",
      numeroLote: "",
      huerto: "—",
      costoBascula: 0,
      cuotaManiobra: 0,
    });

    expect(texto).toContain("POR ASIGNAR");
    expect(texto).not.toContain("Ticket báscula:");
    expect(texto).not.toContain("Huerto:");
    expect(texto).not.toContain("Maniobra");
  });
});

describe("TicketBascula", () => {
  it("no muestra datos fiscales opcionales cuando no están configurados", () => {
    expect(COMPANY_INFO.rfc).toBe("");

    render(<TicketBascula ticket={ticketBase} onImprimir={vi.fn()} />);

    expect(screen.queryByText(/^RFC:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SENASICA/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Báscula:/)).not.toBeInTheDocument();
    // La nota legal sí es parte fija del formato de 80 mm.
    expect(
      screen.getByText(/no es un comprobante fiscal/i)
    ).toBeInTheDocument();
  });

  it("muestra RFC, SENASICA y domicilio de báscula cuando se configuran", () => {
    render(
      <TicketBascula
        ticket={ticketBase}
        onImprimir={vi.fn()}
        empresa={{
          ...COMPANY_INFO,
          rfc: "XAXX010101000",
          registroSenasica: "SEN-12345",
          direccionBascula: "Km 16 Antúnez",
        }}
      />
    );

    expect(screen.getByText(/RFC: XAXX010101000/)).toBeInTheDocument();
    expect(screen.getByText(/Reg\. SENASICA: SEN-12345/)).toBeInTheDocument();
    expect(screen.getByText(/Báscula: Km 16 Antúnez/)).toBeInTheDocument();
  });

  it("copia el resumen al portapapeles para WhatsApp", async () => {
    const writeText = vi.fn(async (_texto: string) => {});
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<TicketBascula ticket={ticketBase} onImprimir={vi.fn()} />);
    fireEvent.click(screen.getByTestId("copiar-whatsapp"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("REC-2026-008");
    expect(writeText.mock.calls[0][0]).toContain("$186,380.00");
  });
});
