import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import Logistica from "./Logistica";

const toastSpy = vi.fn();

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/transferencias/CrearTransferenciaCDMXDialog", () => ({
  CrearTransferenciaCDMXDialog: () => <button>Nueva transferencia</button>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock("@/hooks/useFacturacion", () => ({
  useFacturacion: () => ({
    clientes: [
      {
        id: "c1",
        nombre: "Cliente Nacional",
        tipo: "nacional",
        direccion: "Monterrey",
        telefono: "81818181",
        email: "cliente@test.com",
        condicionesPago: 15,
        rfc: "XAXX010101000",
      },
    ],
  }),
}));

vi.mock("@/hooks/useLogistica", () => ({
  useLogistica: () => ({
    transportistas: [
      {
        id: "t1",
        nombre: "Transportes Norte",
        rfc: "AAA010101AAA",
        placas: "ABC123",
        numeroPermiso: "PER-123",
        telefono: "81888888",
        tipoPermiso: "federal",
        seguroResponsabilidadCivil: true,
        polizaSeguro: "POL-1",
      },
    ],
    inventarioDisponible: [
      {
        id: "lot-1",
        producto: "Lote A",
        cajas: 50,
        peso: 1000,
        volumen: 1.5,
        ubicacion: "camara",
        origen: "camara",
        unidadMedida: "cajas",
        valorUnitario: 12,
        codigoSAT: "10101500",
      },
    ],
    guiasRecientes: [],
    loadingTransportistas: false,
    loadingInventario: false,
    loadingGuias: false,
    crearGuia: vi.fn(),
    isCreando: false,
  }),
}));

describe("Logistica flow", () => {
  it("permite agregar inventario al embarque desde el modal", async () => {
    render(<Logistica />);

    expect(screen.getByRole("button", { name: /completar requisitos/i })).toBeDisabled();

    fireEvent.click(screen.getByText(/Agregar Productos/i));

    expect(await screen.findByText(/Seleccionar Inventario para Embarque/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Lote A/i));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Selección/i }));

    expect(screen.getByText(/Lote A/i)).toBeInTheDocument();
  });
});
