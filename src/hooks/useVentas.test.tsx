import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { useVentas } from "./useVentas";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const rpcMock = vi.fn();
let presentacionesFixture: unknown[] = [
  {
    id: "pres-1",
    nombre: "Limon 18 kg",
    peso_kg: 18,
    tipo: "exportacion",
    activa: true,
  },
];
let inventarioFixture: unknown[] = [
  {
    id: "inv-1",
    cantidad_disponible: 3,
    precio_venta: 180,
    presentacion_id: "pres-1",
    presentacion: {
      id: "pres-1",
      nombre: "Limon 18 kg",
      peso_kg: 18,
      tipo: "exportacion",
      activa: true,
    },
  },
];

type QueryResult = Promise<{ data: unknown; error: unknown }>;

const buildQuery = (executor: (steps: string[], value?: unknown) => QueryResult) => {
  const steps: string[] = [];
  const chain = {
    select: (value?: unknown) => {
      steps.push(`select:${String(value || "")}`);
      return chain;
    },
    eq: (field: string, value: unknown) => {
      steps.push(`eq:${field}:${String(value)}`);
      return chain;
    },
    gt: (field: string, value: unknown) => {
      steps.push(`gt:${field}:${String(value)}`);
      return chain;
    },
    order: (field: string) => {
      steps.push(`order:${field}`);
      return chain;
    },
    single: () => executor([...steps], "single"),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      executor([...steps]).then(resolve, reject),
  };

  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "presentaciones") {
        return buildQuery(async () => ({
          data: presentacionesFixture,
          error: null,
        }));
      }

      if (table === "clientes") {
        return buildQuery(async () => ({
          data: [
            { id: "cliente-publico", nombre: "Público en general", tipo: "general" },
          ],
          error: null,
        }));
      }

      if (table === "inventario_bodega_cdmx") {
        return buildQuery(async (steps) => {
          const eqPresentacion = steps.find((step) => step.startsWith("eq:presentacion_id:"));

          if (eqPresentacion) {
            return {
              data: [
                { id: "inv-1", cantidad_disponible: 2, precio_base: 120 },
                { id: "inv-2", cantidad_disponible: 1, precio_base: 125 },
              ],
              error: null,
            };
          }

          return {
            data: inventarioFixture,
            error: null,
          };
        });
      }

      if (table === "ventas") {
        return buildQuery(async () => ({
          data: {
            id: "venta-1",
            numero_venta: "POS-001",
            total: 180,
            created_at: "2026-03-13T12:00:00.000Z",
          },
          error: null,
        }));
      }

      throw new Error(`Tabla no mockeada: ${table}`);
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: vi.fn(),
  },
}));

describe("useVentas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presentacionesFixture = [
      {
        id: "pres-1",
        nombre: "Limon 18 kg",
        peso_kg: 18,
        tipo: "exportacion",
        activa: true,
      },
    ];
    inventarioFixture = [
      {
        id: "inv-1",
        cantidad_disponible: 3,
        precio_venta: 180,
        presentacion_id: "pres-1",
        presentacion: {
          id: "pres-1",
          nombre: "Limon 18 kg",
          peso_kg: 18,
          tipo: "exportacion",
          activa: true,
        },
      },
    ];
  });

  it("fusiona stock con productos y usa fallback del RPC sin cliente cuando la firma nueva no existe", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.procesar_venta_cdmx",
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            success: true,
            venta_id: "venta-1",
            mensaje: "Venta OK",
          },
        ],
        error: null,
      });

    const { result } = renderHook(() => useVentas());

    await waitFor(() => {
      expect(result.current.productos).toHaveLength(1);
      expect(result.current.clientes).toHaveLength(1);
      expect(result.current.stock["pres-1"]).toBe(3);
      expect(result.current.productos[0].precio_sugerido).toBe(180);
    });

    await act(async () => {
      result.current.agregarAlCarrito(result.current.productos[0]);
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].precio_venta).toBe(180);

    let venta;
    await act(async () => {
      venta = await result.current.cobrar(null, 180, "efectivo");
    });

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0][0]).toBe("procesar_venta_cdmx");
    expect(rpcMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        p_cliente_id: "cliente-publico",
        p_metodo_pago: "efectivo",
        p_monto_total: 180,
      }),
    );
    expect(rpcMock.mock.calls[1][1]).toEqual(
      expect.not.objectContaining({
        p_cliente_id: expect.anything(),
      }),
    );

    expect(venta).toEqual(
      expect.objectContaining({
        id: "venta-1",
        numero_venta: "POS-001",
      }),
    );

    await waitFor(() => {
      expect(result.current.carrito).toHaveLength(0);
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("Venta registrada correctamente", {
      description: "Ticket #POS-001",
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("incluye producto granel desde inventario aunque no venga en el catalogo base", async () => {
    presentacionesFixture = [
      {
        id: "pres-1",
        nombre: "Limon 18 kg",
        peso_kg: 18,
        tipo: "exportacion",
        activa: true,
      },
    ];
    inventarioFixture = [
      {
        id: "inv-granel-1",
        cantidad_disponible: 15,
        precio_venta: 42,
        presentacion_id: "pres-granel-1",
        presentacion: {
          id: "pres-granel-1",
          nombre: "Granel mostrador - Caja Reja 20 kg",
          peso_kg: 1,
          tipo: "granel",
          activa: true,
        },
      },
    ];

    const { result } = renderHook(() => useVentas());

    await waitFor(() => {
      expect(result.current.productos.length).toBeGreaterThan(0);
    });

    const productoGranel = result.current.productos.find((producto) =>
      producto.nombre.includes("a granel"),
    );

    expect(productoGranel).toEqual(
      expect.objectContaining({
        id: "pres-granel-1",
        nombre: "Limon a granel",
        tipo: "granel",
        peso_kg: 1,
        precio_sugerido: 42,
      }),
    );
    expect(result.current.stock["pres-granel-1"]).toBe(15);
  });
});
