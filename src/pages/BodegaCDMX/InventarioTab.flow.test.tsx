import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import InventarioTab from "./InventarioTab";
import { createInventarioItem } from "@/test/bodegaCdmxTestUtils";

const useAuthMock = vi.fn();
const useQueryMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("@/components/ui/card", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return mod.mockCardComponents;
});

vi.mock("@/components/ui/badge", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Badge: mod.MockBadge };
});

vi.mock("@/components/ui/button", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Button: mod.MockButton };
});

vi.mock("@/components/ui/input", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Input: mod.MockInput };
});

vi.mock("@/components/ui/dialog", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return mod.mockDialogComponents;
});

vi.mock("@/components/ui/table", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return mod.mockTableComponents;
});

describe("InventarioTab flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("oculta el precio base para operador y muestra el aviso de seguridad", () => {
    useAuthMock.mockReturnValue({ isAdmin: false });
    useQueryMock
      .mockReturnValueOnce({
        data: [
          createInventarioItem(),
          createInventarioItem({
            id: "inv-granel-1",
            presentacion_id: "pres-granel-1",
            cantidad_disponible: 15,
            precio_venta: 42,
            presentacion: {
              nombre: "Granel mostrador - Limon 18 kg",
              tipo: "granel",
              peso_kg: 1,
            },
          }),
        ],
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
      });

    render(<InventarioTab />);

    expect(screen.getByText(/cajas abiertas hoy/i)).toBeInTheDocument();
    expect(screen.getByText(/kg generados hoy/i)).toBeInTheDocument();
    expect(screen.getByText(/merma granel hoy/i)).toBeInTheDocument();
    expect(screen.getByText(/granel disponible actual: 15 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/nivel de granel suficiente/i)).toBeInTheDocument();
    expect(screen.getByText(/precios base \(costo\) están ocultos/i)).toBeInTheDocument();
    expect(screen.queryByText(/precio base \(costo\)/i)).not.toBeInTheDocument();
    expect(screen.getByText("$160.00")).toBeInTheDocument();
  });

  it("calcula promedios ponderados y ordena primero el producto con mas cajas", () => {
    useAuthMock.mockReturnValue({ isAdmin: true });
    useQueryMock
      .mockReturnValueOnce({
        data: [
          createInventarioItem({ cantidad_disponible: 10, precio_base: 100, precio_venta: 150 }),
          createInventarioItem({
            id: "inv-2",
            cantidad_disponible: 5,
            precio_base: 200,
            precio_venta: 210,
            fecha_ingreso: "2026-03-13T09:00:00.000Z",
          }),
          createInventarioItem({
            id: "inv-3",
            presentacion_id: "pres-2",
            cantidad_disponible: 4,
            precio_base: 50,
            precio_venta: 70,
            fecha_ingreso: "2026-03-13T10:00:00.000Z",
            presentacion: {
              nombre: "Limon 4.5 kg",
              tipo: "nacional",
              peso_kg: 4.5,
            },
          }),
        ],
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: [
          {
            cantidad: 3,
            created_at: "2026-03-19T10:00:00.000Z",
            motivo: "Apertura de cajas para venta a granel",
            inventario: {
              presentacion: {
                nombre: "Caja Reja 20 kg",
                tipo: "caja",
              },
            },
          },
          {
            cantidad: 60,
            created_at: "2026-03-19T10:05:00.000Z",
            motivo: "Conversion a granel desde Caja Reja 20 kg",
            inventario: {
              presentacion: {
                nombre: "Granel mostrador - Caja Reja 20 kg",
                tipo: "granel",
              },
            },
          },
          {
            cantidad: 4.5,
            created_at: "2026-03-19T11:10:00.000Z",
            motivo: "Merma granel: diferencia física",
            inventario: {
              presentacion: {
                nombre: "Granel mostrador - Caja Reja 20 kg",
                tipo: "granel",
              },
            },
          },
        ],
        isLoading: false,
      });

    render(<InventarioTab />);

    const encabezadoPrincipal = screen.getAllByText(/Limon 18 kg/i)[0];
    expect(encabezadoPrincipal).toBeInTheDocument();
    expect(screen.getByText("$133.33")).toBeInTheDocument();
    expect(screen.getByText("$170.00")).toBeInTheDocument();
    expect(screen.getByText(/15 cajas/i)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/kg generados hoy/i)).toBeInTheDocument();
    expect(screen.getByText(/merma granel hoy/i)).toBeInTheDocument();
    expect(screen.getByText("Cajas")).toBeInTheDocument();
    expect(screen.getAllByText(/abrir a granel/i).length).toBeGreaterThan(0);
  });

  it("muestra alerta cuando el granel disponible esta por debajo del umbral", () => {
    useAuthMock.mockReturnValue({ isAdmin: true });
    useQueryMock
      .mockReturnValueOnce({
        data: [
          createInventarioItem({
            id: "inv-granel-2",
            presentacion_id: "pres-granel-2",
            cantidad_disponible: 6.5,
            precio_venta: 44,
            presentacion: {
              nombre: "Granel mostrador - Limon 18 kg",
              tipo: "granel",
              peso_kg: 1,
            },
          }),
        ],
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
      });

    render(<InventarioTab />);

    expect(screen.getByText(/granel disponible actual: 6.5 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/stock bajo de granel/i)).toBeInTheDocument();
  });

  it("muestra alerta fuerte cuando ya no hay granel disponible", () => {
    useAuthMock.mockReturnValue({ isAdmin: true });
    useQueryMock
      .mockReturnValueOnce({
        data: [
          createInventarioItem({
            id: "inv-granel-3",
            presentacion_id: "pres-granel-3",
            cantidad_disponible: 0,
            precio_venta: 44,
            presentacion: {
              nombre: "Granel mostrador - Limon 18 kg",
              tipo: "granel",
              peso_kg: 1,
            },
          }),
        ],
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
      });

    render(<InventarioTab />);

    expect(screen.getByText(/granel disponible actual: 0 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/sin granel disponible/i)).toBeInTheDocument();
  });
});
