import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const buildRpcErrorMessage = (error: { message?: string; details?: string; hint?: string; code?: string } | null) => {
    if (!error) return 'Error desconocido';

    const parts = [error.message, error.details, error.hint].filter(Boolean);
    const base = parts.length > 0 ? parts.join(' | ') : 'Error desconocido';
    return error.code ? `${base} (code: ${error.code})` : base;
};

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
                const msg = buildRpcErrorMessage(error);
                console.error("Error running trasladar_a_camara_fria RPC:", msg, error);
                throw new Error(msg);
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


    const envioTransporteDirectoMutation = useMutation({
        mutationFn: async ({ produccionId, loteId, cantidad, precioBaseCongelado, referenciaViaje, chofer, placas, usuarioId }: {
            produccionId: string;
            loteId: string;
            cantidad: number;
            precioBaseCongelado: number;
            referenciaViaje: string;
            chofer?: string;
            placas?: string;
            usuarioId: string;
        }) => {
            const { error } = await supabase.rpc('registrar_envio_cdmx_transporte_directo', {
                p_produccion_id: produccionId,
                p_lote_id: loteId,
                p_cantidad_enviar: cantidad,
                p_precio_base_congelado: precioBaseCongelado,
                p_referencia_viaje: referenciaViaje,
                p_chofer: chofer ?? "",
                p_placas: placas ?? "",
                p_usuario_id: usuarioId,
            });

            if (error) {
                const msg = buildRpcErrorMessage(error);
                console.error("Error running registrar_envio_cdmx_transporte_directo RPC:", msg, error);
                throw new Error(msg);
                console.error("Error running registrar_envio_cdmx_transporte_directo RPC:", error);
                throw error;
            }

            return true;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['inventario_transporte_directo'] });
            await queryClient.invalidateQueries({ queryKey: ['camara_fria'] });
            await queryClient.invalidateQueries({ queryKey: ['transferencias-bodega'] });
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
                const msg = buildRpcErrorMessage(error);
                console.error("Error running registrar_baja_merma RPC:", msg, error);
                throw new Error(msg);
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
        enviarTransporteDirectoACdmx: envioTransporteDirectoMutation.mutateAsync,
        isEnviandoTransporteDirecto: envioTransporteDirectoMutation.isPending,
        isLoading: isLoadingInventario || isLoadingTemps || isLoadingPiso || isLoadingTransporte
    };
};
