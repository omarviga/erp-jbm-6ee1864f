import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCamaraFria = () => {
    // Fetch inventory in cold storage
    const { data: inventario = [], isLoading: isLoadingInventario } = useQuery({
        queryKey: ['camara_fria'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('camara_fria')
                .select(`
                    *,
                    produccion (
                        *,
                        lotes (numero_lote)
                    )
                `)
                .gt('cantidad_disponible', 0);

            if (error) {
                console.error("Error fetching camara_fria:", error);
                throw error;
            }
            return data;
        }
    });

    // Fetch latest temperature recordings
    const { data: temperaturas = [], isLoading: isLoadingTemps } = useQuery({
        queryKey: ['registro_temperaturas'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('registro_temperaturas')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) {
                console.error("Error fetching registro_temperaturas:", error);
                throw error;
            }
            return data;
        }
    });

    return {
        inventario,
        temperaturas,
        isLoading: isLoadingInventario || isLoadingTemps
    };
};
