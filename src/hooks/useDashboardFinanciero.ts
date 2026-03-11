import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ResumenFinanciero {
  ingresos: number;
  costo_fruta: number;
  kilos_comprados: number;
  provision_operativa: number;
  gastos_generales: number;
  utilidad_neta: number;
  margen_porcentaje: number;
}

export const useDashboardFinanciero = (fechaInicio: Date, fechaFin: Date) => {
  return useQuery({
    queryKey: ["dashboard_financiero", fechaInicio.toISOString(), fechaFin.toISOString()],
    queryFn: async (): Promise<ResumenFinanciero> => {
      const { data, error } = await supabase.rpc("get_resumen_financiero", {
        fecha_inicio: fechaInicio.toISOString(),
        fecha_fin: fechaFin.toISOString(),
      });

      if (error) {
        console.error("Error obteniendo resumen financiero:", error);
        throw new Error("No se pudo cargar el resumen financiero");
      }

      // Tipamos la respuesta para que el autocompletado funcione perfecto
      return data as unknown as ResumenFinanciero;
    },
    // Refrescar cada 5 minutos automáticamente
    staleTime: 1000 * 60 * 5, 
  });
};