import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export interface ItemTransferencia {
  id: string; // camara_fria.id
  produccion_id: string;
  presentacion_id: string;
  presentacion_nombre: string;
  cantidad: number;
  cantidad_disponible: number;
  peso_kg: number;
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

export function useCrearTransferenciaCDMX() {
  const queryClient = useQueryClient();

  // Stock disponible en cámara fría con presentación
  const { data: stockDisponible = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stock-para-transferencia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("camara_fria")
        .select(`
          id,
          cantidad_disponible,
          produccion_id,
          produccion (
            id,
            calibre,
            calidad,
            color,
            cantidad_cajas,
            peso_total_kg,
            presentacion_id,
            lotes (numero_lote),
            presentaciones:presentacion_id (id, nombre, peso_kg)
          )
        `)
        .gt("cantidad_disponible", 0);

      if (error) throw error;

      return (data || []).map((item) => {
        const prod = item.produccion as any;
        return {
          id: item.id,
          produccion_id: item.produccion_id,
          presentacion_id: prod?.presentaciones?.id || prod?.presentacion_id || "",
          presentacion_nombre: prod?.presentaciones?.nombre || "Sin presentación",
          cantidad_disponible: item.cantidad_disponible,
          peso_kg: prod?.peso_total_kg || 0,
          calibre: prod?.calibre || "",
          calidad: prod?.calidad || "",
          lote_numero: prod?.lotes?.numero_lote || "N/A",
          descripcion: `Lote: ${prod?.lotes?.numero_lote || "N/A"}`,
        };
      });
    },
  });

  // Stock en molino
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

      const folio = `TR-${format(new Date(), "yyMMdd")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;

      // 1. Create transfer header
      const { data: transferencia, error: errorTrans } = await supabase
        .from("transferencias_bodega")
        .insert({
          folio,
          origen: "michoacan",
          destino: "cdmx",
          estado: "en_transito",
          chofer: datos.chofer,
          placas: datos.placas || null,
          notas_salida: datos.notas || null,
        })
        .select()
        .single();

      if (errorTrans) throw errorTrans;

      // 2. Group items by presentacion_id and create details
      const detalles = datos.items.map((item) => ({
        transferencia_id: transferencia.id,
        presentacion_id: item.presentacion_id,
        cantidad_enviada: item.cantidad,
        precio_base: item.peso_kg > 0 ? Math.round((item.peso_kg / item.cantidad_disponible) * item.cantidad * 100) / 100 : 0,
      }));

      const { error: errorDet } = await supabase
        .from("transferencia_detalles")
        .insert(detalles);

      if (errorDet) throw errorDet;

      // 3. Discount from camara_fria
      for (const item of datos.items) {
        const { error: errorUpdate } = await supabase
          .from("camara_fria")
          .update({
            cantidad_disponible: item.cantidad_disponible - item.cantidad,
          })
          .eq("id", item.id);

        if (errorUpdate) throw errorUpdate;
      }

      return { folio, id: transferencia.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-para-transferencia"] });
      queryClient.invalidateQueries({ queryKey: ["camara_fria"] });
      queryClient.invalidateQueries({ queryKey: ["inventario_logistica"] });
      queryClient.invalidateQueries({ queryKey: ["transferencias-bodega"] });
      toast.success(`Transferencia ${data.folio} creada`, {
        description: "El envío a CDMX ha sido registrado exitosamente.",
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
