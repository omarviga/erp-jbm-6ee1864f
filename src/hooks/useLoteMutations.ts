import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loteService, RecepcionCompraTerceros, RecepcionCosechaPropia } from '@/services/loteService';
import { toast } from 'sonner';

export const useLoteMutations = () => {
  const queryClient = useQueryClient();
  
  // Mutación para compra a terceros
  const createCompraTerceros = useMutation({
    mutationFn: (data: RecepcionCompraTerceros) => loteService.createCompraTerceros(data),
    onSuccess: (lote) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['lotesRecientes'] });
      
      // Mostrar notificación
      toast.success('✅ Lote registrado correctamente', {
        description: `Número de lote: ${lote.numero_lote}`,
      });
      
      return lote;
    },
    onError: (error: Error) => {
      toast.error('❌ Error al registrar lote', {
        description: error.message,
      });
    }
  });
  
  // Mutación para cosecha propia
  const createCosechaPropia = useMutation({
    mutationFn: (data: RecepcionCosechaPropia) => loteService.createCosechaPropia(data),
    onSuccess: (lote) => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['lotesRecientes'] });
      
      toast.success('✅ Cosecha propia registrada', {
        description: `Lote: ${lote.numero_lote}`,
      });
      
      return lote;
    },
    onError: (error: Error) => {
      toast.error('❌ Error al registrar cosecha', {
        description: error.message,
      });
    }
  });
  
  return {
    createCompraTerceros,
    createCosechaPropia,
  };
};

// Hook para datos de dropdowns
export const useRecepcionData = () => {
  const productores = useQuery({
    queryKey: ['productores'],
    queryFn: loteService.getProductores,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
  
  const huertos = useQuery({
    queryKey: ['huertos'],
    queryFn: loteService.getHuertos,
    staleTime: 5 * 60 * 1000,
  });
  
  const cortadores = useQuery({
    queryKey: ['cortadores'],
    queryFn: loteService.getCortadoresActivos,
    staleTime: 5 * 60 * 1000,
  });
  
  return {
    productores,
    huertos,
    cortadores,
  };
};

// Hook para historial de precios
export const useHistorialPrecios = (productorId: string | null) => {
  return useQuery({
    queryKey: ['historialPrecios', productorId],
    queryFn: () => loteService.getHistorialPrecios(productorId!),
    enabled: !!productorId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
};

// Hook para lotes recientes
export const useLotesRecientes = (limit = 10) => {
  return useQuery({
    queryKey: ['lotesRecientes', limit],
    queryFn: () => loteService.getLotesRecientes(limit),
    staleTime: 30 * 1000, // 30 segundos
  });
};
