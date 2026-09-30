import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const guardarRecepcion = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/recepcion/NuevoProductorDialog", () => ({
  NuevoProductorDialog: () => <button type="button">Nuevo productor</button>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "carlos.barragan@jbm.com.mx" } }),
}));

vi.mock("@/hooks/useProductores", () => ({
  useProductores: () => ({
    productores: [
      {
        id: "productor-1",
        nombre: "Citrícola del Valle",
        telefono: "3121234567",
        saldo_pendiente: 1200,
      },
    ],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useRecepcion", () => ({
  useRecepcion: () => ({
    guardarRecepcion,
    huertos: [
      {
        id: "huerto-1",
        nombre: "Huerto La Esperanza",
        ubicacion: "Pedernales",
        hectareas: 12,
      },
    ],
    cortadores: [
      { id: "cortador-1", nombre: "Luis Cortador", telefono: null, activo: true },
    ],
    loading: false,
    error: null,
    aviso: null,
    limpiarAviso: vi.fn(),
  }),
  useHistorialPreciosProductor: () => ({
    data: {
      precios: [
        {
          folio: "REC-2026-002",
          fecha: "2026-03-05T10:00:00.000Z",
          precio: 18,
          kilos: 900,
          variedad: "Limón Mexicano",
        },
      ],
      ultimo: 18,
      promedio: 18,
      maximo: 18,
      minimo: 18,
      variacionPct: 0,
      lotesRegistrados: 1,
    },
    isFetching: false,
  }),
  useFolioRecepcionPreview: () => ({ data: "REC-2026-007" }),
  useFolioFisicoDuplicado: () => ({ data: null }),
}));

import Recepcion from "./Recepcion";

const renderPagina = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Recepcion />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

/** Abre un Select de Radix por el nombre accesible de su disparador. */
const abrirSelect = (nombre: RegExp) => {
  const disparador = screen.getByRole("combobox", { name: nombre });
  fireEvent.pointerDown(disparador, { button: 0, ctrlKey: false });
  fireEvent.click(disparador);
};

/** Elige una opción del Select abierto (Radix selecciona en pointerDown). */
const elegirOpcion = async (nombre: RegExp) => {
  const opcion = await screen.findByRole("option", { name: nombre });
  fireEvent.pointerDown(opcion, { button: 0 });
  fireEvent.pointerUp(opcion, { button: 0 });
  fireEvent.click(opcion);
};

const llenarPesaje = (bruto: string, tara: string, precio: string) => {
  fireEvent.change(screen.getByLabelText(/bruto \(kg\)/i), {
    target: { value: bruto },
  });
  fireEvent.change(screen.getByLabelText(/tara \(kg\)/i), {
    target: { value: tara },
  });
  fireEvent.change(screen.getByLabelText(/precio por kilo/i), {
    target: { value: precio },
  });
};

describe("Recepción flow", () => {
  beforeEach(() => {
    toastError.mockClear();
    toastSuccess.mockClear();
    guardarRecepcion.mockReset();
    window.print = vi.fn();
    localStorage.clear();
  });

  it("presenta el flujo de captura completo en una sola pantalla", () => {
    renderPagina();

    expect(screen.getByText(/Origen y control de entrada/i)).toBeInTheDocument();
    expect(screen.getByText(/Pesaje de báscula \(kg\)/i)).toBeInTheDocument();
    expect(screen.getByText("Báscula Camionera #1")).toBeInTheDocument();
    expect(screen.getByText(/Calidad de campo/i)).toBeInTheDocument();
    expect(screen.getByText(/Cuota de báscula \(cobro al productor\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Cargos adicionales por kilo recibido/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Resumen en tiempo real de liquidación/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Operador de báscula/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Vista previa exacta del ticket/i)).toBeInTheDocument();

    // La variedad es un dato fijo de la zona, ya no se elige.
    expect(screen.getAllByText("Limón Mexicano").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("combobox", { name: /variedad de la fruta/i })
    ).not.toBeInTheDocument();
  });

  it("no muestra el huerto en compra a terceros y sí en cosecha propia", () => {
    renderPagina();

    expect(
      screen.queryByRole("combobox", { name: /huerto de procedencia/i })
    ).not.toBeInTheDocument();

    // Radix Tabs activa la pestaña en mouseDown (modo automático).
    const pestana = screen.getByRole("tab", { name: /cosecha propia/i });
    fireEvent.mouseDown(pestana);
    fireEvent.click(pestana);

    expect(
      screen.getByRole("combobox", { name: /huerto de procedencia/i })
    ).toBeInTheDocument();
  });

  it("ya no captura chofer, placas ni rejas", () => {
    renderPagina();

    expect(
      screen.queryByRole("textbox", { name: /chofer/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /placas/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /rejas/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Transporte y trazabilidad del embarque/i)
    ).not.toBeInTheDocument();
  });

  it("calcula la liquidación en tiempo real como el ejemplo operativo", () => {
    renderPagina();

    llenarPesaje("14500", "4200", "18.50");

    // 14500 - 4200 = 10,300 kg
    expect(screen.getByTestId("peso-neto")).toHaveTextContent("10,300.00");
    // 10,300 × 18.50
    expect(screen.getByTestId("subtotal-fruta")).toHaveTextContent("$190,550.00");
    expect(screen.getByTestId("resumen-fruta")).toHaveTextContent("$190,550.00");
    // 10,300 × 0.40 = 4,120 + 50 de báscula (también aparece en el ticket)
    expect(screen.getAllByText("- $4,170.00").length).toBeGreaterThan(0);
    // 10,300 × 0.40
    expect(screen.getAllByText("- $4,120.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$18.10 / kg").length).toBeGreaterThan(0);
    // 190,550 - 4,170
    expect(screen.getByTestId("total-neto")).toHaveTextContent("$186,380.00");
  });

  it("bloquea el guardado y lista lo que falta", () => {
    renderPagina();

    const boton = screen.getByTestId("guardar-imprimir");
    expect(boton).toBeDisabled();
    expect(screen.getByText(/Captura el peso bruto/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Selecciona el productor al que se le compra la fruta/i)
    ).toBeInTheDocument();

    fireEvent.click(boton);
    expect(guardarRecepcion).not.toHaveBeenCalled();
  });

  it("guarda la boleta con el pesaje, las cuotas y el operador", async () => {
    guardarRecepcion.mockResolvedValue({
      id: "lote-9",
      numero_lote: "L-000009-001",
      folio_recepcion: "REC-2026-008",
      peso_neto: 10300,
      total_liquidar: 186380,
      productor_nombre: "Citrícola del Valle",
      viaRespaldo: false,
    });

    renderPagina();

    abrirSelect(/seleccionar productor/i);
    await elegirOpcion(/Citrícola del Valle/i);

    fireEvent.change(screen.getByLabelText(/folio del ticket físico/i), {
      target: { value: "B-10293" },
    });

    llenarPesaje("14500", "4200", "18.5");

    // El operador se sugiere desde la sesión.
    const operador = screen.getByLabelText(/operador de báscula/i);
    expect(operador).toHaveValue("Carlos Barragan");

    fireEvent.click(screen.getByTestId("guardar-imprimir"));

    await waitFor(() => expect(guardarRecepcion).toHaveBeenCalledTimes(1));

    const enviado = guardarRecepcion.mock.calls[0][0];
    expect(enviado.productor_id).toBe("productor-1");
    expect(enviado.huerto_id).toBeNull();
    expect(enviado.peso_bruto).toBe(14500);
    expect(enviado.peso_tara).toBe(4200);
    expect(enviado.precio_pactado_kg).toBe(18.5);
    expect(enviado.costo_bascula).toBe(50);
    expect(enviado.bascula_forma_pago).toBe("liquidacion");
    expect(enviado.cuota_maniobra_kg).toBe(0.4);
    expect(enviado.cuota_maniobra_concepto).toBe(
      "Servicios operativos y maniobra"
    );
    expect(enviado.operador_bascula).toBe("Carlos Barragan");
    expect(enviado.variedad).toBe("Limón Mexicano");
    expect(enviado.folio_fisico).toBe("B-10293");
    expect(enviado.es_cosecha_propia).toBe(false);
    expect(enviado.origen).toBe("externo");
    expect(enviado.estado_calidad).toBe("aceptado");
    expect(enviado.cortadores).toEqual([]);
    expect(enviado).not.toHaveProperty("chofer");
    expect(enviado).not.toHaveProperty("placas");
    expect(enviado).not.toHaveProperty("rejas");
    expect(enviado).not.toHaveProperty("peso_neto");

    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/L-000009-001/),
      expect.anything()
    );

    // El lote queda disponible para producción.
    await waitFor(() => {
      expect(
        screen.getByText(/registrado y disponible en producción/i)
      ).toBeInTheDocument();
    });
  }, 20000);
});
