import { supabase } from "@/integrations/supabase/client";

// Tipos para trazabilidad
export interface LoteCompleto {
  id: string;
  numero_lote: string;
  productor?: {
    id: string;
    nombre: string;
    telefono?: string;
    rfc?: string;
  } | null;
  huerto?: {
    id: string;
    nombre: string;
    ubicacion?: string;
  } | null;
  es_cosecha_propia: boolean;
  fecha_recepcion: string;
  peso_bruto: number;
  peso_tara: number;
  peso_neto: number | null;
  precio_pactado_kg: number | null;
  estado: "pendiente" | "en_proceso" | "liquidado";
  notas?: string;
}

export interface ProduccionItem {
  id: string;
  calibre: string;
  color: string;
  calidad: string;
  cantidad_cajas: number;
  peso_total_kg: number | null;
  destino: string;
  costo_fruta?: number;
  costo_insumos?: number;
  costo_total?: number;
  costo_por_caja?: number;
  presentacion?: {
    nombre: string;
    peso_kg: number;
  } | null;
}

export interface AnalisisRentabilidad {
  costoCompra: number;
  costoInsumos: number;
  costoManoObra: number;
  costoTotal: number;
  ventaEstimada: number;
  margenBruto: number;
  margenPorcentaje: number;
}

export interface EstadoVidaUtil {
  dias: number;
  estado: "optimo" | "atencion" | "urgente";
  color: string;
  emoji: string;
  label: string;
  diasRestantes: number;
}

// Obtener lote completo con relaciones
export async function getLoteCompleto(numeroLote: string): Promise<LoteCompleto | null> {
  const { data, error } = await supabase
    .from("lotes")
    .select(`
      *,
      productor:productores(id, nombre, telefono, rfc),
      huerto:huertos(id, nombre, ubicacion)
    `)
    .eq("numero_lote", numeroLote)
    .maybeSingle();

  if (error) {
    console.error("Error fetching lote:", error);
    return null;
  }

  return data as LoteCompleto | null;
}

// Obtener producción por lote
export async function getProduccionPorLote(loteId: string): Promise<ProduccionItem[]> {
  const { data, error } = await supabase
    .from("produccion")
    .select(`
      *,
      presentacion:presentaciones(nombre, peso_kg)
    `)
    .eq("lote_id", loteId);

  if (error) {
    console.error("Error fetching produccion:", error);
    return [];
  }

  return (data || []) as ProduccionItem[];
}

// Calcular análisis de rentabilidad
export function calcularRentabilidad(
  lote: LoteCompleto,
  produccion: ProduccionItem[]
): AnalisisRentabilidad {
  const totalCajas = produccion.reduce((sum, p) => sum + p.cantidad_cajas, 0);

  // Costos reales desde producción (cuando el registro ya fue costeado)
  const costoFrutaReal = produccion.reduce((sum, p) => sum + (p.costo_fruta || 0), 0);
  const costoInsumosReal = produccion.reduce((sum, p) => sum + (p.costo_insumos || 0), 0);
  const tieneCosteoReal = produccion.some((p) => (p.costo_total || 0) > 0);

  const costoCompra = tieneCosteoReal
    ? costoFrutaReal
    : (lote.peso_neto || 0) * (lote.precio_pactado_kg || 0);

  // Estimaciones basadas en producción (solo cuando no hay costeo real)
  const costoInsumos = tieneCosteoReal
    ? costoInsumosReal
    : totalCajas * 15; // $15 MXN por caja (estimado)
  const costoManoObra = totalCajas * 8; // $8 MXN por caja (estimado)
  const costoTotal = costoCompra + costoInsumos + costoManoObra;

  // Estimar venta basada en calibres (precios promedio por caja)
  const preciosPorCalibre: Record<string, number> = {
    "200": 220,
    "300": 200,
    "400": 180,
    "500": 160,
    "600": 140,
    "extras": 120,
  };

  const ventaEstimada = produccion.reduce((sum, p) => {
    const precioCaja = preciosPorCalibre[p.calibre] || 150;
    return sum + (p.cantidad_cajas * precioCaja);
  }, 0);

  const margenBruto = ventaEstimada - costoTotal;
  const margenPorcentaje = costoTotal > 0 ? (margenBruto / costoTotal) * 100 : 0;

  return {
    costoCompra,
    costoInsumos,
    costoManoObra,
    costoTotal,
    ventaEstimada,
    margenBruto,
    margenPorcentaje,
  };
}

// Calcular estado de vida útil
export function calcularEstadoVidaUtil(fechaIngreso: string | Date): EstadoVidaUtil {
  const fecha = new Date(fechaIngreso);
  const hoy = new Date();
  const diff = hoy.getTime() - fecha.getTime();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diasRestantes = Math.max(25 - dias, 0);

  if (dias <= 10) {
    return {
      dias,
      estado: "optimo",
      color: "text-success",
      emoji: "🟢",
      label: "Óptimo",
      diasRestantes,
    };
  } else if (dias <= 18) {
    return {
      dias,
      estado: "atencion",
      color: "text-warning-foreground",
      emoji: "🟡",
      label: "Atención",
      diasRestantes,
    };
  } else {
    return {
      dias,
      estado: "urgente",
      color: "text-destructive",
      emoji: "🔴",
      label: "Urgente",
      diasRestantes,
    };
  }
}

// Obtener distribución por calibre
export function getDistribucionPorCalibre(produccion: ProduccionItem[]) {
  const totalCajas = produccion.reduce((sum, p) => sum + p.cantidad_cajas, 0);
  
  const distribucion = produccion.reduce((acc, p) => {
    if (!acc[p.calibre]) {
      acc[p.calibre] = { cantidad: 0, porcentaje: 0 };
    }
    acc[p.calibre].cantidad += p.cantidad_cajas;
    return acc;
  }, {} as Record<string, { cantidad: number; porcentaje: number }>);

  // Calcular porcentajes
  Object.keys(distribucion).forEach(calibre => {
    distribucion[calibre].porcentaje = 
      totalCajas > 0 ? (distribucion[calibre].cantidad / totalCajas) * 100 : 0;
  });

  return { distribucion, totalCajas };
}

// Obtener stock en cámara fría por lote
export async function getStockCamaraFria(loteId: string) {
  const { data, error } = await supabase
    .from("camara_fria")
    .select(`
      *,
      produccion(calibre, color, calidad)
    `)
    .eq("produccion.lote_id", loteId);

  if (error) {
    console.error("Error fetching camara fria:", error);
    return [];
  }

  return data || [];
}
