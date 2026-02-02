// services/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper para formatear fechas
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Helper para calcular días entre fechas
export const calcularDiasEntre = (fechaInicio: string, fechaFin?: string): number => {
  const inicio = new Date(fechaInicio);
  const fin = fechaFin ? new Date(fechaFin) : new Date();
  const diffTime = Math.abs(fin.getTime() - inicio.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};