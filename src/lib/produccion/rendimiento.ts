/**
 * Rastreador de rendimiento por lote (ProductionBatchYieldTracker).
 *
 * Balance porcentual de lo procesado por calidad (primera = verde
 * exportación, segunda = alimonado nacional, industria = amarillo molino),
 * semáforo de huerta y costo real por caja desde los costos del RPC.
 */

/** Calidad mínima de verde para cada nivel (fracción 0-1). Configurable. */
export const UMBRAL_EXCELENTE = 0.7;
export const UMBRAL_BUENO = 0.5;
export const UMBRAL_REGULAR = 0.3;

export type NivelSemaforo = "excelente" | "bueno" | "regular" | "critico";

export interface RegistroRendimiento {
  lote_id: string | null;
  peso_total_kg: number | null;
  calidad?: string | null;
  costo_fruta?: number | null;
  costo_insumos?: number | null;
  costo_total?: number | null;
  cantidad_cajas?: number | null;
}

export interface RendimientoLote {
  totalKg: number;
  verdeKg: number;
  alimonadoKg: number;
  amarilloKg: number;
  pctVerde: number;
  pctAlimonado: number;
  pctAmarillo: number;
  /** % del neto del lote ya procesado. */
  avance: number;
  cajas: number;
  costoFruta: number;
  costoInsumos: number;
  costoTotal: number;
  costoPorCaja: number;
  semaforo: NivelSemaforo;
}

export interface OpcionLoteRendimiento {
  id: string;
  numero: string;
}

const redondear1 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 10) / 10;

const redondear2 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 100) / 100;

const aNumero = (valor: number | null | undefined): number =>
  Number.isFinite(Number(valor)) ? Number(valor) : 0;

export function obtenerSemaforo(pctVerde: number): NivelSemaforo {
  const p = Number.isFinite(pctVerde) ? pctVerde : 0;
  if (p >= UMBRAL_EXCELENTE * 100) return "excelente";
  if (p >= UMBRAL_BUENO * 100) return "bueno";
  if (p >= UMBRAL_REGULAR * 100) return "regular";
  return "critico";
}

export const ETIQUETA_SEMAFORO: Record<NivelSemaforo, string> = {
  excelente: "Excelente",
  bueno: "Bueno",
  regular: "Regular",
  critico: "Crítico",
};

export function calcularRendimientoLote(
  registros: RegistroRendimiento[],
  pesoNeto: number
): RendimientoLote {
  const filas = (registros ?? []).filter((r) => aNumero(r.peso_total_kg) > 0);

  let verdeKg = 0;
  let alimonadoKg = 0;
  let amarilloKg = 0;
  let costoFruta = 0;
  let costoInsumos = 0;
  let costoTotal = 0;
  let cajas = 0;

  for (const r of filas) {
    const kg = aNumero(r.peso_total_kg);
    if (r.calidad === "primera") verdeKg += kg;
    else if (r.calidad === "segunda") alimonadoKg += kg;
    else if (r.calidad === "industria") amarilloKg += kg;
    costoFruta += aNumero(r.costo_fruta);
    costoInsumos += aNumero(r.costo_insumos);
    costoTotal += aNumero(r.costo_total);
    cajas += Math.trunc(aNumero(r.cantidad_cajas));
  }

  const totalKg = redondear2(verdeKg + alimonadoKg + amarilloKg);
  const neto = aNumero(pesoNeto);

  const pctVerde = totalKg > 0 ? redondear1((verdeKg / totalKg) * 100) : 0;
  const pctAlimonado = totalKg > 0 ? redondear1((alimonadoKg / totalKg) * 100) : 0;
  const pctAmarillo = totalKg > 0 ? redondear1((amarilloKg / totalKg) * 100) : 0;

  return {
    totalKg,
    verdeKg: redondear2(verdeKg),
    alimonadoKg: redondear2(alimonadoKg),
    amarilloKg: redondear2(amarilloKg),
    pctVerde,
    pctAlimonado,
    pctAmarillo,
    avance: neto > 0 ? Math.min(100, redondear1((totalKg / neto) * 100)) : 0,
    cajas,
    costoFruta: redondear2(costoFruta),
    costoInsumos: redondear2(costoInsumos),
    costoTotal: redondear2(costoTotal),
    costoPorCaja: cajas > 0 ? redondear2(costoTotal / cajas) : 0,
    semaforo: obtenerSemaforo(pctVerde),
  };
}

/** Lotes con producción registrada, para el selector de rendimiento. */
export function listarLotesConProduccion(
  registros: RegistroRendimiento[],
  mapaLotes: Record<string, string>
): OpcionLoteRendimiento[] {
  const vistos = new Map<string, string>();
  for (const r of registros ?? []) {
    if (r.lote_id && !vistos.has(r.lote_id)) {
      vistos.set(r.lote_id, mapaLotes[r.lote_id] ?? r.lote_id);
    }
  }
  return [...vistos.entries()]
    .map(([id, numero]) => ({ id, numero }))
    .sort((a, b) => a.numero.localeCompare(b.numero));
}
