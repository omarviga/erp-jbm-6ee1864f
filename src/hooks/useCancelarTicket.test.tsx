import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { useCancelarTicket } from "./useCancelarTicket";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe("useCancelarTicket", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("convierte el error plano de PostgREST en Error con el mensaje real", async () => {
    // Sin throwOnError, supabase devuelve { error } como objeto plano
    // (no instanceof Error): el hook debe normalizarlo para el toast.
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Could not find the function public.cancelar_ticket",
        code: "PGRST202",
      },
    });
    const { result } = renderHook(() => useCancelarTicket(), { wrapper });
    let atrapado: unknown = null;
    await act(async () => {
      try {
        await result.current.cancelar("lote-1", "Ticket duplicado");
      } catch (e) {
        atrapado = e;
      }
    });
    expect(atrapado).toBeInstanceOf(Error);
    expect((atrapado as Error).message).toContain("cancelar_ticket");
    expect(rpc).toHaveBeenCalledWith("cancelar_ticket", {
      p_lote_id: "lote-1",
      p_motivo: "Ticket duplicado",
    });
  });

  it("valida el motivo sin llamar al servidor", async () => {
    const { result } = renderHook(() => useCancelarTicket(), { wrapper });
    await expect(
      act(async () => {
        await result.current.cancelar("lote-1", "abc");
      }),
    ).rejects.toThrow(/motivo/i);
    expect(rpc).not.toHaveBeenCalled();
  });
});
