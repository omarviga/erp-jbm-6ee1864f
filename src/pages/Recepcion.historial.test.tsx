import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import Recepcion from "./Recepcion";
import type { TicketReciente } from "@/hooks/useTicketsRecientes";
import type { BoletaOffline } from "@/lib/recepcion/offlineBoletas";

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();
const toastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/recepcion/NuevoProductorDialog", () => ({
  NuevoProductorDialog: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "carlos.barragan@jbm.com.mx" } }),
}));

vi.mock("@/hooks/useProductores", () => ({
  useProductores: () => ({
    productores: [{ id: "p1", nombre: "Citrícola del Valle" }],
    loading: false,
    error: null,
  }),
}));

const guardarRecepcion = vi.fn();

vi.mock("@/hooks/useRecepcion", () => ({
  useRecepcion: () => ({
    guardarRecepcion,
    loading: false,
    aviso: null,
    limpiarAviso: vi.fn(),
  }),
  useFolioRecepcionPreview: () => ({ data: "REC-2026-009" }),
}));

const useTicketsRecientesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useTicketsRecientes", () => ({
  useTicketsRecientes: (...args: unknown[]) => useTicketsRecientesMock(...args),
}));

const deleteEq = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      delete: () => ({ eq: deleteEq }),
    }),
  },
}));

const ticket = (over: Partial<TicketReciente> = {}): TicketReciente => ({
  id: "l2",
  numeroLote: "L-000009-002",
  folioRecepcion: "REC-2026-008",
  folioFisico: "BAS-10492",
  fechaRecepcion: "2026-09-21T10:30:00",
  productorId: "p1",
  productorNombre: "Citrícola del Valle",
  esCosechaPropia: false,
  estadoCalidad: "aceptado",
  pesoBruto: 14500,
  pesoTara: 4200,
  pesoNeto: 10300,
  kilosMerma: 0,
  defectosPct: 2,
  precioKg: 18.5,
  subtotal: 190550,
  costoBascula: 30,
  basculaFormaPago: "liquidacion",
  basculaDescontada: 30,
  cuotaManiobraKg: 0.4,
  cuotaManiobraConcepto: "Servicios operativos y maniobra",
  cuotaManiobraTotal: 4120,
  totalDeducciones: 4150,
  total: 186400,
  precioNetoEfectivo: 18.1,
  operadorBascula: "Carlos Barragan",
  variedad: "Limón Mexicano",
  ...over,
});

const vistaOffline = (): TicketReciente =>
  ticket({
    id: "offline-aaa",
    numeroLote: "PENDIENTE",
    folioRecepcion: null,
    folioFisico: "BAS-OFF-1",
    fechaRecepcion: "2026-09-22T09:00:00",
    productorNombre: "Productor Offline",
  });

const sembrarOffline = (vistas: TicketReciente[] = [vistaOffline()]) => {
  const boletas: BoletaOffline[] = vistas.map((vista) => ({
    id: vista.id,
    fechaGuardado: vista.fechaRecepcion,
    datos: {} as BoletaOffline["datos"],
    vista,
  }));
  localStorage.setItem("jbm:recepcion:offline:v1", JSON.stringify(boletas));
};

const renderPagina = () => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Recepcion />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const tabla = () => screen.getByRole("table");

describe("Recepcion: historial de boletas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sembrarOffline();
    guardarRecepcion.mockResolvedValue({
      id: "srv-1",
      numero_lote: "L-000009-010",
      folio_recepcion: "REC-2026-010",
      peso_neto: 10300,
      total_liquidar: 186400,
      productor_nombre: "Productor Offline",
      viaRespaldo: false,
    });
    useTicketsRecientesMock.mockReturnValue({
      tickets: [
        ticket({ id: "l2" }),
        ticket({
          id: "l1",
          numeroLote: "L-000009-001",
          folioRecepcion: "REC-2026-007",
          folioFisico: "BAS-10490",
          fechaRecepcion: "2026-09-20T14:00:00",
          total: 150000,
        }),
      ],
      loading: false,
      error: null,
    });
  });

  it("muestra columnas de báscula con tara en rojo y neto destacado", () => {
    renderPagina();

    expect(
      screen.getByRole("heading", { name: "Historial de Boletas" })
    ).toBeInTheDocument();
    for (const col of [
      "Folio",
      "Fecha / Hora",
      "Productor",
      "Peso Bruto",
      "Tara",
      "Peso Neto",
      "Precio / Total",
      "Acciones",
    ]) {
      expect(within(tabla()).getByText(col)).toBeInTheDocument();
    }
    const taras = within(tabla()).getAllByText("-4,200.00");
    expect(taras.length).toBeGreaterThan(0);
    expect(taras[0]).toHaveClass("text-rose-600");
    const netos = within(tabla()).getAllByText("10,300.00", {
      selector: "span",
    });
    expect(netos.length).toBeGreaterThan(0);
    expect(netos[0]).toHaveClass("bg-emerald-100");
    expect(within(tabla()).getByText(/Báscula: BAS-10492/)).toBeInTheDocument();
  });

  it("filtra por folio físico y muestra vacío sin resultados", () => {
    renderPagina();

    fireEvent.change(screen.getByLabelText("Buscar boletas"), {
      target: { value: "10490" },
    });

    expect(within(tabla()).queryByText("REC-2026-008")).not.toBeInTheDocument();
    expect(within(tabla()).getByText("REC-2026-007")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar boletas"), {
      target: { value: "zzz-sin-coincidencia" },
    });
    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
  });

  it("fusiona boletas offline con badge y banner de sincronización", () => {
    renderPagina();

    expect(within(tabla()).getByText(/BAS-OFF-1/)).toBeInTheDocument();
    expect(within(tabla()).getByText("OFFLINE")).toBeInTheDocument();
    expect(
      screen.getByText(/1 boleta\(s\) pendiente\(s\) de sincronización/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sincronizar ahora/i })
    ).toBeInTheDocument();
  });

  it("sincroniza pendientes manual y limpia la lista offline", async () => {
    renderPagina();

    fireEvent.click(screen.getByRole("button", { name: /sincronizar ahora/i }));

    await waitFor(() => {
      expect(
        within(tabla()).queryByText(/BAS-OFF-1/)
      ).not.toBeInTheDocument();
    });
    expect(guardarRecepcion).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/sincronizada/),
      expect.anything()
    );
  });

  it("abre el visor del ticket con zoom y conmutador de ancho", () => {
    renderPagina();

    fireEvent.click(
      screen.getByRole("button", { name: "Ver ticket REC-2026-008" })
    );

    const dialogo = screen.getByRole("dialog", {
      name: "Vista previa del ticket térmico",
    });
    expect(dialogo).toBeInTheDocument();
    expect(within(dialogo).getByText("100%")).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Aumentar zoom" }));
    expect(within(dialogo).getByText("120%")).toBeInTheDocument();

    const btn58 = within(dialogo).getByRole("button", { name: "58mm" });
    fireEvent.click(btn58);
    expect(btn58).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Cerrar vista previa" })
    );
    expect(
      screen.queryByRole("dialog", { name: "Vista previa del ticket térmico" })
    ).not.toBeInTheDocument();
  });

  it("comparte el resumen con emojis al portapapeles", async () => {
    const writeText = vi.fn(async (_texto: string) => {});
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderPagina();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Compartir por WhatsApp REC-2026-008",
      })
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const texto = String(writeText.mock.calls[0][0]);
    expect(texto).toContain("🧾");
    expect(texto).toContain("TOTAL A LIQUIDAR");
    expect(texto).toContain("portal.jbmcitricos.com/status/rec-2026-008");
  });

  it("elimina una boleta offline en dos pasos", async () => {
    renderPagina();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar boleta BAS-OFF-1" })
    );
    const confirmar = screen.getByRole("button", {
      name: "Confirmar eliminación de BAS-OFF-1",
    });
    expect(confirmar).toHaveTextContent("¿Confirmar?");
    fireEvent.click(confirmar);

    await waitFor(() => {
      expect(within(tabla()).queryByText(/BAS-OFF-1/)).not.toBeInTheDocument();
    });
    expect(toastSuccess).toHaveBeenCalledWith("Boleta offline eliminada");
  });

  it("elimina una boleta del servidor en dos pasos", async () => {
    renderPagina();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar boleta REC-2026-008" })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmar eliminación de REC-2026-008",
      })
    );

    await waitFor(() => {
      expect(deleteEq).toHaveBeenCalledWith("id", "l2");
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/REC-2026-008.*eliminada/)
    );
  });

  it("guarda la boleta offline cuando falla sin conexión", async () => {
    guardarRecepcion.mockRejectedValue(new Error("Network down"));
    Object.defineProperty(window.navigator, "onLine", {
      value: false,
      configurable: true,
    });
    try {
      renderPagina();

      fireEvent.click(
        screen.getByRole("button", { name: /nueva boleta de recepción/i })
      );
      fireEvent.change(screen.getByLabelText(/productor \/ proveedor/i), {
        target: { value: "p1" },
      });
      fireEvent.change(screen.getByLabelText(/no\. folio ticket báscula/i), {
        target: { value: "BAS-OFF-9" },
      });
      fireEvent.change(screen.getByLabelText(/bruto \(kg\)/i), {
        target: { value: "14500" },
      });
      fireEvent.change(screen.getByLabelText(/tara \(kg\)/i), {
        target: { value: "4200" },
      });
      fireEvent.change(screen.getByLabelText(/precio por kilo/i), {
        target: { value: "18.5" },
      });
      fireEvent.change(screen.getByLabelText(/maniobra \(\$\/kg\)/i), {
        target: { value: "0.40" },
      });
      fireEvent.click(screen.getByRole("button", { name: /guardar boleta$/i }));
      fireEvent.click(
        screen.getByRole("button", { name: /confirmar y guardar pesaje/i })
      );

      await waitFor(() => {
        expect(
          within(tabla()).getByText(/Báscula: BAS-OFF-9/)
        ).toBeInTheDocument();
      });
      expect(toastWarning).toHaveBeenCalledWith(
        expect.stringMatching(/offline/),
        expect.anything()
      );
    } finally {
      Object.defineProperty(window.navigator, "onLine", {
        value: true,
        configurable: true,
      });
    }
  });

  it("imprime directo seleccionando la boleta de la fila", async () => {
    const imprimir = vi.fn();
    Object.defineProperty(window, "print", {
      value: imprimir,
      configurable: true,
    });
    renderPagina();

    fireEvent.click(
      screen.getByRole("button", { name: "Imprimir directo REC-2026-007" })
    );

    expect(screen.getByText("Boleta del lote L-000009-001")).toBeInTheDocument();
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
  });
});
