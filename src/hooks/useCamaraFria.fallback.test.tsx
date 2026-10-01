import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import { useCamaraFria } from "./useCamaraFria";

const rpcMock = vi.fn();

type WriteCall = { table: string; op: "insert" | "update"; payload: unknown };
const writes: WriteCall[] = [];

type Chain = {
  select: () => Chain;
  eq: () => Chain;
  gt: () => Chain;
  order: () => Chain;
  limit: () => Chain;
  insert: (payload: unknown) => Chain;
  update: (payload: unknown) => Chain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
  then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => unknown;
};

const buildChain = (table: string): Chain => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gt: () => chain,
    order: () => chain,
    limit: () => chain,
    insert: (payload: unknown) => {
      writes.push({ table, op: "insert", payload });
      return chain;
    },
    update: (payload: unknown) => {
      writes.push({ table, op: "update", payload });
      return chain;
    },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };

  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => buildChain(table),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

const renderCamaraFria = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useCamaraFria(), { wrapper });
};

describe("useCamaraFria (fallback de contingencia)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.length = 0;
  });

  it("traslado interno usa el RPC y no escribe directo a las tablas", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderCamaraFria();
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.trasladoInterno({
      produccionId: "prod-1",
      loteId: "lote-1",
      cantidad: 10,
      usuarioId: "user-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("trasladar_a_camara_fria", {
      p_produccion_id: "prod-1",
      p_lote_id: "lote-1",
      p_cantidad: 10,
      p_usuario_id: "user-1",
    });
    expect(writes).toEqual([]);
  });

  it("traslado interno falla cerrado (sin escrituras) si falta el RPC y el fallback esta deshabilitado", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.trasladar_a_camara_fria" },
    });

    const { result } = renderCamaraFria();
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      result.current.trasladoInterno({
        produccionId: "prod-1",
        loteId: "lote-1",
        cantidad: 10,
        usuarioId: "user-1",
      })
    ).rejects.toThrow(/fallback está deshabilitado/);
    expect(writes).toEqual([]);
  });

  it("traslado interno propaga el error del RPC sin fallback cuando no es funcion faltante", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "No autorizado" },
    });

    const { result } = renderCamaraFria();
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      result.current.trasladoInterno({
        produccionId: "prod-1",
        loteId: "lote-1",
        cantidad: 10,
        usuarioId: "user-1",
      })
    ).rejects.toThrow(/No autorizado/);
    expect(writes).toEqual([]);
  });

  it("envio directo falla cerrado (sin escrituras) si falta el RPC y el fallback esta deshabilitado", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.registrar_envio_cdmx_transporte_directo" },
    });

    const { result } = renderCamaraFria();
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      result.current.enviarTransporteDirectoACdmx({
        produccionId: "prod-1",
        loteId: "lote-1",
        cantidad: 5,
        precioBaseCongelado: 100,
        referenciaViaje: "Viaje test",
        usuarioId: "user-1",
      })
    ).rejects.toThrow(/fallback está deshabilitado/);
    expect(writes).toEqual([]);
  });
});
