import type {
  BoletaLiquidable,
  EstadoLiquidacion,
  MetodoAbono,
  TotalesLiquidacion,
} from "../../lib/finanzas/calculos";

export type {
  BoletaLiquidable,
  EstadoLiquidacion,
  MetodoAbono,
  TotalesLiquidacion,
};

/** Cuenta corriente del productor para mesa de control y auxiliar. */
export interface ProductorCuenta {
  id: string;
  alias?: string | null;
  nombreLegal: string;
  localidad?: string | null;
}

/** Abono (pago parcial o combinado) aplicado a una liquidación. */
export interface Abono {
  id: string;
  metodo: MetodoAbono;
  referencia: string;
  importe: number;
  fecha: string; // ISO
}

/** Liquidación emitida con sus boletas, totales y abonos. */
export interface Liquidacion {
  id: string;
  folio: string;
  fecha: string; // ISO
  productor: ProductorCuenta;
  boletas: BoletaLiquidable[];
  totales: TotalesLiquidacion;
  abonos: Abono[];
}

export interface CuentaCorrienteProductor {
  productor: ProductorCuenta;
  kilosEntregados: number;
  precioPromedio: number;
  pagosDispersados: number;
  porLiquidar: number;
  nBoletasPendientes: number;
}

export const ETIQUETA_METODO: Record<MetodoAbono, string> = {
  cheque: "Cheque",
  efectivo: "Efectivo",
  spei: "Transferencia SPEI",
};

export const ETIQUETA_ESTADO: Record<EstadoLiquidacion, string> = {
  parcial: "PARCIAL",
  pagada: "PAGADA",
};
