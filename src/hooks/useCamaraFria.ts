import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  tipo_movimiento: "traslado_interno" | "envio_cdmx";
  cantidad: number;
  ubicacion_origen: string;
  ubicacion_destino: string;
  usuario_id: string;
}) => {
  const { error } = await supabase.from("inventario_kardex").insert(payload);
  if (error) {
    console.warn("Kardex fallback insert skipped:", error.message);
  }
};

export const useCamaraFria = () => {
  const queryClient = useQueryClient();

  const { data: inventario = [], isLoading: isLoadingInventario } = useQuery({
    queryKey: ["camara_fria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("camara_fria")
        .select(`
          *,
          produccion (
            *,
            lotes (numero_lote, origen, productor_id)
          )
        `)
        .gt("cantidad_disponible", 0);

      if (error) throw error;
      return data;
    },
  });

  const { data: pisoEmpaque = [], isLoading: isLoadingPiso } = useQuery({
    queryKey: ["inventario_piso_empaque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produccion")
        .select(`
          *,
          lotes (numero_lote, origen, productor_id)
        `)
        .eq("destino", "piso_empaque")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: transporteDirecto = [], isLoading: isLoadingTransporte } = useQuery({
    queryKey: ["inventario_transporte_directo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produccion")
        .select(`
          *,
          lotes (numero_lote, origen, productor_id)
        `)
        .eq("destino", "transporte_directo")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const { data: temperaturas = [], isLoading: isLoadingTemps } = useQuery({
    queryKey: ["registro_temperaturas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("registro_temperaturas").select("*").order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });

  const trasladoInternoMutation = useMutation({
    mutationFn: async ({ produccionId, loteId, cantidad, usuarioId }: { produccionId: string; loteId: string; cantidad: number; usuarioId: string }) => {
      const { error } = await supabase.rpc("trasladar_a_camara_fria", {
        p_produccion_id: produccionId,
        p_lote_id: loteId,
        p_cantidad: cantidad,
        p_usuario_id: usuarioId,
      });

      if (!error) return true;
      if (!isMissingFunctionError(error)) throw new Error(buildRpcErrorMessage(error));

      const { error: updateProdError } = await supabase.from("produccion").update({ destino: "camara_fria" }).eq("id", produccionId).eq("destino", "piso_empaque");
      if (updateProdError) throw new Error(buildRpcErrorMessage(updateProdError));

      const { data: camaraRow, error: camaraFetchError } = await supabase.from("camara_fria").select("id, cantidad_disponible").eq("produccion_id", produccionId).maybeSingle();
      if (camaraFetchError) throw new Error(buildRpcErrorMessage(camaraFetchError));

      if (!camaraRow) {
        const { error: insertCamaraError } = await supabase.from("camara_fria").insert({ produccion_id: produccionId, cantidad_cajas: cantidad, cantidad_disponible: cantidad });
        if (insertCamaraError) throw new Error(buildRpcErrorMessage(insertCamaraError));
      } else {
        const { error: updateCamaraError } = await supabase.from("camara_fria").update({ cantidad_disponible: camaraRow.cantidad_disponible + cantidad }).eq("id", camaraRow.id);
        if (updateCamaraError) throw new Error(buildRpcErrorMessage(updateCamaraError));
      }

      await safeInsertKardex({
        lote_id: loteId,
        tipo_movimiento: "traslado_interno",
        cantidad,
        ubicacion_origen: "piso_empaque",
        ubicacion_destino: "camara_fria",
        usuario_id: usuarioId,
      });

      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventario_piso_empaque"] });
      await queryClient.invalidateQueries({ queryKey: ["camara_fria"] });
    },
  });

  const envioTransporteDirectoMutation = useMutation({
    mutationFn: async ({
      produccionId,
      loteId,
      cantidad,
      precioBaseCongelado,
      referenciaViaje,
      usuarioId,
    }: {
      produccionId: string;
      loteId: string;
      cantidad: number;
      precioBaseCongelado: number;
      referenciaViaje: string;
      usuarioId: string;
    }) => {
      const { error } = await supabase.rpc("registrar_envio_cdmx_transporte_directo", {
        p_produccion_id: produccionId,
        p_lote_id: loteId,
        p_cantidad_enviar: cantidad,
        p_precio_base_congelado: precioBaseCongelado,
        p_referencia_viaje: referenciaViaje,
        p_usuario_id: usuarioId,
      });

      if (!error) return true;
      if (!isMissingFunctionError(error)) throw new Error(buildRpcErrorMessage(error));

      const { data: produccion, error: prodError } = await supabase.from("produccion").select("id, presentacion_id, cantidad_cajas").eq("id", produccionId).single();
      if (prodError || !produccion) throw new Error(buildRpcErrorMessage(prodError));

      const { error: updateProdError } = await supabase.from("produccion").update({ destino: "camara_fria" }).eq("id", produccionId);
      if (updateProdError) throw new Error(buildRpcErrorMessage(updateProdError));

      const { data: camaraRow, error: camaraFetchError } = await supabase.from("camara_fria").select("id, cantidad_disponible").eq("produccion_id", produccionId).maybeSingle();
      if (camaraFetchError) throw new Error(buildRpcErrorMessage(camaraFetchError));

      let camaraId = camaraRow?.id;
      let disponible = camaraRow?.cantidad_disponible || 0;

      if (!camaraRow) {
        const { data: inserted, error: insertCamaraError } = await supabase
          .from("camara_fria")
          .insert({
            produccion_id: produccionId,
            cantidad_cajas: produccion.cantidad_cajas || cantidad,
            cantidad_disponible: produccion.cantidad_cajas || cantidad,
          })
          .select("id, cantidad_disponible")
          .single();

        if (insertCamaraError || !inserted) throw new Error(buildRpcErrorMessage(insertCamaraError));
        camaraId = inserted.id;
        disponible = inserted.cantidad_disponible;
      }

      if (disponible < cantidad) throw new Error(`Stock insuficiente para envío. Disponible: ${disponible} cajas.`);

      const { error: updateCamaraError } = await supabase.from("camara_fria").update({ cantidad_disponible: disponible - cantidad }).eq("id", camaraId);
      if (updateCamaraError) throw new Error(buildRpcErrorMessage(updateCamaraError));

      await safeInsertKardex({
        lote_id: loteId,
        tipo_movimiento: "envio_cdmx",
        cantidad: -cantidad,
        ubicacion_origen: "transporte_directo",
        ubicacion_destino: "en_transito_cdmx",
        usuario_id: usuarioId,
      });

      const folio = `TR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const { data: transferencia, error: transferenciaError } = await supabase
        .from("transferencias_bodega")
        .insert({ folio, origen: "michoacan", destino: "cdmx", estado: "en_transito", chofer: "Pendiente", notas_salida: referenciaViaje })
        .select("id")
        .single();
      if (transferenciaError || !transferencia) throw new Error(buildRpcErrorMessage(transferenciaError));

      const { error: detalleError } = await supabase.from("transferencia_detalles").insert({
        transferencia_id: transferencia.id,
        presentacion_id: produccion.presentacion_id,
        cantidad_enviada: cantidad,
        precio_base: precioBaseCongelado,
      });
      if (detalleError) throw new Error(buildRpcErrorMessage(detalleError));

      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventario_transporte_directo"] });
      await queryClient.invalidateQueries({ queryKey: ["camara_fria"] });
      await queryClient.invalidateQueries({ queryKey: ["transferencias-bodega"] });
    },
  });

  const registrarMermaMutation = useMutation({
    mutationFn: async ({ idCamara, idLote, cantidad, motivo, idUsuario }: { idCamara: string; idLote: string; cantidad: number; motivo: string; idUsuario: string }) => {
      const { error } = await supabase.rpc("registrar_baja_merma", {
        p_registro_camara_id: idCamara,
        p_lote_id: idLote,
        p_cantidad_mermada: cantidad,
        p_motivo: motivo,
        p_usuario_id: idUsuario,
      });

      if (error) throw new Error(buildRpcErrorMessage(error));
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["camara_fria"] });
    },
  });

  return {
    inventario,
    pisoEmpaque,
    transporteDirecto,
    temperaturas,
    trasladoInterno: trasladoInternoMutation.mutateAsync,
    isTrasladandoInterno: trasladoInternoMutation.isPending,
    registrarMerma: registrarMermaMutation.mutateAsync,
    isRegistrandoMerma: registrarMermaMutation.isPending,
    enviarTransporteDirectoACdmx: envioTransporteDirectoMutation.mutateAsync,
    isEnviandoTransporteDirecto: envioTransporteDirectoMutation.isPending,
    isLoading: isLoadingInventario || isLoadingTemps || isLoadingPiso || isLoadingTransporte,
  };
};
