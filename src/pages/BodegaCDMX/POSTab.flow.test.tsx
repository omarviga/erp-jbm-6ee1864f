import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import POSTab from "./POSTab";

const cobrarMock = vi.fn();
const refetchTicketsMock = vi.fn().mockResolvedValue(undefined);
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

const useVentasMock = vi.fn();
const useQueryMock = vi.fn();
const singleMock = vi.fn();

vi.mock("@/hooks/useVentas", () => ({
  useVentas: () => useVentasMock(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "caja@jbm.mx" } }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: (...args: unknown[]) => singleMock(...args),
        }),
      }),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: vi.fn(),
  },
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe("POSTab flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useQueryMock.mockReturnValue({
      data: [
        {
          ventaId: "venta-previa",
          numeroVenta: "T-0001",
          total: 80,
          metodoPago: "efectivo",
          cliente: "Público en general",
          fecha: "2026-03-13T10:00:00.000Z",
          items: [
            {
              id: "prod-1",
              nombre: "Limon persa",
              cantidad: 1,
              precio_venta: 80,
            },
          ],
        },
      ],
      refetch: refetchTicketsMock,
    });

    useVentasMock.mockReturnValue({
      productos: [
        {
          id: "prod-1",
          nombre: "Limon persa",
          tipo: "caja",
          precio_sugerido: 120,
        },
        {
          id: "prod-granel",
          nombre: "Limon a granel",
          tipo: "granel",
          peso_kg: 1,
          precio_sugerido: 42,
        },
      ],
      clientes: [
        { id: "cliente-publico", nombre: "Público en general", tipo: "general" },
        { id: "cliente-2", nombre: "Mostrador Centro", tipo: "minorista" },
      ],
      carrito: [
        {
          id: "prod-1",
          nombre: "Limon persa",
          cantidad: 1,
          precio_venta: 120,
          precio_sugerido: 120,
        },
      ],
      stock: { "prod-1": 12, "prod-granel": 15 },
      loading: false,
      agregarAlCarrito: vi.fn(),
      actualizarItem: vi.fn(),
      eliminarDelCarrito: vi.fn(),
      limpiarCarrito: vi.fn(),
      cobrar: cobrarMock,
    });

    cobrarMock.mockResolvedValue({
      id: "venta-2",
      numero_venta: "T-0002",
      created_at: "2026-03-13T11:00:00.000Z",
    });

    singleMock.mockResolvedValue({
      data: {
        venta_id: "venta-2",
        numero_venta: "T-0002",
        cliente_nombre: "Mostrador Centro",
        metodo_pago: "transferencia",
        total: 120,
        created_at: "2026-03-13T11:00:00.000Z",
        items: [
          {
            id: "prod-1",
            nombre: "Limon persa",
            cantidad: 1,
            precio_venta: 120,
          },
        ],
      },
      error: null,
    });
  });

  it("cobra usando el cliente y metodo elegidos y muestra el ticket resultante", async () => {
    render(<POSTab />);

    fireEvent.click(screen.getAllByRole("button", { name: /público en general/i })[1]);
    expect(screen.getByText(/seleccionar cliente/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mostrador centro/i }));
    fireEvent.click(screen.getByRole("button", { name: /transferencia/i }));
    fireEvent.click(screen.getByRole("button", { name: /^pagar$/i }));

    await waitFor(() => {
      expect(cobrarMock).toHaveBeenCalledWith("cliente-2", 120, "transferencia");
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Venta registrada correctamente");
    });

    expect(refetchTicketsMock).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /ver ticket/i }));

    expect(await screen.findByText("Preview del ticket")).toBeInTheDocument();
    expect(screen.getByText("T-0002")).toBeInTheDocument();
    expect(screen.getAllByText(/Mostrador Centro/i).length).toBeGreaterThan(0);
  }, 10000);

  it("bloquea el cobro cuando el carrito trae un precio por debajo del minimo", () => {
    useVentasMock.mockReturnValue({
      ...useVentasMock.mock.results[0]?.value,
      productos: [
        {
          id: "prod-1",
          nombre: "Limon persa",
          precio_sugerido: 120,
        },
      ],
      clientes: [{ id: "cliente-publico", nombre: "Público en general", tipo: "general" }],
      carrito: [
        {
          id: "prod-1",
          nombre: "Limon persa",
          cantidad: 1,
          precio_venta: 90,
          precio_sugerido: 120,
        },
      ],
      stock: { "prod-1": 12 },
      loading: false,
      agregarAlCarrito: vi.fn(),
      actualizarItem: vi.fn(),
      eliminarDelCarrito: vi.fn(),
      limpiarCarrito: vi.fn(),
      cobrar: cobrarMock,
    });

    render(<POSTab />);

    const botonBloqueado = screen.getByRole("button", { name: /bloqueado/i });
    expect(botonBloqueado).toBeDisabled();

    fireEvent.click(botonBloqueado);
    expect(cobrarMock).not.toHaveBeenCalled();
  });

  it("permite filtrar rapidamente los productos a granel", () => {
    render(<POSTab />);

    expect(screen.getByRole("button", { name: /granel \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limon a granel/i })).toBeInTheDocument();
    expect(screen.getByText(/granel disponible hoy: 15 kg/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /granel \(1\)/i }));

    expect(screen.getByRole("button", { name: /limon a granel/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^limon persa/i })).not.toBeInTheDocument();
  }, 10000);

  it("muestra alerta visual cuando el granel disponible esta bajo", () => {
    useVentasMock.mockReturnValue({
      productos: [
        {
          id: "prod-1",
          nombre: "Limon persa",
          tipo: "caja",
          precio_sugerido: 120,
        },
        {
          id: "prod-granel",
          nombre: "Limon a granel",
          tipo: "granel",
          peso_kg: 1,
          precio_sugerido: 42,
        },
      ],
      clientes: [
        { id: "cliente-publico", nombre: "Público en general", tipo: "general" },
        { id: "cliente-2", nombre: "Mostrador Centro", tipo: "minorista" },
      ],
      carrito: [
        {
          id: "prod-1",
          nombre: "Limon persa",
          cantidad: 1,
          precio_venta: 120,
          precio_sugerido: 120,
        },
      ],
      stock: { "prod-1": 12, "prod-granel": 6.5 },
      loading: false,
      agregarAlCarrito: vi.fn(),
      actualizarItem: vi.fn(),
      eliminarDelCarrito: vi.fn(),
      limpiarCarrito: vi.fn(),
      cobrar: cobrarMock,
    });

    render(<POSTab />);

    expect(screen.getByText(/granel disponible hoy: 6.5 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/stock bajo de granel/i)).toBeInTheDocument();
  });

  it("muestra alerta fuerte cuando ya no hay granel disponible", () => {
    useVentasMock.mockReturnValue({
      productos: [
        {
          id: "prod-1",
          nombre: "Limon persa",
          tipo: "caja",
          precio_sugerido: 120,
        },
        {
          id: "prod-granel",
          nombre: "Limon a granel",
          tipo: "granel",
          peso_kg: 1,
          precio_sugerido: 42,
        },
      ],
      clientes: [
        { id: "cliente-publico", nombre: "Público en general", tipo: "general" },
      ],
      carrito: [
        {
          id: "prod-1",
          nombre: "Limon persa",
          cantidad: 1,
          precio_venta: 120,
          precio_sugerido: 120,
        },
      ],
      stock: { "prod-1": 12, "prod-granel": 0 },
      loading: false,
      agregarAlCarrito: vi.fn(),
      actualizarItem: vi.fn(),
      eliminarDelCarrito: vi.fn(),
      limpiarCarrito: vi.fn(),
      cobrar: cobrarMock,
    });

    render(<POSTab />);

    expect(screen.getByText(/granel disponible hoy: 0 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/sin granel disponible/i)).toBeInTheDocument();
  });
});
