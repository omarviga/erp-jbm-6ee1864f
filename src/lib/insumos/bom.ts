// Motor de consumo de insumos (BOM) — JBM ERP.
//
// Calcula los materiales a descontar del almacén por corrida de empaque,
// la capacidad máxima según existencias (cuello de botella) y los costos
// financieros. Lógica pura, sin dependencias de UI ni de red.
//
// Fuentes: factores oficiales de estiba por presentación (docs/BOM_RULE.md)
// y tasa de encerado 0.5 L / 1000 kg de fruta.

export type CodigoPresentacion =
  | "exp-18"
  | "master-15"
  | "nac-20"
  | "arpilla-25"
  | "gourmet-45";

export type CodigoMaterial =
  | "envase"
  | "tarimas"
  | "esquineros"
  | "grapas"
  | "plu"
  | "senasica"
  | "cera"
  | "papel";

export interface FactorPresentacion {
  codigo: CodigoPresentacion;
  nombre: string;
  pesoKg: number;
  boxesPerPallet: number;
  encerado: boolean;
  papelEncerado: boolean;
  /** Bucket de stock del envase primario (tipo de insumo). */
  envaseTipo: "caja_carton" | "caja_plastica" | "arpilla";
  envaseEtiqueta: string;
}

/** Litros de cera por kilo de fruta (0.5 L / 1000 kg). */
export const CERA_LITROS_POR_KG = 0.0005;
/** Litros por tambo de control de inventario. */
export const LITROS_POR_TAMBO = 200;

export const PRESENTACIONES_BOM: FactorPresentacion[] = [
  {
    codigo: "exp-18",
    nombre: "Caja Exportación 18.14 kg (40 lbs)",
    pesoKg: 18.14,
    boxesPerPallet: 54,
    encerado: true,
    papelEncerado: true,
    envaseTipo: "caja_carton",
    envaseEtiqueta: "Cajas de cartón",
  },
  {
    codigo: "master-15",
    nombre: "Caja Exportación Master 15 kg",
    pesoKg: 15,
    boxesPerPallet: 60,
    encerado: true,
    papelEncerado: false,
    envaseTipo: "caja_carton",
    envaseEtiqueta: "Cajas de cartón",
  },
  {
    codigo: "nac-20",
    nombre: "Caja Nacional 20 kg",
    pesoKg: 20,
    boxesPerPallet: 48,
    encerado: false,
    papelEncerado: false,
    envaseTipo: "caja_plastica",
    envaseEtiqueta: "Cajas plásticas",
  },
  {
    codigo: "arpilla-25",
    nombre: "Arpilla / Malla 25 kg",
    pesoKg: 25,
    boxesPerPallet: 40,
    encerado: false,
    papelEncerado: false,
    envaseTipo: "arpilla",
    envaseEtiqueta: "Arpillas / mallas",
  },
  {
    codigo: "gourmet-45",
    nombre: "Caja Telescópica 4.5 kg Gourmet",
    pesoKg: 4.5,
    boxesPerPallet: 120,
    encerado: true,
    papelEncerado: true,
    envaseTipo: "caja_carton",
    envaseEtiqueta: "Cajas de cartón",
  },
];

/** Calibres grandes → PLU #4048; estándar/medianos → #4045. */
export function etiquetaPluParaCalibre(calibre: string): "4048" | "4045" {
  const c = calibre.trim().toUpperCase();
  return c === "V-X" || c === "V-XX" || c === "V-XXX" ? "4048" : "4045";
}

export interface LineaConsumo {
  material: CodigoMaterial;
  etiqueta: string;
  unidad: string;
  /** Consumo total de la corrida (unidades del material). */
  cantidad: number;
  /** Tasa marginal por caja (para capacidad; fraccionaria si aplica). */
  porCaja: number;
  /** False cuando la presentación no usa este material. */
  aplica: boolean;
}

export interface ResultadoSimulacion {
  presentacion: FactorPresentacion;
  boxes: number;
  calibre: string;
  plu: "4048" | "4045";
  frutaKg: number;
  lineas: LineaConsumo[];
  /** Consumo de cera expresado en tambos de 200 L. */
  ceraTambos: number;
}

/** Consumo exacto de materiales para una corrida (sin redondear). */
export function simularCorrida(
  codigo: CodigoPresentacion,
  boxes: number,
  calibre: string,
): ResultadoSimulacion {
  const p = PRESENTACIONES_BOM.find((f) => f.codigo === codigo);
  if (!p) throw new Error(`Presentación desconocida: ${codigo}`);
  const n = Math.max(0, Math.floor(boxes));
  const frutaKg = n * p.pesoKg;
  const tarimas = Math.ceil(n / p.boxesPerPallet);
  const ceraLitros = frutaKg * CERA_LITROS_POR_KG;
  const linea = (
    material: CodigoMaterial,
    etiqueta: string,
    unidad: string,
    cantidad: number,
    porCaja: number,
    aplica = true,
  ): LineaConsumo => ({ material, etiqueta, unidad, cantidad, porCaja, aplica });
  return {
    presentacion: p,
    boxes: n,
    calibre,
    plu: etiquetaPluParaCalibre(calibre),
    frutaKg,
    ceraTambos: ceraLitros / LITROS_POR_TAMBO,
    lineas: [
      linea("envase", p.envaseEtiqueta, "pzas", n, 1),
      linea("tarimas", "Tarimas HT", "pzas", tarimas, 1 / p.boxesPerPallet),
      linea("esquineros", "Esquineros", "pzas", tarimas * 4, 4 / p.boxesPerPallet),
      linea("grapas", "Grapas / sellos", "pzas", tarimas * 4, 4 / p.boxesPerPallet),
      linea("plu", "Etiqueta PLU", "pzas", n, 1),
      linea("senasica", "Etiqueta SENASICA / QR", "pzas", n, 1),
      linea("cera", "Cera carnauba", "L", p.encerado ? ceraLitros : 0, p.encerado ? p.pesoKg * CERA_LITROS_POR_KG : 0, p.encerado),
      linea("papel", "Papel encerado", "pzas", p.papelEncerado ? n : 0, p.papelEncerado ? 1 : 0, p.papelEncerado),
    ],
  };
}

export interface CapacidadMaterial {
  material: CodigoMaterial;
  /** null = no aplica a la presentación o no hay dato de stock. */
  maxCajas: number | null;
}

export interface CapacidadSimulacion {
  /** null = ningún material limita (sin datos de stock). */
  maxCajas: number | null;
  limitante: CodigoMaterial | null;
  porMaterial: CapacidadMaterial[];
}

/** Cajas producibles con el stock dado; el mínimo es el cuello de botella. */
export function calcularCapacidad(
  lineas: LineaConsumo[],
  stock: Partial<Record<CodigoMaterial, number>>,
): CapacidadSimulacion {
  const porMaterial: CapacidadMaterial[] = lineas.map((l) => {
    const s = stock[l.material];
    if (!l.aplica || l.porCaja <= 0 || s === undefined || s === null) {
      return { material: l.material, maxCajas: null };
    }
    return { material: l.material, maxCajas: Math.floor(s / l.porCaja) };
  });
  const limitadas = porMaterial.filter(
    (p): p is CapacidadMaterial & { maxCajas: number } => p.maxCajas !== null,
  );
  if (limitadas.length === 0) {
    return { maxCajas: null, limitante: null, porMaterial };
  }
  const peor = limitadas.reduce((a, b) => (b.maxCajas < a.maxCajas ? b : a));
  return { maxCajas: peor.maxCajas, limitante: peor.material, porMaterial };
}

export interface CostosCorrida {
  total: number;
  porCaja: number;
  porKilo: number;
  /** Materiales sin costo capturado (se valúan en 0). */
  sinCosto: CodigoMaterial[];
}

/** Costo de insumos de la corrida desde costos unitarios por material. */
export function calcularCostos(
  lineas: LineaConsumo[],
  boxes: number,
  frutaKg: number,
  costos: Partial<Record<CodigoMaterial, number>>,
): CostosCorrida {
  const sinCosto: CodigoMaterial[] = [];
  let total = 0;
  for (const l of lineas) {
    if (!l.aplica || l.cantidad <= 0) continue;
    const c = costos[l.material];
    if (c === undefined || c === null) {
      sinCosto.push(l.material);
      continue;
    }
    total += l.cantidad * c;
  }
  return {
    total,
    porCaja: boxes > 0 ? total / boxes : 0,
    porKilo: frutaKg > 0 ? total / frutaKg : 0,
    sinCosto,
  };
}

export interface StockBucket {
  stock: number;
  /** Costo unitario ponderado por existencia. */
  costo: number;
}

/** Agrupa renglones de inventario por tipo crudo de insumo. */
export function agruparStockPorTipo(
  rows: { tipo: string; stock: number; costo: number }[],
): Record<string, StockBucket> {
  const acc: Record<string, { stock: number; valor: number }> = {};
  for (const r of rows) {
    const cur = acc[r.tipo] ?? { stock: 0, valor: 0 };
    cur.stock += r.stock;
    cur.valor += r.stock * r.costo;
    acc[r.tipo] = cur;
  }
  const out: Record<string, StockBucket> = {};
  for (const [tipo, v] of Object.entries(acc)) {
    out[tipo] = { stock: v.stock, costo: v.stock > 0 ? v.valor / v.stock : 0 };
  }
  return out;
}
