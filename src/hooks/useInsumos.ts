import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TipoMovimientoInsumo = 'entrada' | 'salida' | 'devolucion';

export interface InsumoUI {
  id: string;
  nombre: string;
  categoria: string;
  stock: number;
  minimo: number;
  costo: number;
  consumoDiario: number;
  updatedAt: string;
}

export interface MovimientoInsumoUI {
  id: string;
  insumoId: string;
  insumoNombre: string;
  tipoMovimiento: string;
  cantidad: number;
  referencia: string | null;
  createdAt: string;
}

const toCategoriaLabel = (tipo: string) =>
  tipo.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

const isIncremento = (tipo: TipoMovimientoInsumo) => tipo === 'entrada' || tipo === 'devolucion';

export const useInsumos = () => {
  const queryClient = useQueryClient();

  const { data: insumos = [], isLoading } = useQuery<InsumoUI[]>({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .order('nombre');

      if (error) {
        console.error('Error fetching insumos:', error);
        throw error;
      }

      return (data || []).map((item) => ({
        id: item.id,
        nombre: item.nombre,
        categoria: toCategoriaLabel(item.tipo),
        stock: item.cantidad_disponible,
        minimo: item.cantidad_minima,
        costo: item.costo_unitario || 0,
        consumoDiario: Math.max(1, item.cantidad_minima / 10),
        updatedAt: item.updated_at,
      }));
    },
  });

  const { data: movimientos = [], isLoading: loadingMovimientos } = useQuery<MovimientoInsumoUI[]>({
    queryKey: ['insumo_movimientos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumo_movimientos')
        .select('*, insumos(nombre, tipo)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching insumo_movimientos:', error);
        throw error;
      }

      return (data || []).map((mov) => ({
        id: mov.id,
        insumoId: mov.insumo_id,
        insumoNombre: mov.insumos?.nombre || mov.insumo_id,
        tipoMovimiento: mov.tipo_movimiento,
        cantidad: mov.cantidad,
        referencia: mov.referencia,
        createdAt: mov.created_at,
      }));
    },
  });

  const registrarMovimiento = useMutation({
    mutationFn: async ({
      insumoId,
      tipo,
      cantidad,
      referencia,
    }: {
      insumoId: string;
      tipo: TipoMovimientoInsumo;
      cantidad: number;
      referencia?: string;
    }) => {
      const cantidadNormalizada = Math.abs(cantidad);
      if (cantidadNormalizada <= 0) {
        throw new Error('La cantidad debe ser mayor a 0.');
      }

      const { data: insumoActual, error: errorInsumo } = await supabase
        .from('insumos')
        .select('id, cantidad_disponible')
        .eq('id', insumoId)
        .single();

      if (errorInsumo || !insumoActual) {
        throw errorInsumo || new Error('No se encontró el insumo seleccionado.');
      }

      const delta = isIncremento(tipo) ? cantidadNormalizada : -cantidadNormalizada;
      const nuevoStock = insumoActual.cantidad_disponible + delta;

      if (nuevoStock < 0) {
        throw new Error('Stock insuficiente para registrar la salida.');
      }

      const { error: errorMovimiento } = await supabase
        .from('insumo_movimientos')
        .insert({
          insumo_id: insumoId,
          tipo_movimiento: tipo,
          cantidad: cantidadNormalizada,
          referencia: referencia?.trim() || null,
        });

      if (errorMovimiento) throw errorMovimiento;

      const { error: errorUpdate } = await supabase
        .from('insumos')
        .update({ cantidad_disponible: nuevoStock })
        .eq('id', insumoId);

      if (errorUpdate) throw errorUpdate;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['insumos'] });
      await queryClient.invalidateQueries({ queryKey: ['insumo_movimientos'] });
    },
  });

  return {
    insumos,
    movimientos,
    isLoading: isLoading || loadingMovimientos,
    registrarMovimiento,
  };
};
