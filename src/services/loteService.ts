import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { z } from 'zod';

// Validation schemas for input sanitization
export const compraTercerosSchema = z.object({
  productor_id: z.string().uuid('ID de productor inválido'),
  peso_bruto: z.number()
    .positive('El peso bruto debe ser mayor a 0')
    .max(50000, 'El peso bruto no puede exceder 50,000 kg'),
  peso_tara: z.number()
    .nonnegative('La tara no puede ser negativa')
    .max(5000, 'La tara no puede exceder 5,000 kg'),
  precio_pactado_kg: z.number()
    .positive('El precio debe ser mayor a 0')
    .max(1000, 'El precio no puede exceder $1,000/kg'),
  notas: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional().nullable()
}).refine(data => data.peso_tara < data.peso_bruto, {
  message: "La tara debe ser menor que el peso bruto",
  path: ["peso_tara"]
});

export const cosechaPropiaSchema = z.object({
  huerto_id: z.string().uuid('ID de huerto inválido'),
  peso_bruto: z.number()
    .positive('El peso bruto debe ser mayor a 0')
    .max(50000, 'El peso bruto no puede exceder 50,000 kg'),
  peso_tara: z.number()
    .nonnegative('La tara no puede ser negativa')
    .max(5000, 'La tara no puede exceder 5,000 kg'),
  cortadores: z.array(z.object({
    cortador_id: z.string().uuid('ID de cortador inválido'),
    cajas_recolectadas: z.number()
      .nonnegative('Las cajas no pueden ser negativas')
      .max(1000, 'Las cajas no pueden exceder 1,000')
  })).min(1, 'Debe agregar al menos un cortador'),
  notas: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional().nullable()
}).refine(data => data.peso_tara < data.peso_bruto, {
  message: "La tara debe ser menor que el peso bruto",
  path: ["peso_tara"]
});

// Tipos inferidos desde los schemas
export type RecepcionCompraTerceros = z.infer<typeof compraTercerosSchema>;
export type RecepcionCosechaPropia = z.infer<typeof cosechaPropiaSchema>;

type LoteActivoRow = Database["public"]["Tables"]["lotes"]["Row"] & {
  productor: {
    nombre: string | null;
  } | null;
  huerto: {
    nombre: string | null;
  } | null;
};

export const loteService = {
  // Crear lote de compra a terceros
  async createCompraTerceros(data: RecepcionCompraTerceros) {
    // Validate input before database operations
    const validated = compraTercerosSchema.parse(data);

    // 1. Obtener número de lote desde la función de BD
    const { data: numeroLote, error: rpcError } = await supabase
      .rpc('generate_lote_number');

    if (rpcError) throw rpcError;

    // 2. Insertar en tabla lotes
    const { data: lote, error } = await supabase
      .from('lotes')
      .insert({
        numero_lote: numeroLote,
        productor_id: validated.productor_id,
        es_cosecha_propia: false,
        fecha_recepcion: new Date().toISOString(),
        peso_bruto: validated.peso_bruto,
        peso_tara: validated.peso_tara,
        precio_pactado_kg: validated.precio_pactado_kg,
        estado: 'pendiente',
        notas: validated.notas || null
      })
      .select()
      .single();

    if (error) throw error;
    return lote;
  },

  // Crear lote de cosecha propia
  async createCosechaPropia(data: RecepcionCosechaPropia) {
    // Validate input before database operations
    const validated = cosechaPropiaSchema.parse(data);

    // 1. Obtener número de lote
    const { data: numeroLote, error: rpcError } = await supabase
      .rpc('generate_lote_number');

    if (rpcError) throw rpcError;

    // 2. Insertar lote principal
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .insert({
        numero_lote: numeroLote,
        huerto_id: validated.huerto_id,
        es_cosecha_propia: true,
        fecha_recepcion: new Date().toISOString(),
        peso_bruto: validated.peso_bruto,
        peso_tara: validated.peso_tara,
        estado: 'pendiente',
        notas: validated.notas || null
      })
      .select()
      .single();

    if (loteError) throw loteError;

    // 3. Insertar cortadores asociados
    if (validated.cortadores.length > 0) {
      const cortadoresData = validated.cortadores
        .filter(c => c.cortador_id && c.cajas_recolectadas > 0)
        .map(c => ({
          lote_id: lote.id,
          cortador_id: c.cortador_id,
          cajas_recolectadas: c.cajas_recolectadas
        }));

      if (cortadoresData.length > 0) {
        const { error: cortadoresError } = await supabase
          .from('lote_cortadores')
          .insert(cortadoresData);

        if (cortadoresError) throw cortadoresError;
      }
    }

    return lote;
  },

  // Obtener productores para dropdown
  async getProductores() {
    const { data, error } = await supabase
      .from('productores')
      .select('id, nombre, telefono')
      .order('nombre');

    if (error) throw error;
    return data || [];
  },

  // Obtener huertos para dropdown
  async getHuertos() {
    const { data, error } = await supabase
      .from('huertos')
      .select('id, nombre, ubicacion')
      .order('nombre');

    if (error) throw error;
    return data || [];
  },

  // Obtener cortadores activos
  async getCortadoresActivos() {
    const { data, error } = await supabase
      .from('cortadores')
      .select('id, nombre, telefono')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    return data || [];
  },

  // Obtener historial de precios de un productor
  async getHistorialPrecios(productorId: string, limit = 3) {
    const { data, error } = await supabase
      .from('lotes')
      .select('fecha_recepcion, precio_pactado_kg, peso_neto')
      .eq('productor_id', productorId)
      .not('precio_pactado_kg', 'is', null)
      .order('fecha_recepcion', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Obtener lotes recientes
  async getLotesRecientes(limit = 10) {
    const { data, error } = await supabase
      .from('lotes')
      .select(`
        id,
        numero_lote,
        fecha_recepcion,
        peso_neto,
        estado,
        es_cosecha_propia,
        productores (nombre),
        huertos (nombre)
      `)
      .order('fecha_recepcion', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Obtener lotes activos para producción (Pendientes o En Proceso)
  async getLotesActivos() {
    const { data, error } = await supabase
      .from('lotes')
      .select(`
        id,
        numero_lote,
        estado,
        es_cosecha_propia,
        productor:productores(nombre),
        huerto:huertos(nombre)
      `)
      .in('estado', ['pendiente', 'en_proceso'])
      .order('fecha_recepcion', { ascending: false });

    if (error) throw error;

    // Mapear para facilitar consumo en el componente
    return ((data || []) as LoteActivoRow[]).map(l => ({
      id: l.id,
      numero: l.numero_lote,
      productor: l.es_cosecha_propia ? l.huerto?.nombre : l.productor?.nombre,
      variedad: l.es_cosecha_propia ? 'Cosecha Propia' : 'Compra Terceros'
    }));
  },

  // Obtener presentaciones de empaque
  async getPresentaciones() {
    const { data, error } = await supabase
      .from('presentaciones')
      .select('*')
      .eq('activa', true)
      .order('nombre');

    if (error) throw error;
    return data || [];
  }
};
