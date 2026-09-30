import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import Recepcion from "./Recepcion";
import type { TicketReciente } from "@/hooks/useTicketsRecientes";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
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

describe("Recepcion: listado de tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it("muestra encabezado, botón y últimos tickets", () => {
    renderPagina();

    expect(
      screen.getByRole("button", { name: /nueva boleta de recepción/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("REC-2026-008").length).toBeGreaterThan(0);
    expect(screen.getAllByText("REC-2026-007").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Citrícola del Valle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$186,400.00").length).toBeGreaterThan(0);
  });

  it("selecciona el más reciente y muestra su detalle", () => {
    renderPagina();

    expect(screen.getByText("Boleta del lote L-000009-002")).toBeInTheDocument();
  });

  it("cambia el detalle al seleccionar otro ticket", () => {
    renderPagina();

    fireEvent.click(screen.getByText("REC-2026-007"));

    expect(screen.getByText("Boleta del lote L-000009-001")).toBeInTheDocument();
  });

  it("abre el modal de nueva boleta", () => {
    renderPagina();

    fireEvent.click(
      screen.getByRole("button", { name: /nueva boleta de recepción/i })
    );

    expect(
      screen.getByRole("dialog", { name: "Nueva Boleta de Recepción y Pesaje" })
    ).toBeInTheDocument();
  });

  it("muestra estado vacío sin tickets", () => {
    useTicketsRecientesMock.mockReturnValue({
      tickets: [],
      loading: false,
      error: null,
    });
    renderPagina();

    expect(screen.getByText(/sin tickets registrados/i)).toBeInTheDocument();
  });

  it("muestra cargando mientras consulta", () => {
    useTicketsRecientesMock.mockReturnValue({
      tickets: [],
      loading: true,
      error: null,
    });
    renderPagina();

    expect(screen.getByText(/cargando tickets/i)).toBeInTheDocument();
  });

  it("guarda una boleta desde el modal con los valores capturados", async () => {
    guardarRecepcion.mockResolvedValue({
      id: "lote-9",
      numero_lote: "L-000009-003",
      folio_recepcion: "REC-2026-009",
      peso_neto: 10300,
      total_liquidar: 186400,
      productor_nombre: "Citrícola del Valle",
      viaRespaldo: false,
    });
    renderPagina();

    fireEvent.click(
      screen.getByRole("button", { name: /nueva boleta de recepción/i })
    );

    fireEvent.change(screen.getByLabelText(/productor \/ proveedor/i), {
      target: { value: "p1" },
    });
    fireEvent.change(screen.getByLabelText(/no\. folio ticket báscula/i), {
      target: { value: "B-10293" },
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
      expect(guardarRecepcion).toHaveBeenCalledTimes(1);
    });
    const enviado = guardarRecepcion.mock.calls[0][0];
    expect(enviado.productor_id).toBe("p1");
    expect(enviado.folio_fisico).toBe("B-10293");
    expect(enviado.peso_bruto).toBe(14500);
    expect(enviado.precio_pactado_kg).toBe(18.5);
    expect(enviado.costo_bascula).toBe(30);
    expect(enviado.cuota_maniobra_kg).toBe(0.4);
    expect(enviado.es_cosecha_propia).toBe(false);
    expect(enviado.origen).toBe("externo");

    expect(
      await screen.findByText(/L-000009-003 registrado/i)
    ).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/L-000009-003/),
      expect.anything()
    );
  }, 20000);
});
