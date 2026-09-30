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
  /** Nullable en BD (sin NOT NULL ni default). */
  fecha_ticket: string | null;
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
  /** Tasa congelada capturada en el ticket ($/kg). */
  cuota_maniobra_kg?: number | null;
  /** Importe congelado de deducción del ticket. */
  cuota_maniobra_total?: number | null;
}

export interface FilaAbono {
  productor_id: string;
  monto: number | null;
}

const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/**
 * Importe congelado de deducción de un ticket. En tickets legados sin
 * snapshot de importe se deriva de la tasa congelada (ambos del ticket).
 */
export function importeDeduccionCongelado(
  pesoNeto: number | null | undefined,
  tasaKg: number | null | undefined,
  totalSnapshot: number | null | undefined,
): number {
  return (
    num(totalSnapshot) ||
    Math.round(num(pesoNeto) * num(tasaKg) * 100) / 100
  );
}

export function productorACuenta(p: FilaProductor): ProductorCuenta {
  return { id: p.id, alias: p.alias ?? null, nombreLegal: p.nombre };
}

/** Boleta liquidable = nota CxP + datos físicos del lote. */
export function cxpYLoteABoleta(
  cxp: FilaCxp,
  lote: FilaLote | undefined,
): BoletaLiquidable & { productorId: string } {
  const kilos = num(cxp.kilos_netos);
  const tasaSnapshot = num(lote?.cuota_maniobra_kg);
  const deduccionMonto = importeDeduccionCongelado(
    kilos,
    tasaSnapshot,
    lote?.cuota_maniobra_total,
  );
  return {
    id: cxp.id,
    productorId: cxp.productor_id,
    folioBascula: lote?.folio_fisico?.trim() || cxp.numero_lote,
    fechaEntrada: cxp.fecha_ticket ?? "",
    pesoBruto: lote ? num(lote.peso_bruto) : 0,
    pesoTara: lote ? num(lote.peso_tara) : 0,
    kilosNetos: kilos,
    precioKg: num(cxp.precio_kg),
    tarifaDeduccionKg: tasaSnapshot,
    deduccionOperativaMonto: deduccionMonto,
    montoNetoTicket: num(cxp.monto_total),
    anticipos: num(lote?.anticipos),
    cuotaBascula: num(lote?.costo_bascula),
    formaPagoBascula: lote?.bascula_forma_pago === "efectivo" ? "efectivo" : "liquidacion",
  };
}

/** Fila del reporte de deducción a nivel ticket (valores del ticket). */
export interface FilaDetalleTicket {
  id: string;
  fecha: string; // ISO
  ticket: string;
  productorId: string;
  productorDisplay: string;
  kilosNetos: number;
  precioKg: number;
  subtotal: number;
  deduccion: number;
  bascula: number;
  neto: number;
}

/**
 * Detalle ticket por ticket para auditoría: une cada nota CxP con su lote
 * y lee los importes congelados (sin recalcular con tasas propias).
 */
export function construirDetalleTickets(
  cxp: FilaCxp[],
  lotes: FilaLote[],
  nombres: Record<string, string>,
): FilaDetalleTicket[] {
  const porId = new Map(lotes.map((l) => [l.id, l]));
  return cxp
    .map((n) => {
      const lote = porId.get(n.lote_id);
      const kilos = num(n.kilos_netos);
      const precio = num(n.precio_kg);
      const deduccion = importeDeduccionCongelado(
        kilos,
        lote?.cuota_maniobra_kg,
        lote?.cuota_maniobra_total,
      );
      const bascula =
        lote?.bascula_forma_pago === "efectivo" ? 0 : num(lote?.costo_bascula);
      return {
        id: n.id,
        fecha: n.fecha_ticket ?? "",
        ticket: lote?.folio_fisico?.trim() || n.numero_lote,
        productorId: n.productor_id,
        productorDisplay: nombres[n.productor_id] ?? n.productor_id,
        kilosNetos: Math.round(kilos * 100) / 100,
        precioKg: precio,
        subtotal: Math.round(kilos * precio * 100) / 100,
        deduccion,
        bascula,
        neto: num(n.monto_total),
      } satisfies FilaDetalleTicket;
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function loteAMovimiento(
  lote: FilaLote,
): MovimientoDeduccion & { folioBascula: string } {
  return {
    fecha: lote.fecha_recepcion,
    productorId: lote.productor_id ?? "",
    kilosNetos: num(lote.peso_neto),
    tasaKg: num(lote.cuota_maniobra_kg),
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
