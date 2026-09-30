// Lógica pura del Módulo de Finanzas y Liquidaciones — JBM Cítricos ERP.
// Sin dependencias de UI: reutilizable en mesa de control, reportes y tests.
//
// Reglas de negocio:
// - Deducción operativa fija: $30.00 MXN por boleta procesada, automática.
// - Provisión operativa JBM: $0.04/kg sobre kilos netos.
// - Ambas se desglosan por separado y NUNCA se mezclan con cargos de báscula.
// - Anticipos de campo/tolva se amortizan antes de liberar remanente.
// - Una liquidación es PARCIAL hasta que el saldo llega exactamente a $0.00.

import { redondear2 } from "../recepcion/calculos";

/** Descuento fijo e inamovible por ticket/boleta procesada (MXN). */
export const DEDUCCION_OPERATIVA_POR_BOLETA = 30;
/** Provisión operativa JBM por kilo neto (MXN/kg). */
export const PROVISION_OPERATIVA_POR_KG = 0.04;

export type EstadoLiquidacion = "parcial" | "pagada";
export type MetodoAbono = "cheque" | "efectivo" | "spei";

/** Boleta/nota de báscula pendiente de pago (vista para liquidación). */
export interface BoletaLiquidable {
  id: string;
  folioBascula: string;
  fechaEntrada: string; // ISO
  pesoBruto: number;
  pesoTara: number;
  kilosNetos: number;
  precioKg: number;
  /** Anticipos de campo/tolva vinculados al lote. */
  anticipos: number;
  cuotaBascula: number;
  formaPagoBascula: "liquidacion" | "efectivo";
}

export interface DesgloseBoleta {
  subtotalFruta: number;
  descuentoBascula: number;
  deduccionOperativaFija: number;
  provisionOperativa: number;
  anticipos: number;
  saldoNeto: number;
}

export interface TotalesLiquidacion {
  nBoletas: number;
  kilosNetos: number;
  /** Precio pactado promedio ponderado por kilo (subtotal ÷ kilos). */
  precioPromedio: number;
  subtotalFruta: number;
  anticipos: number;
  deduccionBascula: number;
  deduccionOperativaFija: number;
  provisionOperativa: number;
  totalNeto: number;
}

/** Saldo neto de una boleta con todas las deducciones aplicadas. */
export function calcularDesgloseBoleta(b: BoletaLiquidable): DesgloseBoleta {
  const subtotalFruta = redondear2(b.kilosNetos * b.precioKg);
  const descuentoBascula =
    b.formaPagoBascula === "liquidacion" ? redondear2(b.cuotaBascula) : 0;
  const deduccionOperativaFija = DEDUCCION_OPERATIVA_POR_BOLETA;
  const provisionOperativa = redondear2(
    b.kilosNetos * PROVISION_OPERATIVA_POR_KG,
  );
  const anticipos = redondear2(b.anticipos);
  const saldoNeto = redondear2(
    subtotalFruta -
      anticipos -
      descuentoBascula -
      deduccionOperativaFija -
      provisionOperativa,
  );
  return {
    subtotalFruta,
    descuentoBascula,
    deduccionOperativaFija,
    provisionOperativa,
    anticipos,
    saldoNeto,
  };
}

/** Totales acumulados de un conjunto de boletas seleccionadas. */
export function calcularTotalesLiquidacion(
  boletas: BoletaLiquidable[],
): TotalesLiquidacion {
  const acc: TotalesLiquidacion = {
    nBoletas: boletas.length,
    kilosNetos: 0,
    precioPromedio: 0,
    subtotalFruta: 0,
    anticipos: 0,
    deduccionBascula: 0,
    deduccionOperativaFija: 0,
    provisionOperativa: 0,
    totalNeto: 0,
  };
  for (const b of boletas) {
    const d = calcularDesgloseBoleta(b);
    acc.kilosNetos = redondear2(acc.kilosNetos + b.kilosNetos);
    acc.subtotalFruta = redondear2(acc.subtotalFruta + d.subtotalFruta);
    acc.anticipos = redondear2(acc.anticipos + d.anticipos);
    acc.deduccionBascula = redondear2(
      acc.deduccionBascula + d.descuentoBascula,
    );
    acc.deduccionOperativaFija = redondear2(
      acc.deduccionOperativaFija + d.deduccionOperativaFija,
    );
    acc.provisionOperativa = redondear2(
      acc.provisionOperativa + d.provisionOperativa,
    );
  }
  acc.totalNeto = redondear2(
    acc.subtotalFruta -
      acc.anticipos -
      acc.deduccionBascula -
      acc.deduccionOperativaFija -
      acc.provisionOperativa,
  );
  acc.precioPromedio =
    acc.kilosNetos > 0 ? redondear2(acc.subtotalFruta / acc.kilosNetos) : 0;
  return acc;
}

export interface AbonoRegistrado {
  importe: number;
}

/** Compara en centavos para exigir el $0.00 exacto sin ruido flotante. */
function aCentavos(n: number): number {
  return Math.round(n * 100);
}

export function calcularSaldoLiquidacion(
  totalNeto: number,
  abonos: AbonoRegistrado[],
): { abonado: number; saldo: number; estado: EstadoLiquidacion } {
  const abonado = redondear2(abonos.reduce((s, a) => s + a.importe, 0));
  const saldo = redondear2(totalNeto - abonado);
  const estado: EstadoLiquidacion =
    aCentavos(saldo) <= 0 ? "pagada" : "parcial";
  return { abonado, saldo: Math.max(0, saldo), estado };
}

export type CodigoErrorAbono =
  | "IMPORTE_INVALIDO"
  | "IMPORTE_EXCEDE_SALDO"
  | "REFERENCIA_REQUERIDA";

export interface ErrorAbono {
  codigo: CodigoErrorAbono;
  mensaje: string;
}

/**
 * Valida un abono: importe > 0, sin exceder el saldo pendiente,
 * y folio/referencia obligatorio cuando el método es cheque.
 */
export function validarAbono(args: {
  importe: number;
  saldoPendiente: number;
  metodo: MetodoAbono;
  referencia: string;
}): ErrorAbono[] {
  const errores: ErrorAbono[] = [];
  if (!(args.importe > 0)) {
    errores.push({
      codigo: "IMPORTE_INVALIDO",
      mensaje: "El importe del abono debe ser mayor a $0.00.",
    });
  } else if (aCentavos(args.importe) > aCentavos(args.saldoPendiente)) {
    errores.push({
      codigo: "IMPORTE_EXCEDE_SALDO",
      mensaje: "El importe no puede exceder el saldo pendiente.",
    });
  }
  if (args.metodo === "cheque" && !args.referencia.trim()) {
    errores.push({
      codigo: "REFERENCIA_REQUERIDA",
      mensaje: "El número de folio / referencia del cheque es obligatorio.",
    });
  }
  return errores;
}

// ---------------------------------------------------------------------------
// Búsqueda por alias
// ---------------------------------------------------------------------------

export interface ProductorBuscable {
  id: string;
  alias?: string | null;
  nombreLegal: string;
}

/** "Nombre Legal ("Alias")" para pantalla y boleta oficial. */
export function nombreProductorDisplay(p: ProductorBuscable): string {
  const alias = p.alias?.trim();
  return alias ? `${p.nombreLegal} ("${alias}")` : p.nombreLegal;
}

/** Localiza productores por alias o nombre legal (insensible a caso). */
export function buscarProductores<T extends ProductorBuscable>(
  productores: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return productores;
  return productores.filter((p) =>
    `${p.alias ?? ""} ${p.nombreLegal}`.toLowerCase().includes(q),
  );
}

// ---------------------------------------------------------------------------
// Periodos del reporte de deducción operativa
// ---------------------------------------------------------------------------

export type ModoPeriodo = "diario" | "semanal" | "quincenal" | "mensual";

export interface MovimientoDeduccion {
  fecha: string; // ISO
  productorId: string;
  kilosNetos: number;
}

export interface ConsolidadoProductor {
  productorId: string;
  nBoletas: number;
  kilosNetos: number;
  deduccionFija: number;
  provision: number;
  total: number;
}

/** Clave ordenable del periodo que contiene la fecha (YYYY-MM-DD / semana / Q1-Q2 / mes). */
export function clavePeriodo(fechaISO: string, modo: ModoPeriodo): string {
  const f = new Date(`${fechaISO.slice(0, 10)}T12:00:00`);
  const y = f.getFullYear();
  const m = String(f.getMonth() + 1).padStart(2, "0");
  const d = String(f.getDate()).padStart(2, "0");
  switch (modo) {
    case "diario":
      return `${y}-${m}-${d}`;
    case "mensual":
      return `${y}-${m}`;
    case "quincenal":
      return `${y}-${m}-Q${f.getDate() <= 15 ? "1" : "2"}`;
    case "semanal": {
      const lunes = new Date(f);
      lunes.setDate(f.getDate() - ((f.getDay() + 6) % 7));
      const ly = lunes.getFullYear();
      const lm = String(lunes.getMonth() + 1).padStart(2, "0");
      const ld = String(lunes.getDate()).padStart(2, "0");
      return `S-${ly}-${lm}-${ld}`;
    }
  }
}

/** Consolidado por productor: kilos, boletas y deducción operativa total. */
export function consolidarDeducciones(
  movimientos: MovimientoDeduccion[],
): ConsolidadoProductor[] {
  const porProductor = new Map<string, ConsolidadoProductor>();
  for (const mv of movimientos) {
    const c =
      porProductor.get(mv.productorId) ??
      ({
        productorId: mv.productorId,
        nBoletas: 0,
        kilosNetos: 0,
        deduccionFija: 0,
        provision: 0,
        total: 0,
      } satisfies ConsolidadoProductor);
    c.nBoletas += 1;
    c.kilosNetos = redondear2(c.kilosNetos + mv.kilosNetos);
    c.deduccionFija = redondear2(c.deduccionFija + DEDUCCION_OPERATIVA_POR_BOLETA);
    c.provision = redondear2(
      c.provision + mv.kilosNetos * PROVISION_OPERATIVA_POR_KG,
    );
    c.total = redondear2(c.deduccionFija + c.provision);
    porProductor.set(mv.productorId, c);
  }
  return [...porProductor.values()].sort((a, b) => b.total - a.total);
}
