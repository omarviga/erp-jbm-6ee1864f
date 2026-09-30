// Sincronización de saldos de productores — JBM Cítricos ERP.
// Se ejecuta cada vez que se crea una liquidación, se inserta un abono
// o se anula un registro, para recalcular las cuentas por pagar globales.
//
// La app invoca syncProductorSaldoPendiente con las cuentas ya consultadas
// (CxP, anticipos vivos, liquidaciones parciales); el SQL de soporte vive en
// supabase/migrations/20261001090000_liquidaciones_alias_y_abonos.sql.

import { redondear2 } from "../recepcion/calculos";

export interface CuentasProductor {
  /** Suma de CxP pendientes del productor (notas no liquidadas). */
  cxpPendiente: number;
  /** Anticipos otorgados aún no amortizados (reducen el exigible). */
  anticiposVivos: number;
  /** Saldo pendiente de liquidaciones en estado parcial. */
  liquidacionesParciales: number;
}

/** Cuenta por pagar global = CxP + parciales − anticipos vivos (piso 0). */
export function recalcularSaldoProductor(c: CuentasProductor): number {
  return Math.max(
    0,
    redondear2(c.cxpPendiente + c.liquidacionesParciales - c.anticiposVivos),
  );
}

/** Subconjunto estructural del cliente Supabase (sin importar la lib). */
export interface DbWriter {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: unknown): Promise<{ error: unknown }>;
    };
  };
}

export async function syncProductorSaldoPendiente(
  db: DbWriter,
  productorId: string,
  cuentas: CuentasProductor,
): Promise<number> {
  const saldo = recalcularSaldoProductor(cuentas);
  const { error } = await db
    .from("productores")
    .update({ saldo_pendiente: saldo })
    .eq("id", productorId);
  if (error) throw error;
  return saldo;
}
