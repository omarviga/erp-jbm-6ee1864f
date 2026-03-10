import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

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
          id?: string;
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
      const { data, error } = await supabase
        .from("stock_molino")
        .select(`*, lotes (numero_lote)`)
        .gt("peso_disponible", 0);

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
      ].filter(Boolean).join(" / ");

      for (const item of datos.items) {
        const precioBaseCongelado = calcularPrecioBaseCongelado(item);

        if (item.origen_inventario === "camara_fria") {
          const { error } = await supabase.rpc("registrar_envio_cdmx", {
            p_registro_camara_id: item.id,
            p_lote_id: item.lote_id,
            p_cantidad_enviar: item.cantidad,
            p_precio_base_congelado: precioBaseCongelado,
            p_referencia_viaje: referenciaViaje,
            p_chofer: datos.chofer.trim(),
            p_placas: datos.placas.trim(),
            p_usuario_id: authData.user.id,
          });
          if (error) throw error;
          continue;
        }

        const { error } = await supabase.rpc("registrar_envio_cdmx_transporte_directo", {
          p_produccion_id: item.produccion_id,
          p_lote_id: item.lote_id,
          p_cantidad_enviar: item.cantidad,
          p_precio_base_congelado: precioBaseCongelado,
          p_referencia_viaje: referenciaViaje,
          p_chofer: datos.chofer.trim(),
          p_placas: datos.placas.trim(),
          p_usuario_id: authData.user.id,
        });

        if (error) throw error;
      }

      const folio = `TR-${format(new Date(), "yyMMdd")}`;
      return { folio, cantidadMovimientos: datos.items.length };
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
      toast.error("Error al crear transferencia", {
        description: error.message,
      });
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
