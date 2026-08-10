import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import CorteCajaTab from "./CorteCajaTab";
import { createUseQueryResult } from "@/test/bodegaCdmxTestUtils";

const useQueryMock = vi.fn();
const rpcMock = vi.fn();
const insertMock = vi.fn();
const ventasSelectMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastWarningMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (table: string) => {
      if (table === "cortes_caja_bodega") {
        return {
          insert: (...args: unknown[]) => insertMock(...args),
        };
      }

      if (table === "ventas") {
        return {
          select: (...args: unknown[]) => ventasSelectMock(...args),
        };
      }

      throw new Error(`Tabla no mockeada en prueba: ${table}`);
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: (...args: unknown[]) => toastWarningMock(...args),
  },
}));

vi.mock("@/components/ui/card", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return mod.mockCardComponents;
});

vi.mock("@/components/ui/button", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Button: mod.MockButton };
});

vi.mock("@/components/ui/input", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Input: mod.MockInput };
});

vi.mock("@/components/ui/textarea", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Textarea: mod.MockTextarea };
});

vi.mock("@/components/ui/label", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Label: mod.MockLabel };
});

vi.mock("@/components/ui/badge", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Badge: mod.MockBadge };
});

vi.mock("@/components/ui/select", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return mod.mockSelectComponents;
});

describe("CorteCajaTab flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ventasSelectMock.mockImplementation(() => ({
      eq: () => ({
        gte: () => ({
          lt: async () => ({ data: [], error: null }),
        }),
      }),
    }));
    useAuthMock.mockReturnValue({
      user: { id: "admin-1", email: "admin@jbm.mx" },
      isAdmin: true,
      hasRole: (role: string) => role === "admin",
    });
  });

  it("marca incidencias cuando hay ventas con pago pero sin ticket en la bitacora", () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      switch (queryKey[0]) {
        case "cortes-caja-cdmx":
          return createUseQueryResult([]);
        case "corte-caja-cdmx-preview":
          return createUseQueryResult(100);
        case "corte-caja-cdmx-resumen":
          return createUseQueryResult({
            totalVentas: 100,
            totalEfectivo: 100,
            totalTransferencia: 0,
            totalCheque: 0,
          });
        case "corte-caja-cdmx-tickets-periodo":
          return createUseQueryResult([]);
        case "corte-caja-cdmx-granel":
          return createUseQueryResult([
            {
              cantidad: 2,
              created_at: "2026-03-13T09:00:00.000Z",
              motivo: "Apertura de cajas para venta a granel",
            },
            {
              cantidad: 40,
              created_at: "2026-03-13T09:05:00.000Z",
              motivo: "Conversion a granel desde Caja Reja 20 kg",
            },
            {
              cantidad: 3,
              created_at: "2026-03-13T11:00:00.000Z",
              motivo: "Merma granel: diferencia física",
            },
          ]);
        case "corte-caja-cdmx-conciliacion":
        case "corte-caja-cdmx-auditoria":
          return createUseQueryResult([
            {
              id: "venta-1",
              numero_venta: "V-001",
              total: 100,
              created_at: "2026-03-13T10:00:00.000Z",
              pagos_clientes: [
                { id: "pago-1", monto: 100, forma_pago: "efectivo" },
              ],
            },
          ]);
        default:
          throw new Error(`Query no mockeada: ${queryKey[0]}`);
      }
    });

    render(<CorteCajaTab />);

    expect(screen.getByText(/1 incidencia\(s\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/venta con pago pero sin ticket en bitacora separada/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("V-001")).toHaveLength(2);
    expect(screen.getByText(/resumen operativo de granel/i)).toBeInTheDocument();
    expect(screen.getByText(/kg merma/i)).toBeInTheDocument();
  });

  it("guarda el corte con los totales del periodo y muestra resultado cuadrado", async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    ventasSelectMock.mockImplementation(() => ({
      eq: () => ({
        gte: () => ({
          lt: async () => ({
            data: [
              {
                id: "venta-1",
                numero_venta: "V-001",
                total: 200,
                created_at: "2026-03-13T10:00:00.000Z",
                pagos_clientes: [
                  { id: "pago-1", monto: 200, forma_pago: "efectivo" },
                ],
              },
              {
                id: "venta-2",
                numero_venta: "V-002",
                total: 150,
                created_at: "2026-03-13T10:10:00.000Z",
                pagos_clientes: [
                  { id: "pago-2", monto: 100, forma_pago: "transferencia" },
                  { id: "pago-3", monto: 50, forma_pago: "cheque" },
                ],
              },
            ],
            error: null,
          }),
        }),
      }),
    }));

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      switch (queryKey[0]) {
        case "cortes-caja-cdmx":
          return createUseQueryResult([], { refetch: refetchMock });
        case "corte-caja-cdmx-preview":
          return createUseQueryResult(200, { refetch: refetchMock });
        case "corte-caja-cdmx-resumen":
          return createUseQueryResult({
            totalVentas: 350,
            totalEfectivo: 200,
            totalTransferencia: 100,
            totalCheque: 50,
          }, { refetch: refetchMock });
        case "corte-caja-cdmx-tickets-periodo":
          return createUseQueryResult([
            {
              id: "ticket-1",
              venta_id: "venta-1",
              numero_venta: "V-001",
              cliente_nombre: "Cliente Uno",
              metodo_pago: "efectivo",
              total: 200,
              created_at: "2026-03-13T10:00:00.000Z",
              items: [],
            },
          ]);
        case "corte-caja-cdmx-granel":
          return createUseQueryResult([
            {
              cantidad: 3,
              created_at: "2026-03-13T09:00:00.000Z",
              motivo: "Apertura de cajas para venta a granel",
            },
            {
              cantidad: 60,
              created_at: "2026-03-13T09:05:00.000Z",
              motivo: "Conversion a granel desde Caja Reja 20 kg",
            },
            {
              cantidad: 2.5,
              created_at: "2026-03-13T11:00:00.000Z",
              motivo: "Merma granel: diferencia física",
            },
          ]);
        case "corte-caja-cdmx-conciliacion":
        case "corte-caja-cdmx-auditoria":
          return createUseQueryResult([
            {
              id: "venta-1",
              numero_venta: "V-001",
              total: 200,
              created_at: "2026-03-13T10:00:00.000Z",
              pagos_clientes: [
                { id: "pago-1", monto: 200, forma_pago: "efectivo" },
              ],
            },
          ]);
        default:
          throw new Error(`Query no mockeada: ${queryKey[0]}`);
      }
    });

    insertMock.mockResolvedValue({ error: null });

    render(<CorteCajaTab />);

    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cerrar corte de caja/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        efectivo_teorico: 200,
        efectivo_fisico: 200,
        total_ventas: 350,
        total_efectivo: 200,
        total_tarjeta: 50,
        total_transferencia: 100,
        estado: "cerrado",
        cerrado_por: "admin-1",
      }),
    );

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Corte cuadrado. ¡Excelente!");
    });

    expect(await screen.findByText(/corte cuadrado/i)).toBeInTheDocument();
  });

  it("muestra aviso y bloquea el cierre cuando el usuario no tiene permiso", () => {
    useAuthMock.mockReturnValue({
      user: { id: "ventas-1", email: "caja@jbm.mx" },
      isAdmin: false,
      hasRole: () => false,
    });

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      switch (queryKey[0]) {
        case "cortes-caja-cdmx":
          return createUseQueryResult([]);
        case "corte-caja-cdmx-preview":
          return createUseQueryResult(0);
        case "corte-caja-cdmx-resumen":
          return createUseQueryResult({
            totalVentas: 0,
            totalEfectivo: 0,
            totalTransferencia: 0,
            totalCheque: 0,
          });
        case "corte-caja-cdmx-tickets-periodo":
        case "corte-caja-cdmx-granel":
        case "corte-caja-cdmx-conciliacion":
        case "corte-caja-cdmx-auditoria":
          return createUseQueryResult([]);
        default:
          throw new Error(`Query no mockeada: ${queryKey[0]}`);
      }
    });

    render(<CorteCajaTab />);

    expect(screen.getByText(/no tienes permiso para cerrar corte de caja/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cerrar corte de caja/i })).toBeDisabled();
  });

  it("traduce errores tecnicos de base a un mensaje claro para operacion", async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    ventasSelectMock.mockImplementation(() => ({
      eq: () => ({
        gte: () => ({
          lt: async () => ({
            data: [
              {
                id: "venta-1",
                numero_venta: "V-001",
                total: 200,
                created_at: "2026-03-13T10:00:00.000Z",
                pagos_clientes: [
                  { id: "pago-1", monto: 200, forma_pago: "efectivo" },
                ],
              },
              {
                id: "venta-2",
                numero_venta: "V-002",
                total: 150,
                created_at: "2026-03-13T10:10:00.000Z",
                pagos_clientes: [
                  { id: "pago-2", monto: 100, forma_pago: "transferencia" },
                  { id: "pago-3", monto: 50, forma_pago: "cheque" },
                ],
              },
            ],
            error: null,
          }),
        }),
      }),
    }));

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      switch (queryKey[0]) {
        case "cortes-caja-cdmx":
          return createUseQueryResult([], { refetch: refetchMock });
        case "corte-caja-cdmx-preview":
          return createUseQueryResult(200, { refetch: refetchMock });
        case "corte-caja-cdmx-resumen":
          return createUseQueryResult({
            totalVentas: 350,
            totalEfectivo: 200,
            totalTransferencia: 100,
            totalCheque: 50,
          }, { refetch: refetchMock });
        case "corte-caja-cdmx-tickets-periodo":
        case "corte-caja-cdmx-granel":
        case "corte-caja-cdmx-conciliacion":
        case "corte-caja-cdmx-auditoria":
          return createUseQueryResult([]);
        default:
          throw new Error(`Query no mockeada: ${queryKey[0]}`);
      }
    });

    insertMock.mockResolvedValue({
      error: {
        message: 'cannot insert a non-DEFAULT value into column "diferencia"',
      },
    });

    render(<CorteCajaTab />);

    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cerrar corte de caja/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Error al procesar el corte", {
        description: "La base rechazó un cálculo automático del corte. Ya quedó corregido; intenta nuevamente.",
      });
    });
  });

  it("marca cortes historicos inconsistentes sin duplicar diff tecnico", () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      switch (queryKey[0]) {
        case "cortes-caja-cdmx":
          return createUseQueryResult([
            {
              id: "corte-1",
              folio: "CC-CDMX-260319-0733",
              fecha_corte: "2026-03-19T07:33:00.000Z",
              efectivo_teorico: 0,
              efectivo_fisico: 72.5,
              diferencia: 72.5,
              total_ventas: 0,
              total_efectivo: 0,
              total_transferencia: 0,
              total_tarjeta: 0,
            },
          ]);
        case "corte-caja-cdmx-resumen":
          return createUseQueryResult({
            totalVentas: 0,
            totalEfectivo: 0,
            totalTransferencia: 0,
            totalCheque: 0,
          });
        case "corte-caja-cdmx-tickets-periodo":
        case "corte-caja-cdmx-granel":
        case "corte-caja-cdmx-conciliacion":
        case "corte-caja-cdmx-auditoria":
          return createUseQueryResult([]);
        default:
          throw new Error(`Query no mockeada: ${queryKey[0]}`);
      }
    });

    render(<CorteCajaTab />);

    expect(screen.getByText(/registro inconsistente/i)).toBeInTheDocument();
    expect(screen.getByText(/cálculo anterior inconsistente/i)).toBeInTheDocument();
    expect(screen.queryByText(/Diff:/i)).not.toBeInTheDocument();
  });
});
