import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import { useTransferenciasCDMX } from "./useTransferenciasCDMX";

const toastMock = vi.fn();
const rpcMock = vi.fn();

type QueryResult = Promise<{ data: unknown; error: unknown }>;

const buildQuery = (executor: () => QueryResult) => {
  const chain = {
    select: () => chain,
    order: () => chain,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      executor().then(resolve, reject),
  };

  return chain;
};

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: (...args: unknown[]) => toastMock(...args) }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "transferencias_bodega") {
        return buildQuery(async () => ({ data: [], error: null }));
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-1",
          },
        },
      }),
    },
  },
}));

describe("useTransferenciasCDMX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("procesa la recepcion con el usuario autenticado e invalida transferencias e inventario", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          success: true,
          tiene_discrepancias: true,
          mensaje: "Se recibio con diferencia de 2 cajas",
        },
      ],
      error: null,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTransferenciasCDMX(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.procesarRecepcion.mutateAsync({
      transferenciaId: "tr-1",
      detalles: [
        {
          presentacion_id: "pres-1",
          cantidad_recibida: 8,
          precio_venta: 155,
          notas_diferencia: "Llegaron 2 cajas menos",
        },
      ],
    });

    expect(rpcMock).toHaveBeenCalledWith("procesar_recepcion_transferencia", {
      p_transferencia_id: "tr-1",
      p_detalles: [
        {
          presentacion_id: "pres-1",
          cantidad_recibida: 8,
          precio_venta: 155,
          notas_diferencia: "Llegaron 2 cajas menos",
        },
      ],
      p_recibido_por: "user-1",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["transferencias-bodega"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["inventario-cdmx"] });
    expect(toastMock).toHaveBeenCalledWith({
      title: "⚠️ Recepción con discrepancias",
      description: "Se recibio con diferencia de 2 cajas",
      variant: "destructive",
    });
  });

  it("muestra toast de error cuando falla la recepcion", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("RPC fuera de servicio"),
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTransferenciasCDMX(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      result.current.procesarRecepcion.mutateAsync({
        transferenciaId: "tr-2",
        detalles: [
          {
            presentacion_id: "pres-2",
            cantidad_recibida: 5,
            precio_venta: 120,
          },
        ],
      }),
    ).rejects.toThrow("RPC fuera de servicio");

    expect(toastMock).toHaveBeenCalledWith({
      title: "❌ Error al procesar recepción",
      description: "RPC fuera de servicio",
      variant: "destructive",
    });
  });
});
