import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const CAJAS_POR_PALLET = 56;
type TipoInsumo = Database["public"]["Enums"]["tipo_insumo"];

// Insumos que se descuentan automáticamente por cada registro de producción
// tipo_insumo → cantidad por unidad base
interface InsumoRule {
  tipo: TipoInsumo;
  /** 'por_pallet' | 'por_caja' */
  base: "por_pallet" | "por_caja";
  /** Cuántas unidades del insumo se consumen por cada unidad base */
  cantidadPorUnidad: number;
}

const REGLAS_INSUMOS: InsumoRule[] = [
  { tipo: "tarima", base: "por_pallet", cantidadPorUnidad: 1 },
  { tipo: "fleje", base: "por_pallet", cantidadPorUnidad: 4 }, // 4 flejes por pallet
  { tipo: "esquinero", base: "por_pallet", cantidadPorUnidad: 4 }, // 4 esquineros por pallet
  { tipo: "cera", base: "por_caja", cantidadPorUnidad: 1 }, // 1 tote/aplicación por caja
];

export interface DeduccionResult {
  insumoNombre: string;
  tipo: TipoInsumo;
  cantidadDescontada: number;
  stockAnterior: number;
  stockNuevo: number;
  error?: string;
}

/**
 * Descuenta insumos automáticamente al registrar producción.
 * - Tarimas: 1 por cada 56 cajas (redondeado arriba)
 * - Flejes: 4 por pallet
 * - Esquineros: 4 por pallet
 * - Cera: 1 por caja
 *
 * @param cantidadCajas Número de cajas empacadas
 * @param calidad 'primera' = exportación, 'segunda' = nacional, 'industria' = sin paletizado
 * @param referenciaLote Número de lote para referencia en movimientos
 */
export async function descontarInsumosPorProduccion(
  cantidadCajas: number,
  calidad: string,
  referenciaLote: string
): Promise<DeduccionResult[]> {
  // Industria (molino) no consume insumos de empaque
  if (calidad === "industria" || cantidadCajas <= 0) {
    return [];
  }

  const pallets = Math.ceil(cantidadCajas / CAJAS_POR_PALLET);
  const resultados: DeduccionResult[] = [];

  // Obtener todos los insumos de los tipos que necesitamos
  const tiposNecesarios = REGLAS_INSUMOS.map((r) => r.tipo);
  const { data: insumos, error: fetchError } = await supabase
    .from("insumos")
    .select("id, nombre, tipo, cantidad_disponible")
    .in("tipo", tiposNecesarios);

  if (fetchError) {
    console.error("Error al obtener insumos:", fetchError);
    return [];
  }

  // Agrupar insumos por tipo (puede haber varios del mismo tipo)
  const insumoPorTipo: Record<string, typeof insumos> = {};
  for (const insumo of insumos || []) {
    if (!insumoPorTipo[insumo.tipo]) {
      insumoPorTipo[insumo.tipo] = [];
    }
    insumoPorTipo[insumo.tipo].push(insumo);
  }

  for (const regla of REGLAS_INSUMOS) {
    const insumosDelTipo = insumoPorTipo[regla.tipo];
    if (!insumosDelTipo || insumosDelTipo.length === 0) {
      resultados.push({
        insumoNombre: regla.tipo,
        tipo: regla.tipo,
        cantidadDescontada: 0,
        stockAnterior: 0,
        stockNuevo: 0,
        error: `No se encontró insumo de tipo "${regla.tipo}"`,
      });
      continue;
    }

    // Usar el primer insumo del tipo con stock disponible
    const insumo = insumosDelTipo.find((i) => i.cantidad_disponible > 0) || insumosDelTipo[0];

    const cantidadBase = regla.base === "por_pallet" ? pallets : cantidadCajas;
    const cantidadDescontar = cantidadBase * regla.cantidadPorUnidad;

    const stockAnterior = insumo.cantidad_disponible;
    const stockNuevo = Math.max(0, stockAnterior - cantidadDescontar);

    // Actualizar stock
    const { error: updateError } = await supabase
      .from("insumos")
      .update({ cantidad_disponible: stockNuevo })
      .eq("id", insumo.id);

    if (updateError) {
      resultados.push({
        insumoNombre: insumo.nombre,
        tipo: regla.tipo,
        cantidadDescontada: 0,
        stockAnterior,
        stockNuevo: stockAnterior,
        error: updateError.message,
      });
      continue;
    }

    // Registrar movimiento
    await supabase.from("insumo_movimientos").insert({
      insumo_id: insumo.id,
      tipo_movimiento: "salida",
      cantidad: cantidadDescontar,
      referencia: `PROD-AUTO: ${referenciaLote} (${cantidadCajas} cajas, ${pallets} pallets, ${calidad === "primera" ? "Exportación" : "Nacional"})`,
    });

    resultados.push({
      insumoNombre: insumo.nombre,
      tipo: regla.tipo,
      cantidadDescontada: cantidadDescontar,
      stockAnterior,
      stockNuevo,
    });
  }

  return resultados;
}
