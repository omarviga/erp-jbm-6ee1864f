import type {
  BoletaLiquidable,
  MovimientoDeduccion,
} from "./calculos";
import type {
  CuentaCorrienteProductor,
  ProductorCuenta,
} from "../../components/finanzas/types";

/** Filas mínimas (subconjunto de Database Row) para mapeo puro y testeable. */
export interface FilaProductor {
  id: string;
  nombre: string;
  alias?: string | null;
}

export interface FilaCxp {
  id: string;
  productor_id: string;
  lote_id: string;
  numero_lote: string;
  fecha_ticket: string;
  kilos_netos: number | null;
  precio_kg: number | null;
  monto_total: number | null;
  monto_pagado: number | null;
  saldo_pendiente: number | null;
}

export interface FilaLote {
  id: string;
  productor_id: string | null;
  folio_fisico: string | null;
  fecha_recepcion: string;
  peso_bruto: number;
  peso_tara: number;
  peso_neto: number | null;
  costo_bascula: number | null;
  bascula_forma_pago: string;
  anticipos?: number | null;
}

export interface FilaAbono {
  productor_id: string;
  monto: number | null;
}

const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export function productorACuenta(p: FilaProductor): ProductorCuenta {
  return { id: p.id, alias: p.alias ?? null, nombreLegal: p.nombre };
}

/** Boleta liquidable = nota CxP + datos físicos del lote. */
export function cxpYLoteABoleta(
  cxp: FilaCxp,
  lote: FilaLote | undefined,
): BoletaLiquidable & { productorId: string } {
  return {
    id: cxp.id,
    productorId: cxp.productor_id,
    folioBascula: lote?.folio_fisico?.trim() || cxp.numero_lote,
    fechaEntrada: cxp.fecha_ticket,
    pesoBruto: lote ? num(lote.peso_bruto) : 0,
    pesoTara: lote ? num(lote.peso_tara) : 0,
    kilosNetos: num(cxp.kilos_netos),
    precioKg: num(cxp.precio_kg),
    anticipos: num(lote?.anticipos),
    cuotaBascula: num(lote?.costo_bascula),
    formaPagoBascula: lote?.bascula_forma_pago === "efectivo" ? "efectivo" : "liquidacion",
  };
}

export function loteAMovimiento(
  lote: FilaLote,
): MovimientoDeduccion & { folioBascula: string } {
  return {
    fecha: lote.fecha_recepcion,
    productorId: lote.productor_id ?? "",
    kilosNetos: num(lote.peso_neto),
    folioBascula: lote.folio_fisico ?? "",
  };
}

/** Cuentas corrientes agregadas por productor (auxiliar contable). */
export function construirCuentasCorrientes(
  productores: FilaProductor[],
  cxp: FilaCxp[],
  abonos: FilaAbono[],
): CuentaCorrienteProductor[] {
  return productores.map((p) => {
    const notas = cxp.filter((n) => n.productor_id === p.id);
    const kilos = notas.reduce((s, n) => s + num(n.kilos_netos), 0);
    const importe = notas.reduce((s, n) => s + num(n.monto_total), 0);
    return {
      productor: productorACuenta(p),
      kilosEntregados: Math.round(kilos * 100) / 100,
      precioPromedio: kilos > 0 ? Math.round((importe / kilos) * 100) / 100 : 0,
      pagosDispersados:
        Math.round(
          abonos.filter((a) => a.productor_id === p.id).reduce((s, a) => s + num(a.monto), 0) * 100,
        ) / 100,
      porLiquidar:
        Math.round(notas.reduce((s, n) => s + num(n.saldo_pendiente), 0) * 100) / 100,
      nBoletasPendientes: notas.filter((n) => num(n.saldo_pendiente) > 0.009).length,
    };
  });
}
