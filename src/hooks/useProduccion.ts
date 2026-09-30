// hooks/useProduction.ts - Custom hook para producción
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProduccionInsert = Database["public"]["Tables"]["produccion"]["Insert"];

export const useProduction = () => {
    const queryClient = useQueryClient();

    const registerProduction = useMutation({
        mutationFn: async (productionData: ProduccionInsert) => {
            const { data, error } = await supabase
                .from('produccion')
                .insert([productionData])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produccion-por-lote'] });
            queryClient.invalidateQueries({ queryKey: ['lotes-activos'] });
        }
    });

    return { registerProduction };
};
