/**
 * KPIs reales del módulo de Producción.
 *
 * Cálculos puros sobre los registros de `produccion` y los lotes activos:
 * - eficiencia: % de los kilos netos de lotes activos ya procesados.
 * - merma: % de lo procesado que se envió a molino (industria).
 * - produccionHoy: kilos procesados en el día local actual.
 */

export interface RegistroProduccionKpi {
  lote_id: string | null;
  peso_total_kg: number | null;
  created_at: string;
  destino: string | null;
  calibre: string;
  color: string;
  cantidad_cajas: number;
  calidad?: string | null;
  costo_fruta?: number | null;
  costo_insumos?: number | null;
  costo_total?: number | null;
}

export interface LoteParaKpi {
  id: string;
  peso_neto: number | null;
}

export interface KpisProduccion {
  /** % de kilos netos de lotes activos ya procesados (0-100). */
  eficiencia: number;
  /** % de lo procesado enviado a molino (0-100). */
  merma: number;
  /** Kilos procesados hoy (día local). */
  produccionHoy: number;
}

export interface UltimoRegistro {
  calibre: string;
  color: string;
  qty: number;
}

export const redondear1 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 10) / 10;

const redondear2 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 100) / 100;

const pesoDe = (registro: RegistroProduccionKpi): number =>
  Number.isFinite(Number(registro.peso_total_kg))
    ? Number(registro.peso_total_kg)
    : 0;

export function esHoy(fechaISO: string, ahora: Date = new Date()): boolean {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return false;
  return (
    fecha.getFullYear() === ahora.getFullYear() &&
    fecha.getMonth() === ahora.getMonth() &&
    fecha.getDate() === ahora.getDate()
  );
}

export function calcularKpisProduccion(
  registros: RegistroProduccionKpi[],
  lotes: LoteParaKpi[],
  ahora: Date = new Date()
): KpisProduccion {
  const filas = registros ?? [];

  const kilosProcesados = filas.reduce((acc, r) => acc + pesoDe(r), 0);
  const kilosMolino = filas
    .filter((r) => r.destino === "molino")
    .reduce((acc, r) => acc + pesoDe(r), 0);
  const kilosHoy = filas
    .filter((r) => esHoy(r.created_at, ahora))
    .reduce((acc, r) => acc + pesoDe(r), 0);

  const kilosNetos = (lotes ?? []).reduce(
    (acc, l) =>
      acc + (Number.isFinite(Number(l.peso_neto)) ? Number(l.peso_neto) : 0),
    0
  );

  return {
    eficiencia:
      kilosNetos > 0
        ? Math.min(100, redondear1((kilosProcesados / kilosNetos) * 100))
        : 0,
    merma:
      kilosProcesados > 0
        ? Math.min(100, redondear1((kilosMolino / kilosProcesados) * 100))
        : 0,
    produccionHoy: redondear2(kilosHoy),
  };
}

/** Últimos registros de producción, más recientes primero. */
export function obtenerUltimosRegistros(
  registros: RegistroProduccionKpi[],
  limite = 5
): UltimoRegistro[] {
  return [...(registros ?? [])]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, Math.max(0, limite))
    .map((r) => ({
      calibre: r.calibre,
      color: r.color,
      qty: Number.isFinite(Number(r.cantidad_cajas))
        ? Number(r.cantidad_cajas)
        : 0,
    }));
}
