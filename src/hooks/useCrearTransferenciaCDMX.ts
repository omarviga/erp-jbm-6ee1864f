import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ALLOW_INVENTORY_FALLBACK = String(import.meta.env.VITE_ALLOW_INVENTORY_FALLBACK).toLowerCase() === "true";

const buildRpcErrorMessage = (error: { message?: string; details?: string; hint?: string; code?: string } | null) => {
  if (!error) return "Error desconocido";
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  const base = parts.length > 0 ? parts.join(" | ") : "Error desconocido";
  return error.code ? `${base} (code: ${error.code})` : base;
};

const isMissingFunctionError = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  return error.code === "PGRST202" || (error.message || "").includes("Could not find the function");
};

const safeInsertKardex = async (payload: {
  lote_id: string;
  tipo_movimiento: "envio_cdmx";
  cantidad: number;
  ubicacion_origen: string;
  ubicacion_destino: string;
  usuario_id: string;
}) => {
  try {
    const { error } = await (supabase as any).from("inventario_kardex").insert(payload);
    if (error) console.warn("Kardex fallback insert skipped:", error.message);
  } catch {
    // silently skip
  }
};

export interface ItemTransferencia {
  id: string;
  origen_inventario: "camara_fria" | "piso_empaque" | "transporte_directo";
  produccion_id: string;
  lote_id: string;
  presentacion_id: string;
  presentacion_nombre: string;
  cantidad: number;
  cantidad_disponible: number;
  peso_kg: number;
  cajas_produccion: number;
  calibre: string;
  calidad: string;
  lote_numero: string;
  descripcion: string;
}

export interface DatosTransferencia {
  chofer: string;
  placas: string;
  notas: string;
  items: ItemTransferencia[];
}

const calcularPrecioBaseCongelado = (item: ItemTransferencia) => {
  if (item.cantidad <= 0 || item.cajas_produccion <= 0 || item.peso_kg <= 0) return 0;
  const costoPorCaja = item.peso_kg / item.cajas_produccion;
  return Math.round(costoPorCaja * item.cantidad * 100) / 100;
};

export function useCrearTransferenciaCDMX() {
  const queryClient = useQueryClient();

  const { data: stockDisponible = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stock-para-transferencia"],
    queryFn: async () => {
      const { data: stockCamara, error: errorCamara } = await supabase
        .from("camara_fria")
        .select(`
          id,
          cantidad_disponible,
          produccion_id,
          produccion (
            lote_id,
            calibre,
            calidad,
            cantidad_cajas,
            peso_total_kg,
            presentacion_id,
            lotes (numero_lote),
            presentaciones:presentacion_id (id, nombre)
          )
        `)
        .gt("cantidad_disponible", 0);
      if (errorCamara) throw errorCamara;

      const { data: stockTransicion, error: errorTransicion } = await supabase
        .from("produccion")
        .select(`
          id,
          destino,
          lote_id,
          calibre,
          calidad,
          cantidad_cajas,
          peso_total_kg,
          presentacion_id,
          lotes (numero_lote),
          presentaciones:presentacion_id (id, nombre)
        `)
        .in("destino", ["piso_empaque", "transporte_directo"])
        .gt("cantidad_cajas", 0);
      if (errorTransicion) throw errorTransicion;

      const desdeCamara = (stockCamara || []).map((item) => {
        const prod = item.produccion as {
          lote_id?: string;
          calibre?: string;
          calidad?: string;
          cantidad_cajas?: number;
          peso_total_kg?: number;
          presentacion_id?: string;
          lotes?: { numero_lote?: string };
          presentaciones?: { id?: string; nombre?: string };
        };

        return {
          id: item.id,
          origen_inventario: "camara_fria" as const,
          produccion_id: item.produccion_id,
          lote_id: prod?.lote_id || "",
          presentacion_id: prod?.presentaciones?.id || prod?.presentacion_id || "",
          presentacion_nombre: prod?.presentaciones?.nombre || "Sin presentación",
          cantidad_disponible: item.cantidad_disponible,
          peso_kg: prod?.peso_total_kg || 0,
          cajas_produccion: prod?.cantidad_cajas || 0,
          calibre: prod?.calibre || "",
          calidad: prod?.calidad || "",
          lote_numero: prod?.lotes?.numero_lote || "N/A",
          descripcion: `Lote: ${prod?.lotes?.numero_lote || "N/A"} · Cámara Fría`,
        };
      });

      const desdeTransicion = (stockTransicion || []).map((item) => ({
        id: item.id,
        origen_inventario: item.destino as "piso_empaque" | "transporte_directo",
        produccion_id: item.id,
        lote_id: item.lote_id || "",
        presentacion_id: item.presentaciones?.id || item.presentacion_id || "",
        presentacion_nombre: item.presentaciones?.nombre || "Sin presentación",
        cantidad_disponible: item.cantidad_cajas,
        peso_kg: item.peso_total_kg || 0,
        cajas_produccion: item.cantidad_cajas || 0,
        calibre: item.calibre || "",
        calidad: item.calidad || "",
        lote_numero: item.lotes?.numero_lote || "N/A",
        descripcion: `Lote: ${item.lotes?.numero_lote || "N/A"} · ${item.destino === "piso_empaque" ? "Piso Empaque" : "Directo a Transporte"}`,
      }));

      return [...desdeCamara, ...desdeTransicion];
    },
  });

  const { data: stockMolino = [], isLoading: loadingMolino } = useQuery({
    queryKey: ["stock-molino-transferencia"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_molino").select(`*, lotes (numero_lote)`).gt("peso_disponible", 0);
      if (error) throw error;
      return data || [];
    },
  });

  const crearTransferencia = useMutation({
    mutationFn: async (datos: DatosTransferencia) => {
      if (datos.items.length === 0) throw new Error("Selecciona al menos un producto");
      if (!datos.chofer.trim()) throw new Error("Ingresa el nombre del chofer");

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user?.id) throw new Error("No se pudo identificar al usuario actual");

      const referenciaViaje = [
        `Chofer: ${datos.chofer.trim()}`,
        datos.placas.trim() ? `Placas: ${datos.placas.trim()}` : "",
        datos.notas.trim() ? `Notas: ${datos.notas.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" / ");

      for (const item of datos.items) {
        const precioBaseCongelado = calcularPrecioBaseCongelado(item);

        if (item.origen_inventario === "camara_fria") {
          const { error } = await supabase.rpc("registrar_envio_cdmx", {
            p_registro_camara_id: item.id,
            p_lote_id: item.lote_id,
            p_cantidad_enviar: item.cantidad,
            p_precio_base_congelado: precioBaseCongelado,
            p_referencia_viaje: referenciaViaje,
            p_usuario_id: authData.user.id,
          });

          if (error) {
            if (!isMissingFunctionError(error) || !ALLOW_INVENTORY_FALLBACK) {
              throw new Error(
                `${buildRpcErrorMessage(error)}${
                  !ALLOW_INVENTORY_FALLBACK && isMissingFunctionError(error)
                    ? " | El fallback está deshabilitado. Activa VITE_ALLOW_INVENTORY_FALLBACK=true para permitir operación de contingencia."
                    : ""
                }`
              );
            }

            const { data: camaraActual, error: camaraError } = await supabase
              .from("camara_fria")
              .select("id, cantidad_disponible, produccion_id")
              .eq("id", item.id)
              .single();

            if (camaraError || !camaraActual) {
              throw new Error(buildRpcErrorMessage(camaraError));
            }

            if ((camaraActual.cantidad_disponible || 0) < item.cantidad) {
              throw new Error(`Stock insuficiente para envío. Disponible: ${camaraActual.cantidad_disponible || 0} cajas.`);
            }

            const { error: updateCamaraError } = await supabase
              .from("camara_fria")
              .update({ cantidad_disponible: camaraActual.cantidad_disponible - item.cantidad })
              .eq("id", camaraActual.id);

            if (updateCamaraError) throw new Error(buildRpcErrorMessage(updateCamaraError));

            await safeInsertKardex({
              lote_id: item.lote_id,
              tipo_movimiento: "envio_cdmx",
              cantidad: -item.cantidad,
              ubicacion_origen: "camara_fria",
              ubicacion_destino: "en_transito_cdmx",
              usuario_id: authData.user.id,
            });

            const folio = `TR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
            const { data: transferencia, error: transferenciaError } = await supabase
              .from("transferencias_bodega")
              .insert({
                folio,
                origen: "michoacan",
                destino: "cdmx",
                estado: "en_transito",
                chofer: datos.chofer.trim(),
                placas: datos.placas.trim() || null,
                notas_salida: referenciaViaje,
              })
              .select("id")
              .single();

            if (transferenciaError || !transferencia) throw new Error(buildRpcErrorMessage(transferenciaError));

            const { error: detalleError } = await supabase.from("transferencia_detalles").insert({
              transferencia_id: transferencia.id,
              presentacion_id: item.presentacion_id,
              cantidad_enviada: item.cantidad,
              precio_base: precioBaseCongelado,
            });

            if (detalleError) throw new Error(buildRpcErrorMessage(detalleError));
          }

          continue;
        }

        const { error } = await supabase.rpc("registrar_envio_cdmx_transporte_directo", {
          p_produccion_id: item.produccion_id,
          p_lote_id: item.lote_id,
          p_cantidad_enviar: item.cantidad,
          p_precio_base_congelado: precioBaseCongelado,
          p_referencia_viaje: referenciaViaje,
          p_usuario_id: authData.user.id,
        });

        if (error) {
          if (!isMissingFunctionError(error) || !ALLOW_INVENTORY_FALLBACK) {
            throw new Error(
              `${buildRpcErrorMessage(error)}${
                !ALLOW_INVENTORY_FALLBACK && isMissingFunctionError(error)
                  ? " | El fallback está deshabilitado. Activa VITE_ALLOW_INVENTORY_FALLBACK=true para permitir operación de contingencia."
                  : ""
              }`
            );
          }

          const { data: produccionActual, error: prodError } = await supabase
            .from("produccion")
            .select("id, destino, cantidad_cajas, presentacion_id")
            .eq("id", item.produccion_id)
            .single();

          if (prodError || !produccionActual) {
            throw new Error(buildRpcErrorMessage(prodError));
          }

          if ((produccionActual.cantidad_cajas || 0) < item.cantidad) {
            throw new Error(`Stock insuficiente para envío. Disponible: ${produccionActual.cantidad_cajas || 0} cajas.`);
          }

          const { error: upProdError } = await supabase
            .from("produccion")
            .update({ destino: "camara_fria" })
            .eq("id", item.produccion_id);

          if (upProdError) throw new Error(buildRpcErrorMessage(upProdError));

          const { data: camaraRow, error: camaraFetchError } = await supabase
            .from("camara_fria")
            .select("id, cantidad_disponible")
            .eq("produccion_id", item.produccion_id)
            .maybeSingle();

          if (camaraFetchError) throw new Error(buildRpcErrorMessage(camaraFetchError));

          let camaraId = camaraRow?.id;
          let disponible = camaraRow?.cantidad_disponible || 0;

          if (!camaraRow) {
            const { data: inserted, error: insertCamaraError } = await supabase
              .from("camara_fria")
              .insert({
                produccion_id: item.produccion_id,
                cantidad_cajas: produccionActual.cantidad_cajas || item.cantidad,
                cantidad_disponible: produccionActual.cantidad_cajas || item.cantidad,
              })
              .select("id, cantidad_disponible")
              .single();

            if (insertCamaraError || !inserted) throw new Error(buildRpcErrorMessage(insertCamaraError));
            camaraId = inserted.id;
            disponible = inserted.cantidad_disponible;
          }

          if (disponible < item.cantidad) {
            throw new Error(`Stock insuficiente para envío. Disponible: ${disponible} cajas.`);
          }

          const { error: updateCamaraError } = await supabase
            .from("camara_fria")
            .update({ cantidad_disponible: disponible - item.cantidad })
            .eq("id", camaraId);

          if (updateCamaraError) throw new Error(buildRpcErrorMessage(updateCamaraError));

          await safeInsertKardex({
            lote_id: item.lote_id,
            tipo_movimiento: "envio_cdmx",
            cantidad: -item.cantidad,
            ubicacion_origen: item.origen_inventario,
            ubicacion_destino: "en_transito_cdmx",
            usuario_id: authData.user.id,
          });

          const folio = `TR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
          const { data: transferencia, error: transferenciaError } = await supabase
            .from("transferencias_bodega")
            .insert({
              folio,
              origen: "michoacan",
              destino: "cdmx",
              estado: "en_transito",
              chofer: datos.chofer.trim(),
              placas: datos.placas.trim() || null,
              notas_salida: referenciaViaje,
            })
            .select("id")
            .single();

          if (transferenciaError || !transferencia) throw new Error(buildRpcErrorMessage(transferenciaError));

          const { error: detalleError } = await supabase.from("transferencia_detalles").insert({
            transferencia_id: transferencia.id,
            presentacion_id: produccionActual.presentacion_id || item.presentacion_id,
            cantidad_enviada: item.cantidad,
            precio_base: precioBaseCongelado,
          });

          if (detalleError) throw new Error(buildRpcErrorMessage(detalleError));
        }
        if (error) throw error;
      }

      return { folio: `TR-${format(new Date(), "yyMMdd")}`, cantidadMovimientos: datos.items.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-para-transferencia"] });
      queryClient.invalidateQueries({ queryKey: ["inventario_piso_empaque"] });
      queryClient.invalidateQueries({ queryKey: ["inventario_transporte_directo"] });
      queryClient.invalidateQueries({ queryKey: ["camara_fria"] });
      queryClient.invalidateQueries({ queryKey: ["inventario_logistica"] });
      queryClient.invalidateQueries({ queryKey: ["transferencias-bodega"] });
      queryClient.invalidateQueries({ queryKey: ["transferencias_cdmx"] });
      toast.success("Envío a CDMX registrado", {
        description: `${data.cantidadMovimientos} lote(s) se movieron a en tránsito con precio base congelado.`,
      });
    },
    onError: (error: Error) => {
      toast.error("Error al crear transferencia", { description: error.message });
    },
  });

  return {
    stockDisponible,
    stockMolino,
    loadingStock: loadingStock || loadingMolino,
    crearTransferencia: crearTransferencia.mutateAsync,
    isCreando: crearTransferencia.isPending,
  };
}
