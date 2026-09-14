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

vi.mock("@/hooks/useProductores", () => ({
  useProductores: () => ({
    productores: [
      { id: "productor-1", nombre: "Citrícola del Valle", telefono: "3121234567", saldo_pendiente: 1200 },
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
      { id: "huerto-1", nombre: "Huerto La Esperanza", ubicacion: "Pedernales", hectareas: 12 },
    ],
    cortadores: [{ id: "cortador-1", nombre: "Luis Cortador", telefono: null, activo: true }],
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
          precio: 5,
          kilos: 900,
          variedad: "Limón Persa",
        },
      ],
      ultimo: 5,
      promedio: 5,
      maximo: 5,
      minimo: 5,
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

describe("Recepción flow", () => {
  beforeEach(() => {
    toastError.mockClear();
    toastSuccess.mockClear();
    guardarRecepcion.mockReset();
  });

  it("muestra el asistente de 4 pasos con su panel de liquidación", () => {
    renderPagina();

    expect(screen.getByText("Origen y transporte")).toBeInTheDocument();
    expect(screen.getByText("Pesaje (doble pesada)")).toBeInTheDocument();
    expect(screen.getByText("Calidad y comercial")).toBeInTheDocument();
    expect(screen.getByText("Revisión y confirmación")).toBeInTheDocument();

    expect(screen.getByText(/Resumen de liquidación/i)).toBeInTheDocument();
    expect(screen.getAllByText("REC-2026-007").length).toBeGreaterThan(0);
    expect(screen.getByText(/Cierre de la recepción/i)).toBeInTheDocument();
    expect(screen.getByText(/Boleta y ticket térmico/i)).toBeInTheDocument();
  });

  it("no permite avanzar al paso 2 sin productor ni variedad", () => {
    renderPagina();

    fireEvent.click(screen.getByRole("button", { name: /^continuar$/i }));

    expect(toastError).toHaveBeenCalledWith(
      "Faltan datos en este paso",
      expect.objectContaining({ description: expect.stringMatching(/productor/i) })
    );
    expect(screen.queryByText(/Pesaje de báscula/i)).not.toBeInTheDocument();
  });

  it("marca los requisitos faltantes en el checklist de cierre", () => {
    renderPagina();

    expect(
      screen.getByText(/Faltan \d+ dato\(s\) obligatorio\(s\) para poder confirmar/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/Productor identificado/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Variedad de la fruta/i).length).toBeGreaterThan(0);
  });

  it("recorre los 4 pasos y envía el lote con doble pesada y cuota de báscula", async () => {
    guardarRecepcion.mockResolvedValue({
      id: "lote-9",
      numero_lote: "L-000009-001",
      folio_recepcion: "REC-2026-008",
      peso_neto: 6620,
      total_liquidar: 33100,
      productor_nombre: "Citrícola del Valle",
      viaRespaldo: false,
    });

    renderPagina();

    // --- Paso 1: origen y transporte ---
    abrirSelect(/seleccionar productor/i);
    await elegirOpcion(/Citrícola del Valle/i);

    abrirSelect(/variedad de la fruta/i);
    await elegirOpcion(/Limón Persa/i);

    fireEvent.change(screen.getByLabelText(/rejas \/ huacales/i), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continuar$/i }));

    // --- Paso 2: doble pesada ---
    expect(await screen.findByText(/Pesaje de báscula/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/peso bruto \(kg\)/i), {
      target: { value: "10000" },
    });
    fireEvent.change(screen.getByLabelText(/tara del vehículo/i), {
      target: { value: "3200" },
    });
    fireEvent.change(screen.getByLabelText(/tara de rejas/i), {
      target: { value: "180" },
    });
    expect(screen.getAllByText(/6,620\.00 kg/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^continuar$/i }));

    // --- Paso 3: calidad y comercial ---
    expect(
      await screen.findByText(/Calidad y parámetros comerciales/i)
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/precio por kilo pactado/i), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continuar$/i }));

    // --- Paso 4: revisión y confirmación ---
    expect(await screen.findByText(/Revisión final del lote/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /confirmar ingreso del lote/i })
    );

    await waitFor(() => expect(guardarRecepcion).toHaveBeenCalledTimes(1));

    const enviado = guardarRecepcion.mock.calls[0][0];
    expect(enviado.productor_id).toBe("productor-1");
    expect(enviado.peso_bruto).toBe(10000);
    expect(enviado.peso_tara).toBe(3380);
    expect(enviado.tara_rejas_kg).toBe(180);
    expect(enviado.precio_pactado_kg).toBe(5);
    expect(enviado.variedad).toBe("Limón Persa");
    expect(enviado.rejas).toBe(12);
    expect(enviado.costo_bascula).toBe(50);
    expect(enviado.bascula_forma_pago).toBe("liquidacion");
    expect(enviado.cuota_maniobra_kg).toBe(0);
    expect(enviado.es_cosecha_propia).toBe(false);
    expect(enviado.estado_calidad).toBe("aceptado");
    expect(enviado).not.toHaveProperty("peso_neto");

    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/L-000009-001/),
      expect.anything()
    );
  }, 20000);
});
