import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

/**
 * Supabase simulado. `from()` devuelve un constructor encadenable y
 * "thenable", igual que el cliente real, para poder ejercitar tanto
 * `await builder` como `builder.select().single()`.
 */
const h = vi.hoisted(() => {
  const insertCalls: Array<{ tabla: string; payload: unknown }> = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  let rpcImpl: ((fn: string, args: unknown) => unknown) | null = null;
  let respuestas: Record<string, { data: unknown; error: unknown }> = {};
  let insertQueue: Record<string, Array<{ data?: unknown; error?: unknown }>> =
    {};

  const construir = (tabla: string) => {
    let respuesta = respuestas[tabla] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    builder.select = chain;
    builder.eq = chain;
    builder.order = chain;
    builder.gt = chain;
    builder.limit = chain;
    builder.insert = (payload: unknown) => {
      insertCalls.push({ tabla, payload });
      const cola = insertQueue[tabla];
      if (cola && cola.length > 0) {
        const siguiente = cola.shift() ?? {};
        respuesta = { data: null, error: null, ...siguiente };
      }
      return builder;
    };
    builder.single = () => Promise.resolve(respuesta);
    builder.maybeSingle = () => Promise.resolve(respuesta);
    builder.then = (onOk: unknown, onErr: unknown) =>
      Promise.resolve(respuesta).then(
        onOk as (valor: unknown) => unknown,
        onErr as (motivo: unknown) => unknown
      );

    return builder;
  };

  return {
    insertCalls,
    rpcCalls,
    reiniciar() {
      insertCalls.length = 0;
      rpcCalls.length = 0;
      rpcImpl = null;
      respuestas = {};
      insertQueue = {};
    },
    setRpc(impl: (fn: string, args: unknown) => unknown) {
      rpcImpl = impl;
    },
    setRespuesta(tabla: string, valor: { data: unknown; error: unknown }) {
      respuestas[tabla] = valor;
    },
    setInsertQueue(tabla: string, cola: Array<{ data?: unknown; error?: unknown }>) {
      insertQueue[tabla] = cola;
    },
    construir,
    rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      return rpcImpl
        ? rpcImpl(fn, args)
        : Promise.resolve({ data: null, error: null });
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabla: string) => h.construir(tabla),
    rpc: (fn: string, args: unknown) => h.rpc(fn, args),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
  },
}));

import { useRecepcion, type DatosRecepcion, type ResultadoRecepcion } from "./useRecepcion";

const datosBase: DatosRecepcion = {
  productor_id: "productor-1",
  huerto_id: "huerto-1",
  es_cosecha_propia: true,
  origen: "interno",
  peso_bruto: 10000,
  peso_tara: 3380,
  tara_rejas_kg: 180,
  precio_pactado_kg: 0,
  precio_caja_cortador: 100,
  costo_bascula: 50,
  bascula_forma_pago: "efectivo",
  cuota_maniobra_kg: 0.35,
  folio_fisico: "B-1029",
  variedad: "Limón Persa",
  chofer: "Juan Pérez",
  placas: "P12-AB-345",
  rejas: 12,
  peso_bruto_at: "2026-03-10T10:00:00.000Z",
  peso_tara_at: "2026-03-10T11:30:00.000Z",
  calidad_defectos: 12,
  estado_calidad: "observado",
  notas: "Fruta mojada",
  cortadores: [
    { id: "cortador-1", nombre: "Luis", cajas: 40 },
    { id: "cortador-2", nombre: "Mario", cajas: 0 },
  ],
};

const crearWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const respuestaRpcOk = {
  data: [
    {
      lote_id: "lote-1",
      folio_recepcion: "REC-2026-001",
      numero_lote: "L-000001-001",
      peso_neto: 6620,
      subtotal: 0,
      costo_bascula: 50,
      bascula_forma_pago: "efectivo",
      cuota_maniobra_total: 2317,
      total_liquidar: 0,
      saldo_pendiente_productor: 1500,
    },
  ],
  error: null,
};

describe("useRecepcion.guardarRecepcion", () => {
  beforeEach(() => {
    h.reiniciar();
    h.setRespuesta("huertos", { data: [], error: null });
    h.setRespuesta("cortadores", { data: [], error: null });
    h.setRespuesta("productores", { data: { nombre: "Productor Demo" }, error: null });
    h.setRespuesta("lotes", {
      data: { id: "lote-1", numero_lote: "L-000001-001", folio_recepcion: "REC-2026-001" },
      error: null,
    });
    h.setRespuesta("lote_cortadores", { data: null, error: null });
  });

  it("envía la recepción por la RPC con doble pesada, cuotas y cortadores", async () => {
    h.setRpc((fn) =>
      fn === "registrar_recepcion"
        ? respuestaRpcOk
        : { data: 1500, error: null }
    );

    const { result } = renderHook(() => useRecepcion(), {
      wrapper: crearWrapper(),
    });

    let respuesta: ResultadoRecepcion | undefined = undefined;

    await act(async () => {
      respuesta = await result.current.guardarRecepcion(datosBase);
    });

    const llamadaRpc = h.rpcCalls.find((c) => c.fn === "registrar_recepcion");
    expect(llamadaRpc).toBeDefined();

    const payload = (llamadaRpc?.args as { p_datos: Record<string, unknown> })
      .p_datos;

    expect(payload.peso_tara).toBe(3380);
    expect(payload.tara_rejas_kg).toBe(180);
    expect(payload.bascula_forma_pago).toBe("efectivo");
    expect(payload.cuota_maniobra_kg).toBe(0.35);
    expect(payload.es_cosecha_propia).toBe(true);
    expect(payload.estado_calidad).toBe("observado");
    expect(payload.rejas).toBe(12);
    // Solo se envían los cortadores con cajas capturadas.
    expect(payload.cortadores).toEqual([{ id: "cortador-1", cajas: 40 }]);
    // peso_neto es columna GENERATED: nunca debe viajar en el payload.
    expect(payload).not.toHaveProperty("peso_neto");

    expect(respuesta?.folio_recepcion).toBe("REC-2026-001");
    expect(respuesta?.total_liquidar).toBe(0);
    expect(respuesta?.productor_nombre).toBe("Productor Demo");
    expect(respuesta?.viaRespaldo).toBe(false);
  });

  it("reintenta con inserción directa cuando la RPC no está desplegada", async () => {
    h.setRpc(() => ({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.registrar_recepcion(p_datos) in the schema cache",
      },
    }));

    const { result } = renderHook(() => useRecepcion(), {
      wrapper: crearWrapper(),
    });

    await act(async () => {
      await result.current.guardarRecepcion(datosBase);
    });

    expect(h.insertCalls).toHaveLength(2);
    const [loteInsert, cortadoresInsert] = h.insertCalls;
    expect(loteInsert.tabla).toBe("lotes");

    const payloadLote = (loteInsert.payload as Record<string, unknown>[])[0];
    expect(payloadLote.peso_pagable).toBe(6620);
    expect(payloadLote.tara_rejas_kg).toBe(180);
    expect(payloadLote.bascula_forma_pago).toBe("efectivo");
    expect(payloadLote.cuota_maniobra_total).toBe(2317);
    // 40 cajas × $100 × 30%
    expect(payloadLote.pago_cortadores_total).toBe(1200);
    expect(payloadLote).not.toHaveProperty("peso_neto");

    expect(cortadoresInsert.tabla).toBe("lote_cortadores");
    expect(cortadoresInsert.payload).toEqual([
      { lote_id: "lote-1", cortador_id: "cortador-1", cajas_recolectadas: 40 },
    ]);

    await waitFor(() => {
      expect(result.current.aviso).toContain("registrar_recepcion");
    });
  });

  it("cae al esquema original si las columnas nuevas tampoco existen", async () => {
    h.setRpc(() => ({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    }));
    h.setInsertQueue("lotes", [
      {
        error: {
          code: "PGRST204",
          message:
            "Could not find the 'tara_rejas_kg' column of 'lotes' in the schema cache",
        },
      },
    ]);

    const { result } = renderHook(() => useRecepcion(), {
      wrapper: crearWrapper(),
    });

    await act(async () => {
      await result.current.guardarRecepcion(datosBase);
    });

    const insertsLote = h.insertCalls.filter((c) => c.tabla === "lotes");
    expect(insertsLote).toHaveLength(2);

    const respaldo = (insertsLote[1].payload as Record<string, unknown>[])[0];
    expect(respaldo).not.toHaveProperty("tara_rejas_kg");
    expect(respaldo).not.toHaveProperty("folio_recepcion");
    expect(respaldo).not.toHaveProperty("peso_neto");
    // El esquema original conserva lo esencial del negocio.
    expect(respaldo.productor_id).toBe("productor-1");
    expect(respaldo.huerto_id).toBe("huerto-1");
    expect(respaldo.es_cosecha_propia).toBe(true);
    expect(respaldo.peso_pagable).toBe(6620);
  });

  it("no toca la base cuando la validación local falla", async () => {
    const { result } = renderHook(() => useRecepcion(), {
      wrapper: crearWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.guardarRecepcion({
          ...datosBase,
          peso_bruto: 3000,
          peso_tara: 3380,
        });
      })
    ).rejects.toThrow(/tara no puede ser mayor o igual/i);

    expect(h.rpcCalls).toHaveLength(0);
    expect(h.insertCalls).toHaveLength(0);
  });
});
