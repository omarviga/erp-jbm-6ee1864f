import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCamaraFria = () => {
    const queryClient = useQueryClient();

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
                        lotes (numero_lote, origen, productor_id)
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

    const { data: pisoEmpaque = [], isLoading: isLoadingPiso } = useQuery({
        queryKey: ['inventario_piso_empaque'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('produccion')
                .select(`
                    *,
                    lotes (numero_lote, origen, productor_id)
                `)
                .eq('destino', 'piso_empaque')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching piso_empaque:", error);
                throw error;
            }
            return data;
        }
    });

    const { data: transporteDirecto = [], isLoading: isLoadingTransporte } = useQuery({
        queryKey: ['inventario_transporte_directo'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('produccion')
                .select(`
                    *,
                    lotes (numero_lote, origen, productor_id)
                `)
                .eq('destino', 'transporte_directo')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error("Error fetching transporte_directo:", error);
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

    const trasladoInternoMutation = useMutation({
        mutationFn: async ({ produccionId, loteId, cantidad, usuarioId }: {
            produccionId: string;
            loteId: string;
            cantidad: number;
            usuarioId: string;
        }) => {
            const { error } = await supabase.rpc('trasladar_a_camara_fria', {
                p_produccion_id: produccionId,
                p_lote_id: loteId,
                p_cantidad: cantidad,
                p_usuario_id: usuarioId,
            });

            if (error) {
                console.error("Error running trasladar_a_camara_fria RPC:", error);
                throw error;
            }

            return true;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['inventario_piso_empaque'] });
            await queryClient.invalidateQueries({ queryKey: ['camara_fria'] });
        }
    });

    const registrarMermaMutation = useMutation({
        mutationFn: async ({ idCamara, idLote, cantidad, motivo, idUsuario }: {
            idCamara: string;
            idLote: string;
            cantidad: number;
            motivo: string;
            idUsuario: string;
        }) => {
            const { error } = await supabase.rpc('registrar_baja_merma', {
                p_registro_camara_id: idCamara,
                p_lote_id: idLote,
                p_cantidad_mermada: cantidad,
                p_motivo: motivo,
                p_usuario_id: idUsuario,
            });

            if (error) {
                console.error("Error running registrar_baja_merma RPC:", error);
                throw error;
            }

            return true;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['camara_fria'] });
        }
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
        isLoading: isLoadingInventario || isLoadingTemps || isLoadingPiso || isLoadingTransporte
    };
};
