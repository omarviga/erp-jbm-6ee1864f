import { Database } from '@/integrations/supabase/types';

// Base types from Supabase
export type Lote = Database['public']['Tables']['lotes']['Row'];
export type Productor = Database['public']['Tables']['productores']['Row'];
export type Huerto = Database['public']['Tables']['huertos']['Row'];
export type Cortador = Database['public']['Tables']['cortadores']['Row'];

// Extended types with relations
export interface LoteWithRelations extends Lote {
  productor?: Productor;
  huerto?: Huerto;
  lote_cortadores?: Array<{
    cortadores?: Cortador;
    cajas_recolectadas: number;
  }>;
  produccion?: Database['public']['Tables']['produccion']['Row'][];
}

// Analysis types
export interface AnalisisRentabilidad {
  costoTotal: number;
  ingresoEstimado: number;
  margen: number;
  roi: number;
}

// Hook return types
export interface UseLoteReturn {
  lote: LoteWithRelations | null;
  loading: boolean;
  error: string | null;
}

export interface UseAnalisisRentabilidadReturn {
  analisis: AnalisisRentabilidad | null;
}
