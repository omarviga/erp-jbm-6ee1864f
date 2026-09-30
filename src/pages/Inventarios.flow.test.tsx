import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

import Inventarios from "./Inventarios";

const loteMock = (id: string, numero: string, cajas: number) => ({
  id,
  fecha_ingreso: new Date().toISOString(),
  cantidad_disponible: cajas,
  produccion: {
    lote_id: `lote-${id}`,
    calibre: "V-X",
    calidad: "primera",
    lotes: { numero_lote: numero, origen: "externo", productor_id: "P1" },
  },
});

const datosMock = vi.hoisted(() => ({
  inventario: [] as ReturnType<typeof loteMock>[],
}));

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
    inventario: datosMock.inventario,
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
  beforeEach(() => {
    localStorage.clear();
    datosMock.inventario = [loteMock("camara-1", "L-001", 120)];
  });

  it("abre el modal de historial desde la lista de prioridad", () => {
    render(<Inventarios />);

    fireEvent.click(screen.getByRole("button", { name: /ver historial/i }));

    expect(screen.getByText(/Historial Kardex del Lote/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin movimientos registrados para este lote/i)).toBeInTheDocument();
  });

  it("muestra banner y fila roja cuando un lote cae bajo el umbral", () => {
    datosMock.inventario = [loteMock("camara-1", "L-001", 4)];
    render(<Inventarios />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /1 lote\(s\) por debajo del umbral \(10 cajas\)/
    );
    expect(screen.getByText("POR DEBAJO DEL UMBRAL")).toBeInTheDocument();
    expect(screen.getByText(/Faltan 6/)).toBeInTheDocument();
  });

  it("el stepper ajusta y persiste el umbral", () => {
    render(<Inventarios />);

    expect(screen.getByTestId("umbral-valor")).toHaveTextContent("10 cajas");
    fireEvent.click(screen.getByRole("button", { name: /reducir umbral/i }));
    expect(screen.getByTestId("umbral-valor")).toHaveTextContent("9 cajas");
    expect(localStorage.getItem("camara.umbral_minimo")).toBe("9");
  });

  it("filtra la cuadrícula solo en riesgo", () => {
    datosMock.inventario = [
      loteMock("camara-1", "L-001", 4),
      loteMock("camara-2", "L-002", 120),
    ];
    render(<Inventarios />);

    fireEvent.click(screen.getByRole("button", { name: /ver en riesgo/i }));
    expect(screen.getAllByText("L-001").length).toBeGreaterThan(0);
    expect(screen.queryByText("L-002")).not.toBeInTheDocument();
  });
});
