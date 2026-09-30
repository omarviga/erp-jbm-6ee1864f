import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import RecepcionesTab from "./RecepcionesTab";
import {
  createDetalleTransferencia,
  createTransferenciaEnTransito,
} from "@/test/bodegaCdmxTestUtils";

const toastErrorMock = vi.fn();
const mutateAsyncMock = vi.fn();
const useTransferenciasCDMXMock = vi.fn();

vi.mock("@/hooks/useTransferenciasCDMX", () => ({
  useTransferenciasCDMX: () => useTransferenciasCDMXMock(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(),
      }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
    warning: vi.fn(),
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

vi.mock("@/components/ui/badge", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return { Badge: mod.MockBadge };
});

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@/components/ui/table", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return mod.mockTableComponents;
});

vi.mock("@/components/ui/dialog", async () => {
  const mod = await import("@/test/bodegaCdmxTestUtils");
  return mod.mockDialogComponents;
});

describe("RecepcionesTab flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useTransferenciasCDMXMock.mockReturnValue({
      transferencias: [createTransferenciaEnTransito()],
      isLoading: false,
      error: null,
      useDetallesTransferencia: (id?: string) => ({
        data: id ? [createDetalleTransferencia()] : [],
        isLoading: false,
      }),
      procesarRecepcion: {
        mutateAsync: mutateAsyncMock,
        isPending: false,
      },
    });
  });

  it("inicializa la recepcion con el precio de venta de la transferencia", async () => {
    render(<RecepcionesTab />);

    fireEvent.click(screen.getByRole("button", { name: /recepcionar/i }));

    expect((await screen.findAllByText(/recepción de transferencia/i)).length).toBeGreaterThan(0);

    const inputPrecioVenta = screen.getByDisplayValue("155");
    expect(inputPrecioVenta).toBeInTheDocument();
    expect(screen.queryByDisplayValue("100")).not.toBeInTheDocument();
  });

  it("bloquea la confirmacion si hay discrepancia sin foto de evidencia", async () => {
    render(<RecepcionesTab />);

    fireEvent.click(screen.getByRole("button", { name: /recepcionar/i }));
    expect((await screen.findAllByText(/recepción de transferencia/i)).length).toBeGreaterThan(0);

    const inputsCantidad = screen.getAllByPlaceholderText("0");
    fireEvent.change(inputsCantidad[0], { target: { value: "8" } });

    fireEvent.click(screen.getByRole("button", { name: /confirmar recepción/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Evidencia requerida", {
        description: "Debes subir una foto para cada producto con discrepancia.",
      });
    });

    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
