import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import Inventarios from "./Inventarios";

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/transferencias/CrearTransferenciaCDMXDialog", () => ({
  CrearTransferenciaCDMXDialog: ({ trigger }: { trigger?: React.ReactNode }) => <div>{trigger || <button>Transferir</button>}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useKardexLote", () => ({
  useKardexLote: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("@/hooks/useCamaraFria", () => ({
  useCamaraFria: () => ({
    inventario: [
      {
        id: "camara-1",
        fecha_ingreso: new Date().toISOString(),
        cantidad_disponible: 120,
        produccion: {
          lote_id: "lote-1",
          calibre: "110",
          calidad: "primera",
          lotes: { numero_lote: "L-001", origen: "externo", productor_id: "P1" },
        },
      },
    ],
    pisoEmpaque: [],
    transporteDirecto: [],
    temperaturas: [],
    trasladoInterno: vi.fn(),
    isTrasladandoInterno: false,
    registrarMerma: vi.fn(),
    isRegistrandoMerma: false,
    enviarTransporteDirectoACdmx: vi.fn(),
    isEnviandoTransporteDirecto: false,
    isLoading: false,
  }),
}));

describe("Inventarios flow", () => {
  it("abre el modal de historial desde la lista de prioridad", () => {
    render(<Inventarios />);

    fireEvent.click(screen.getByRole("button", { name: /ver historial/i }));

    expect(screen.getByText(/Historial Kardex del Lote/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin movimientos registrados para este lote/i)).toBeInTheDocument();
  });
});
