import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TransferenciaDetalle {
  presentacion_id: string;
  cantidad_recibida: number;
  precio_venta: number;
  notas_diferencia?: string;
}

export interface TransferenciaBodega {
  id: string;
  folio: string;
  origen: string;
  destino: string;
  fecha_salida: string;
  fecha_recepcion?: string;
  estado: 'en_transito' | 'recibido' | 'con_discrepancia';
  chofer?: string;
  placas?: string;
  notas_salida?: string;
  notas_recepcion?: string;
  created_at: string;
}

export interface TransferenciaDetalleRow {
  id: string;
  transferencia_id: string;
  presentacion_id: string;
  precio_base: number;
  precio_venta?: number;
  cantidad_enviada: number;
  cantidad_recibida?: number;
  diferencia?: number;
  notas_diferencia?: string;
  presentacion?: {
    nombre: string;
    peso_kg: number;
    tipo: string;
  };
}

export function useTransferenciasCDMX() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener todas las transferencias
  const { data: transferencias, isLoading, error, refetch } = useQuery({
    queryKey: ["transferencias-bodega"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transferencias_bodega")
        .select("*")
        .order("fecha_salida", { ascending: false });

      if (error) throw error;
      return data as TransferenciaBodega[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Obtener detalles de una transferencia específica
  const useDetallesTransferencia = (transferenciaId?: string) => {
    return useQuery({
      queryKey: ["transferencia-detalles", transferenciaId],
      queryFn: async () => {
        if (!transferenciaId) return [];

        const { data, error } = await supabase
          .from("transferencia_detalles")
          .select(`
            *,
            presentacion:presentacion_id (
              nombre,
              peso_kg,
              tipo
            )
          `)
          .eq("transferencia_id", transferenciaId);

        if (error) throw error;
        return data as TransferenciaDetalleRow[];
      },
      enabled: !!transferenciaId,
    });
  };

  // Procesar recepción de transferencia
  const procesarRecepcion = useMutation({
    mutationFn: async ({
      transferenciaId,
      detalles,
    }: {
      transferenciaId: string;
      detalles: TransferenciaDetalle[];
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuario no autenticado");

      const { data, error } = await supabase.rpc("procesar_recepcion_transferencia", {
        p_transferencia_id: transferenciaId,
        p_detalles: detalles as any,
        p_recibido_por: user.user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transferencias-bodega"] });
      queryClient.invalidateQueries({ queryKey: ["inventario-cdmx"] });
      
      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          toast({
            title: result.tiene_discrepancias ? "⚠️ Recepción con discrepancias" : "✅ Recepción exitosa",
            description: result.mensaje,
            variant: result.tiene_discrepancias ? "destructive" : "default",
          });
        } else {
          toast({
            title: "❌ Error",
            description: result.mensaje,
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error al procesar recepción",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    transferencias,
    isLoading,
    error,
    refetch,
    useDetallesTransferencia,
    procesarRecepcion,
  };
}

// Hook para inventario CDMX
export function useInventarioCDMX() {
  const { toast } = useToast();

  const { data: inventario, isLoading, refetch } = useQuery({
    queryKey: ["inventario-cdmx"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventario_bodega_cdmx")
        .select(`
          *,
          presentacion:presentacion_id (
            nombre,
            peso_kg,
            tipo
          ),
          transferencia:transferencia_id (
            folio,
            fecha_salida
          )
        `)
        .gt("cantidad_disponible", 0)
        .order("fecha_ingreso", { ascending: true }); // FIFO

      if (error) throw error;
      return data;
    },
  });

  return {
    inventario,
    isLoading,
    refetch,
  };
}
