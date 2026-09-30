/**
 * Reporte de descarte del módulo de Producción.
 *
 * Filas calculadas con datos reales:
 * - "Fruta a molino": kilos enviados a industria (destino `molino`).
 * - "Merma de recepción": kilos de merma estimada de los lotes que ya
 *   tienen producción registrada.
 *
 * La tendencia compara los últimos 7 días contra los 7 días previos.
 */

export type Tendencia = "Alza" | "Baja" | "Estable";

export interface RegistroDescarte {
  lote_id: string | null;
  peso_total_kg: number | null;
  created_at: string;
  destino: string | null;
  calibre: string;
}

export interface LoteDescarte {
  id: string;
  numero_lote: string;
  peso_neto: number | null;
  kilos_merma: number | null;
  fecha_recepcion?: string | null;
}

export interface FilaDescarte {
  tipo: string;
  kg: number;
  impacto: number;
  tendencia: Tendencia;
}

export interface DetalleMolino {
  fecha: string;
  lote: string;
  calibre: string;
  kg: number;
}

export interface DetalleMerma {
  lote: string;
  mermaKg: number;
  /** % de merma sobre el neto del lote. */
  pct: number;
}

export const TIPO_MOLINO = "Fruta a molino";
export const TIPO_MERMA = "Merma de recepción";

const MS_DIA = 86_400_000;
const VENTANA_DIAS = 7;

const redondear1 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 10) / 10;

const redondear2 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 100) / 100;

const aNumero = (valor: number | null | undefined): number =>
  Number.isFinite(Number(valor)) ? Number(valor) : 0;

const enRango = (fechaISO: string | null | undefined, desde: number, hasta: number): boolean => {
  if (!fechaISO) return false;
  const t = new Date(fechaISO).getTime();
  return Number.isFinite(t) && t >= desde && t < hasta;
};

function tendencia(actual: number, previo: number): Tendencia {
  if (previo <= 0) return actual > 0 ? "Alza" : "Estable";
  const cambio = ((actual - previo) / previo) * 100;
  if (cambio > 5) return "Alza";
  if (cambio < -5) return "Baja";
  return "Estable";
}

export function calcularReporteDescarte(
  registros: RegistroDescarte[],
  lotes: LoteDescarte[],
  ahora: Date = new Date()
): FilaDescarte[] {
  const filasRegistros = registros ?? [];
  const filasLotes = lotes ?? [];
  const fin = ahora.getTime();
  const inicioActual = fin - VENTANA_DIAS * MS_DIA;
  const inicioPrevio = fin - 2 * VENTANA_DIAS * MS_DIA;

  const procesadoPorLote = new Map<string, number>();
  let procesadoTotal = 0;
  for (const r of filasRegistros) {
    const kg = aNumero(r.peso_total_kg);
    procesadoTotal += kg;
    if (r.lote_id) procesadoPorLote.set(r.lote_id, (procesadoPorLote.get(r.lote_id) ?? 0) + kg);
  }

  const filas: FilaDescarte[] = [];

  // 1) Fruta enviada a molino (industria).
  const molino = filasRegistros.filter((r) => r.destino === "molino");
  const kgMolino = molino.reduce((acc, r) => acc + aNumero(r.peso_total_kg), 0);
  if (kgMolino > 0) {
    const actual = molino
      .filter((r) => enRango(r.created_at, inicioActual, fin))
      .reduce((acc, r) => acc + aNumero(r.peso_total_kg), 0);
    const previo = molino
      .filter((r) => enRango(r.created_at, inicioPrevio, inicioActual))
      .reduce((acc, r) => acc + aNumero(r.peso_total_kg), 0);
    filas.push({
      tipo: TIPO_MOLINO,
      kg: redondear2(kgMolino),
      impacto: procesadoTotal > 0 ? redondear1((kgMolino / procesadoTotal) * 100) : 0,
      tendencia: tendencia(actual, previo),
    });
  }

  // 2) Merma estimada de recepción, solo de lotes con producción.
  const conProduccion = filasLotes.filter((l) => (procesadoPorLote.get(l.id) ?? 0) > 0);
  const kgMerma = conProduccion.reduce((acc, l) => acc + aNumero(l.kilos_merma), 0);
  if (kgMerma > 0) {
    const netos = conProduccion.reduce((acc, l) => acc + aNumero(l.peso_neto), 0);
    const actual = conProduccion
      .filter((l) => enRango(l.fecha_recepcion, inicioActual, fin))
      .reduce((acc, l) => acc + aNumero(l.kilos_merma), 0);
    const previo = conProduccion
      .filter((l) => enRango(l.fecha_recepcion, inicioPrevio, inicioActual))
      .reduce((acc, l) => acc + aNumero(l.kilos_merma), 0);
    filas.push({
      tipo: TIPO_MERMA,
      kg: redondear2(kgMerma),
      impacto: netos > 0 ? redondear1((kgMerma / netos) * 100) : 0,
      tendencia: tendencia(actual, previo),
    });
  }

  return filas.sort((a, b) => b.kg - a.kg);
}

/** Registros a molino para el panel de detalle, más recientes primero. */
export function obtenerDetalleMolino(
  registros: RegistroDescarte[],
  mapaLotes: Record<string, string>
): DetalleMolino[] {
  return (registros ?? [])
    .filter((r) => r.destino === "molino")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((r) => ({
      fecha: r.created_at,
      lote: (r.lote_id && mapaLotes[r.lote_id]) || "—",
      calibre: r.calibre,
      kg: redondear2(aNumero(r.peso_total_kg)),
    }));
}

/** Lotes con merma estimada y producción, para el panel de detalle. */
export function obtenerDetalleMerma(
  lotes: LoteDescarte[],
  procesadoPorLote: Record<string, number>
): DetalleMerma[] {
  return (lotes ?? [])
    .filter((l) => (procesadoPorLote[l.id] ?? 0) > 0 && aNumero(l.kilos_merma) > 0)
    .map((l) => {
      const neto = aNumero(l.peso_neto);
      const mermaKg = aNumero(l.kilos_merma);
      return {
        lote: l.numero_lote,
        mermaKg: redondear2(mermaKg),
        pct: neto > 0 ? redondear1((mermaKg / neto) * 100) : 0,
      };
    })
    .sort((a, b) => b.mermaKg - a.mermaKg);
}

const decimalMx = (valor: number, decimales = 2): string =>
  valor.toFixed(decimales).replace(".", ",");

/** CSV compatible con Excel en español (separador `;`, BOM incluido). */
export function generarCsvDescarte(filas: FilaDescarte[]): string {
  const encabezado = "Tipo;Kilos (kg);Impacto (%);Tendencia";
  const lineas = (filas ?? []).map((f) =>
    [f.tipo, decimalMx(f.kg), decimalMx(f.impacto, 1), f.tendencia].join(";")
  );
  return `\uFEFF${[encabezado, ...lineas].join("\r\n")}\r\n`;
}
