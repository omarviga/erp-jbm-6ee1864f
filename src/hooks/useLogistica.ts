import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

export type Transportista = Database['public']['Tables']['transportistas']['Row'];
export type GuiaSalida = Database['public']['Tables']['guias_salida']['Row'];
export type GuiaDetalle = Database['public']['Tables']['guia_detalles']['Row'];

export const useLogistica = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch transportistas
    const { data: transportistas, isLoading: loadingTransportistas } = useQuery({
        queryKey: ['transportistas'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('transportistas')
                .select('*')
                .order('nombre');
            if (error) throw error;
            return data;
        },
    });

    // Fetch recent guides
    const { data: guiasRecientes, isLoading: loadingGuias } = useQuery({
        queryKey: ['guias_salida'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('guias_salida')
                .select(`
          *,
          clientes (nombre),
          transportistas (nombre)
        `)
                .order('created_at', { ascending: false })
                .limit(10);
            if (error) throw error;
            return data;
        },
    });

    // Fetch inventory available for shipping (from cold storage)
    const { data: inventarioDisponible, isLoading: loadingInventario } = useQuery({
        queryKey: ['inventario_logistica'],
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
            if (error) throw error;

            // Transform to match the structure expected by the UI if possible, 
            // or at least provide a clean object
            return data.map(item => ({
                id: item.id,
                producto: `${item.produccion?.calidad} ${item.produccion?.calibre} - Lote: ${item.produccion?.lotes?.numero_lote}`,
                cajas: item.cantidad_disponible,
                peso: item.produccion?.peso_total_kg || 0,
                ubicacion: 'Cámara Fría',
                origen: 'camara' as const,
                valorUnitario: 0, // Should be fetched from somewhere or handled in UI
            }));
        },
    });

    // Mutation to create a guide
    const crearGuiaMutation = useMutation({
        mutationFn: async (vars: {
            guia: Database['public']['Tables']['guias_salida']['Insert'];
            detalles: Database['public']['Tables']['guia_detalles']['Insert'][];
        }) => {
            // 1. Insert guide
            const { data: guia, error: errorGuia } = await supabase
                .from('guias_salida')
                .insert(vars.guia)
                .select()
                .single();

            if (errorGuia) throw errorGuia;

            // 2. Insert details
            const detallesConId = vars.detalles.map(d => ({ ...d, guia_id: guia.id }));
            const { error: errorDetalles } = await supabase
                .from('guia_detalles')
                .insert(detallesConId);

            if (errorDetalles) throw errorDetalles;

            // 3. Update inventory (deduct boxes)
            for (const detalle of vars.detalles) {
                if (detalle.camara_fria_id) {
                    const { data: current } = await supabase
                        .from('camara_fria')
                        .select('cantidad_disponible')
                        .eq('id', detalle.camara_fria_id)
                        .single();

                    if (current) {
                        await supabase
                            .from('camara_fria')
                            .update({ cantidad_disponible: current.cantidad_disponible - detalle.cantidad })
                            .eq('id', detalle.camara_fria_id);
                    }
                }
            }

            return guia;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['guias_salida'] });
            queryClient.invalidateQueries({ queryKey: ['inventario_logistica'] });
            toast({
                title: "Guía Generada",
                description: "La guía de salida y carta porte se han registrado correctamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    return {
        transportistas,
        guiasRecientes,
        inventarioDisponible,
        loadingTransportistas,
        loadingGuias,
        loadingInventario,
        crearGuia: crearGuiaMutation.mutateAsync,
        isCreando: crearGuiaMutation.isPending
    };
};
