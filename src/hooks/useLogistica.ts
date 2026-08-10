import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

export type GuiaSalida = Tables<'guias_salida'>;
export type GuiaDetalle = Tables<'guia_detalles'>;

export interface Transportista {
    id: string;
    nombre: string;
    telefono?: string;
    placas?: string;
}

type GuiaReciente = GuiaSalida & {
    clientes: {
        nombre: string | null;
    } | null;
};

type CamaraFriaLogisticaRow = Database['public']['Tables']['camara_fria']['Row'] & {
    produccion: (Database['public']['Tables']['produccion']['Row'] & {
        lotes: {
            numero_lote: string | null;
        } | null;
        presentaciones: {
            nombre: string | null;
        } | null;
    }) | null;
};

type InventarioLogisticaItem = {
    id: string;
    producto: string;
    cajas: number;
    peso: number;
    volumen: number;
    ubicacion: string;
    origen: 'camara';
    unidadMedida: string;
    valorUnitario: number;
    codigoSAT?: string;
};

type ErrorLike = { message?: string };

export const useLogistica = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Transportistas - hardcoded since table doesn't exist
    const { data: transportistas, isLoading: loadingTransportistas } = useQuery({
        queryKey: ['transportistas'],
        queryFn: async (): Promise<Transportista[]> => {
            // Table doesn't exist yet, return empty
            return [];
        },
    });

    // Fetch recent guides
    const { data: guiasRecientes, isLoading: loadingGuias } = useQuery({
        queryKey: ['guias_salida'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('guias_salida')
                .select(`*, clientes (nombre)`)
                .order('created_at', { ascending: false })
                .limit(10);
            if (error) throw error;
            return (data || []) as GuiaReciente[];
        },
    });

    // Fetch inventory available for shipping (from cold storage)
    const { data: inventarioDisponible, isLoading: loadingInventario } = useQuery({
        queryKey: ['inventario_logistica'],
        queryFn: async (): Promise<InventarioLogisticaItem[]> => {
            const { data, error } = await supabase
                .from('camara_fria')
                .select(`*, produccion (*, lotes (numero_lote), presentaciones (nombre))`)
                .gt('cantidad_disponible', 0);
            if (error) throw error;

            return ((data || []) as CamaraFriaLogisticaRow[]).map(item => ({
                id: item.id,
                producto: `${item.produccion?.calidad || ''} ${item.produccion?.calibre || ''} - Lote: ${item.produccion?.lotes?.numero_lote || 'N/A'}`.trim(),
                cajas: item.cantidad_disponible,
                peso: item.produccion?.peso_total_kg || 0,
                volumen: 0,
                ubicacion: 'Cámara Fría',
                origen: 'camara' as const,
                unidadMedida: item.produccion?.presentaciones?.nombre || 'Caja',
                valorUnitario: 0,
            }));
        },
    });

    // Mutation to create a guide
    const crearGuiaMutation = useMutation({
        mutationFn: async (vars: {
            guia: Database['public']['Tables']['guias_salida']['Insert'];
            detalles: Omit<Database['public']['Tables']['guia_detalles']['Insert'], 'guia_id'>[];
        }) => {
            const { data: guia, error: errorGuia } = await supabase
                .from('guias_salida')
                .insert(vars.guia)
                .select()
                .single();

            if (errorGuia) throw errorGuia;

            const detallesConId = vars.detalles.map(d => ({ ...d, guia_id: guia.id }));
            const { error: errorDetalles } = await supabase
                .from('guia_detalles')
                .insert(detallesConId);

            if (errorDetalles) throw errorDetalles;

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
        onError: (error: unknown) => {
            const message = error && typeof error === 'object' && 'message' in error
                ? String((error as ErrorLike).message || 'Error desconocido')
                : 'Error desconocido';
            toast({
                title: "Error",
                description: message,
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
