import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastSpy = vi.fn();

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, hasRole: () => true, userRoles: ["admin"] }),
}));

vi.mock("@/hooks/useInsumos", () => ({
  TipoMovimientoInsumo: {},
  useInsumos: () => ({
    insumos: [],
    movimientos: [],
    isLoading: false,
    registrarMovimiento: { isPending: false, mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const stub: any = new Proxy(
    function () {},
    {
      get: (_t, prop) => {
        if (prop === "then") {
          return (resolve: (v: any) => void) => resolve({ data: [], error: null });
        }
        return () => stub;
      },
      apply: () => stub,
    }
  );
  return { supabase: stub };
});

import Insumos from "./Insumos";

describe("Insumos repro", () => {
  it("renders sin crash", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Insumos />
      </QueryClientProvider>
    );
    expect(screen.getByText("Valor del Inventario")).toBeInTheDocument();
  });
});
