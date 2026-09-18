import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  calcularHistorialPrecios,
  redondear2,
  type FormaPagoBascula,
  type HistorialPrecios,
  type PrecioHistorico,
} from "@/lib/recepcion/calculos";

export type {
  FormaPagoBascula,
  HistorialPrecios,
  PrecioHistorico,
};

export { calcularHistorialPrecios };

type Huerto = Database["public"]["Tables"]["huertos"]["Row"];
type Cortador = Database["public"]["Tables"]["cortadores"]["Row"];
type LoteInsert = Database["public"]["Tables"]["lotes"]["Insert"];
type ErrorLike = { code?: string; message?: string; details?: string };

export interface CortadorDelLote {
  id: string;
  nombre: string;
  cajas: number;
}

export interface DatosRecepcion {
  productor_id: string;
  /** Solo aplica a cosecha propia. */
  huerto_id?: string | null;
  es_cosecha_propia?: boolean;
  origen?: string;
  /** Peso del camión cargado (primera pesada). */
  peso_bruto: number;
  /** Tara del vehículo vacío (segunda pesada). */
  peso_tara: number;
  precio_pactado_kg: number;
  precio_caja_cortador?: number;
  zona_asignada?: string;
  costo_bascula: number;
  bascula_forma_pago?: FormaPagoBascula;
  cuota_maniobra_kg?: number;
  cuota_maniobra_concepto?: string;
  operador_bascula?: string;
  folio_fisico?: string;
  numero_lote?: string;
  variedad?: string | null;
  calidad_defectos?: number;
  estado_calidad?: string;
  notas?: string;
  cortadores?: CortadorDelLote[];
}

export interface ResultadoRecepcion {
  id: string;
  numero_lote: string;
  folio_recepcion: string | null;
  peso_neto: number;
  total_liquidar: number;
  productor_nombre: string | null;
  /** true cuando se guardó con la ruta de respaldo (sin RPC). */
  viaRespaldo: boolean;
}

const MENSAJE_RPC_FALTANTE =
  "La función registrar_recepcion todavía no está desplegada en Supabase: se guardó con la ruta de respaldo. Aplica la migración 20260813090000 para habilitar folio consecutivo, cortadores y cuotas.";

const leerError = (error: unknown): ErrorLike => {
  if (!error || typeof error !== "object") return {};
  const e = error as ErrorLike;
  return {
    code: e.code,
    message: typeof e.message === "string" ? e.message : "",
    details: typeof e.details === "string" ? e.details : "",
  };
};

const esRpcNoDisponible = (error: unknown): boolean => {
  const { code, message } = leerError(error);
  return (
    code === "PGRST202" ||
    code === "404" ||
    message.includes("Could not find the function")
  );
};

const esColumnaNoDisponible = (error: unknown): boolean => {
  const { code, message } = leerError(error);
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("Could not find the '") ||
    (message.includes("column") && message.includes("does not exist"))
  );
};

const esNoAutorizado = (error: unknown): boolean => {
  const { code, message } = leerError(error);
  return code === "42501" || message.includes("No autorizado");
};

const generarNumeroLote = (): string =>
  `L-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;

const mensajeDeError = (error: unknown): string => {
  const { message } = leerError(error);
  return message || "Error desconocido";
};

/** Últimos precios pactados con un productor, tomados de sus lotes reales. */
export function useHistorialPreciosProductor(
  productorId: string | null | undefined,
  limite = 5
) {
  return useQuery({
    queryKey: ["recepcion", "historial-precios", productorId, limite],
    enabled: Boolean(productorId),
    staleTime: 1000 * 60,
    queryFn: async (): Promise<HistorialPrecios> => {
      const { data, error } = await supabase
        .from("lotes")
        .select("folio_recepcion, fecha_recepcion, precio_pactado_kg, peso_neto, variedad")
        .eq("productor_id", productorId as string)
        .gt("precio_pactado_kg", 0)
        .order("fecha_recepcion", { ascending: false })
        .limit(limite);

      if (error) throw error;

      return calcularHistorialPrecios(
        (data ?? []).map((fila) => ({
          folio: fila.folio_recepcion ?? null,
          fecha: fila.fecha_recepcion,
          precio: Number(fila.precio_pactado_kg ?? 0),
          kilos: Number(fila.peso_neto ?? 0),
          variedad: fila.variedad ?? null,
        }))
      );
    },
  });
}

/** Avisa si el folio físico de báscula ya fue capturado en otro lote. */
export function useFolioFisicoDuplicado(folio: string | null | undefined) {
  const limpio = (folio ?? "").trim();

  return useQuery({
    queryKey: ["recepcion", "folio-duplicado", limpio],
    enabled: limpio.length >= 3,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("id, numero_lote, folio_recepcion, fecha_recepcion")
        .eq("folio_fisico", limpio)
        .order("fecha_recepcion", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useRecepcion() {
  const [loadingGuardar, setLoadingGuardar] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [avisoGuardar, setAvisoGuardar] = useState<string | null>(null);

  const { data: huertos = [] } = useQuery({
    queryKey: ["huertos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huertos")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as Huerto[];
    },
  });

  const { data: cortadores = [] } = useQuery({
    queryKey: ["cortadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cortadores")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as Cortador[];
    },
  });

  const obtenerCostoBasculaConfigurado = useCallback(async (): Promise<number> => 50, []);

  /**
   * Alta de la recepción.
   *
   * 1. Ruta preferida: RPC `registrar_recepcion` (atómica: lote +
   *    cortadores + recálculo de CxP, y asigna folio consecutivo).
   * 2. Si la RPC no está desplegada, inserta directo con las columnas
   *    nuevas.
   * 3. Si las columnas nuevas tampoco existen, inserta con el esquema
   *    original para no bloquear la operación.
   *
   * `peso_neto` nunca se envía: en la base es una columna GENERATED
   * (peso_bruto - peso_tara).
   */
  const guardarRecepcion = useCallback(
    async (datos: DatosRecepcion): Promise<ResultadoRecepcion> => {
      setLoadingGuardar(true);
      setErrorGuardar(null);
      setAvisoGuardar(null);

      try {
        if (!datos.productor_id) throw new Error("Selecciona un productor");
        if (!datos.peso_bruto || datos.peso_bruto <= 0)
          throw new Error("El peso bruto debe ser mayor a cero");
        if (datos.peso_tara >= datos.peso_bruto)
          throw new Error("La tara no puede ser mayor o igual al peso bruto");
        if (datos.es_cosecha_propia && !datos.huerto_id)
          throw new Error("La cosecha propia requiere un huerto de origen");

        const numeroLote = datos.numero_lote || generarNumeroLote();
        const pesoNeto = redondear2(datos.peso_bruto - datos.peso_tara);
        const maniobraTotal = redondear2(
          pesoNeto * (datos.cuota_maniobra_kg ?? 0)
        );
        const basculaDescontada =
          (datos.bascula_forma_pago ?? "liquidacion") === "liquidacion"
            ? datos.costo_bascula
            : 0;
        const totalLiquidar = Math.max(
          0,
          redondear2(
            redondear2(pesoNeto * datos.precio_pactado_kg) -
              basculaDescontada -
              maniobraTotal
          )
        );

        const cortadores = (datos.cortadores ?? []).filter(
          (c) => Number(c.cajas) > 0
        );
        const pagoCortadores = redondear2(
          cortadores.reduce(
            (acc, c) => acc + Number(c.cajas) * (datos.precio_caja_cortador ?? 0) * 0.3,
            0
          )
        );

        const productorNombre = await obtenerNombreProductor(datos.productor_id);

        // ---------- 1) RPC transaccional ----------
        const payload: Json = {
          productor_id: datos.productor_id,
          huerto_id: datos.huerto_id ?? null,
          es_cosecha_propia: Boolean(datos.es_cosecha_propia),
          origen: datos.origen ?? (datos.es_cosecha_propia ? "interno" : "externo"),
          peso_bruto: datos.peso_bruto,
          peso_tara: datos.peso_tara,
          precio_pactado_kg: datos.precio_pactado_kg,
          precio_caja_cortador: datos.precio_caja_cortador ?? 0,
          zona_asignada: datos.zona_asignada ?? "linea_produccion",
          costo_bascula: datos.costo_bascula,
          bascula_forma_pago: datos.bascula_forma_pago ?? "liquidacion",
          cuota_maniobra_kg: datos.cuota_maniobra_kg ?? 0,
          cuota_maniobra_concepto: datos.cuota_maniobra_concepto ?? "",
          operador_bascula: datos.operador_bascula ?? "",
          folio_fisico: datos.folio_fisico ?? "",
          numero_lote: numeroLote,
          variedad: datos.variedad ?? null,
          calidad_defectos: datos.calidad_defectos ?? 0,
          estado_calidad: datos.estado_calidad ?? "aceptado",
          notas: datos.notas ?? "",
          cortadores: cortadores.map((c) => ({ id: c.id, cajas: Number(c.cajas) })),
        };

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "registrar_recepcion",
          { p_datos: payload }
        );

        if (!rpcError) {
          const fila = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          if (!fila) throw new Error("La recepción no devolvió el lote creado");

          return {
            id: fila.lote_id,
            numero_lote: fila.numero_lote,
            folio_recepcion: fila.folio_recepcion,
            peso_neto: Number(fila.peso_neto),
            total_liquidar: Number(fila.total_liquidar),
            productor_nombre: productorNombre,
            viaRespaldo: false,
          };
        }

        if (!esRpcNoDisponible(rpcError)) throw rpcError;

        setAvisoGuardar(MENSAJE_RPC_FALTANTE);

        // ---------- 2) Inserción directa con columnas nuevas ----------
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const base = {
          productor_id: datos.productor_id,
          huerto_id: datos.huerto_id ?? null,
          es_cosecha_propia: Boolean(datos.es_cosecha_propia),
          peso_bruto: datos.peso_bruto,
          peso_tara: datos.peso_tara,
          precio_pactado_kg: datos.precio_pactado_kg || 0,
          zona_asignada: datos.zona_asignada ?? "linea_produccion",
          costo_bascula: datos.costo_bascula || 0,
          folio_fisico: datos.folio_fisico || "",
          calidad_defectos: datos.calidad_defectos || 0,
          origen: datos.origen ?? (datos.es_cosecha_propia ? "interno" : "externo"),
          estado_calidad: datos.estado_calidad || "aceptado",
          notas: datos.notas || "",
          peso_pagable: pesoNeto,
          kilos_merma: redondear2(
            pesoNeto * ((datos.calidad_defectos ?? 0) / 100)
          ),
          numero_lote: numeroLote,
          fecha_recepcion: new Date().toISOString(),
          estado: "pendiente" as const,
          usuario_id: user?.id ?? null,
        };

        const completo: LoteInsert = {
          ...base,
          variedad: datos.variedad ?? null,
          bascula_forma_pago: datos.bascula_forma_pago ?? "liquidacion",
          cuota_maniobra_kg: datos.cuota_maniobra_kg ?? 0,
          cuota_maniobra_total: maniobraTotal,
          operador_bascula: datos.operador_bascula ?? null,
          precio_caja_cortador: datos.precio_caja_cortador ?? 0,
          pago_cortadores_total: pagoCortadores,
        };

        let { data: lote, error: insertError } = await supabase
          .from("lotes")
          .insert([completo])
          .select("id, numero_lote, folio_recepcion")
          .single();

        // ---------- 3) Respaldo con el esquema original ----------
        if (insertError && esColumnaNoDisponible(insertError)) {
          console.warn(
            "Columnas nuevas de recepción ausentes; se guarda con el esquema original",
            insertError
          );
          setAvisoGuardar(
            "Se guardó con el esquema original de la base: aplica la migración 20260813090000 para habilitar folio consecutivo, cuotas y cortadores."
          );

          // No se puede pedir folio_recepcion en el select: la columna
          // es justamente la que no existe en este escenario.
          const reintento = await supabase
            .from("lotes")
            .insert([base])
            .select("id, numero_lote")
            .single();

          lote = reintento.data
            ? { ...reintento.data, folio_recepcion: null }
            : null;
          insertError = reintento.error;
        }

        if (insertError) throw insertError;
        if (!lote) throw new Error("No se pudo registrar el lote");

        // Cortadores: en lote_cortadores solo admin/produccion tienen INSERT.
        if (cortadores.length > 0) {
          const { error: cortadoresError } = await supabase
            .from("lote_cortadores")
            .insert(
              cortadores.map((c) => ({
                lote_id: lote.id,
                cortador_id: c.id,
                cajas_recolectadas: Math.trunc(Number(c.cajas)),
              }))
            );

          if (cortadoresError) {
            console.warn("No se pudieron registrar los cortadores", cortadoresError);
            if (esNoAutorizado(cortadoresError)) {
              setAvisoGuardar(
                "El lote se guardó, pero tu rol no puede registrar cortadores. Pide a un administrador que aplique la migración 20260813090000."
              );
            }
          }
        }

        const { error: errorSyncCxp } = await supabase.rpc(
          "sync_productor_saldo_pendiente",
          { p_productor_id: datos.productor_id }
        );

        if (errorSyncCxp) {
          console.warn(
            "sync_productor_saldo_pendiente no disponible; la CxP se recalculará en backend",
            errorSyncCxp
          );
        }

        return {
          id: lote.id,
          numero_lote: lote.numero_lote,
          folio_recepcion: lote.folio_recepcion ?? null,
          peso_neto: pesoNeto,
          total_liquidar: totalLiquidar,
          productor_nombre: productorNombre,
          viaRespaldo: true,
        };
      } catch (err: unknown) {
        setErrorGuardar(mensajeDeError(err));
        throw err;
      } finally {
        setLoadingGuardar(false);
      }
    },
    []
  );

  const limpiarAviso = useCallback(() => setAvisoGuardar(null), []);

  return {
    guardarRecepcion,
    obtenerCostoBasculaConfigurado,
    huertos,
    cortadores,
    loading: loadingGuardar,
    error: errorGuardar,
    aviso: avisoGuardar,
    limpiarAviso,
  };
}

async function obtenerNombreProductor(
  productorId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("productores")
    .select("nombre")
    .eq("id", productorId)
    .maybeSingle();

  if (error) {
    console.warn("No se pudo obtener el nombre del productor", error);
    return null;
  }

  return data?.nombre ?? null;
}

/** Siguiente folio consecutivo oficial (REC-YYYY-NNN). */
export function useFolioRecepcionPreview() {
  const anio = new Date().getFullYear();

  return useQuery({
    queryKey: ["recepcion", "folio-preview", anio],
    staleTime: 1000 * 20,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("siguiente_folio_recepcion");

      if (error) {
        if (esRpcNoDisponible(error)) return null;
        throw error;
      }

      return data ?? null;
    },
  });
}
