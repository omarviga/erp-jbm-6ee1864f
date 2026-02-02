import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useInsumos = () => {
    const { data: insumos = [], isLoading } = useQuery({
        queryKey: ['insumos'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('insumos')
                .select('*')
                .order('nombre');
            
            if (error) {
                console.error("Error fetching insumos:", error);
                throw error;
            }

            return data.map(item => ({
                id: item.id,
                nombre: item.nombre,
                categoria: item.tipo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                stock: item.stock_actual,
                minimo: item.stock_minimo,
                costo: item.precio_unitario || 0,
                // Mock consumo diario for now as it needs complex calc
                consumoDiario: item.id.length % 5 + 1 
            }));
        }
    });

    return {
        insumos,
        isLoading
    };
};
