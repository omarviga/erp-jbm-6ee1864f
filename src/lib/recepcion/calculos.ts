// Lógica pura del Modal de Recepción & Pesaje — JBM Cítricos ERP.
// Sin dependencias de UI: reutilizable en formulario, ticket y tests.
//
// Reglas vigentes:
// - docs/PESO_NETO_RULE.md: peso_neto es la única base de cálculo.
// - docs/RECEPCION_MEJORAS_2026-08-13.md: peso_neto GENERATED (bruto - tara),
//   báscula con forma de cobro efectivo|liquidacion, cargo operativo por kilo.

export type FormaPagoBascula = "liquidacion" | "efectivo";

export const CUOTA_BASCULA_DEFAULT = 50;
export const TARIFA_MANIOBRA_DEFAULT = 0.4;
export const VARIEDAD_UNICA = "Limón mexicano";

export interface EntradaCalculoRecepcion {
  pesoBruto: number;
  pesoTara: number;
  precioKg: number;
  formaPagoBascula: FormaPagoBascula;
  cuotaBascula: number;
  tarifaManiobraKg: number;
}

export interface ResumenRecepcion {
  pesoNeto: number;
  subtotalFruta: number;
  descuentoBascula: number;
  cargoManiobraTotal: number;
  totalLiquidar: number;
  /** Métrica de transparencia: total a liquidar ÷ kilos netos. */
  precioNetoEfectivo: number;
}

export type CodigoErrorRecepcion =
  | "BRUTO_INVALIDO"
  | "TARA_INVALIDA"
  | "PRECIO_INVALIDO"
  | "PRODUCTOR_REQUERIDO"
  | "FOLIO_REQUERIDO"
  | "ANTICIPO_INVALIDO"
  | "ANTICIPO_EXCEDE_TOTAL";

/** Pago al productor al momento de la recepción. */
export type TipoPagoRecepcion = "pendiente" | "anticipo" | "total";

export interface EntradaAnticipoRecepcion {
  tipoPago: TipoPagoRecepcion;
  montoAnticipo: number;
  /** Total estimado en recepción (subtotal − báscula − maniobra). */
  totalEstimado: number;
}

export interface DesgloseAnticipoRecepcion {
  /** Monto que viaja a Finanzas como anticipos de la boleta. */
  anticipos: number;
  remanenteEstimado: number;
}

/**
 * "Pago total" en recepción registra anticipos por el total estimado;
 * Finanzas lo amortiza y ajusta las deducciones operativas en liquidación.
 */
export function calcularAnticipoRecepcion(
  e: EntradaAnticipoRecepcion,
): DesgloseAnticipoRecepcion {
  const total = Math.max(0, redondear2(e.totalEstimado));
  const anticipos =
    e.tipoPago === "total"
      ? total
      : e.tipoPago === "anticipo"
        ? Math.max(0, redondear2(e.montoAnticipo))
        : 0;
  return { anticipos, remanenteEstimado: redondear2(total - anticipos) };
}

export interface ErrorValidacionRecepcion {
  codigo: CodigoErrorRecepcion;
  mensaje: string;
}

export function redondear2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Peso neto certificado: única base válida de pago (bruto − tara). */
export function calcularPesoNeto(pesoBruto: number, pesoTara: number): number {
  return redondear2(pesoBruto - pesoTara);
}

export function calcularResumenRecepcion(
  entrada: EntradaCalculoRecepcion,
): ResumenRecepcion {
  const pesoNeto = calcularPesoNeto(entrada.pesoBruto, entrada.pesoTara);
  const baseKg = Math.max(0, pesoNeto);
  const subtotalFruta = redondear2(baseKg * entrada.precioKg);
  const descuentoBascula =
    entrada.formaPagoBascula === "liquidacion"
      ? redondear2(entrada.cuotaBascula)
      : 0;
  const cargoManiobraTotal = redondear2(baseKg * entrada.tarifaManiobraKg);
  const totalLiquidar = redondear2(
    subtotalFruta - descuentoBascula - cargoManiobraTotal,
  );
  const precioNetoEfectivo =
    baseKg > 0 ? redondear2(totalLiquidar / baseKg) : 0;
  return {
    pesoNeto,
    subtotalFruta,
    descuentoBascula,
    cargoManiobraTotal,
    totalLiquidar,
    precioNetoEfectivo,
  };
}

export interface EntradaValidacionRecepcion {
  productorId: string;
  folioBascula: string;
  pesoBruto: number;
  pesoTara: number;
  precioKg: number;
  tipoPago?: TipoPagoRecepcion;
  montoAnticipo?: number;
  totalEstimado?: number;
}

/**
 * Validaciones automáticas del ConfirmationModal. Bloquean el guardado
 * si el bruto es ≤ 0, la tara es ≥ al bruto o el precio es $0.00,
 * además de exigir productor y folio físico de báscula.
 */
export function validarRecepcion(
  entrada: EntradaValidacionRecepcion,
): ErrorValidacionRecepcion[] {
  const errores: ErrorValidacionRecepcion[] = [];
  if (!entrada.productorId.trim()) {
    errores.push({
      codigo: "PRODUCTOR_REQUERIDO",
      mensaje: "Selecciona el productor o proveedor de la carga.",
    });
  }
  if (!entrada.folioBascula.trim()) {
    errores.push({
      codigo: "FOLIO_REQUERIDO",
      mensaje: "Captura el folio impreso por la báscula física (ej. BAS-10492).",
    });
  }
  if (!(entrada.pesoBruto > 0)) {
    errores.push({
      codigo: "BRUTO_INVALIDO",
      mensaje: "El peso bruto debe ser mayor a 0 kg.",
    });
  }
  if (!(entrada.pesoTara >= 0) || entrada.pesoTara >= entrada.pesoBruto) {
    errores.push({
      codigo: "TARA_INVALIDA",
      mensaje: "La tara debe ser ≥ 0 kg y menor al peso bruto.",
    });
  }
  if (!(entrada.precioKg > 0)) {
    errores.push({
      codigo: "PRECIO_INVALIDO",
      mensaje: "El precio pactado debe ser mayor a $0.00/kg.",
    });
  }
  if (entrada.tipoPago === "anticipo") {
    const monto = entrada.montoAnticipo ?? 0;
    const total = Math.max(0, entrada.totalEstimado ?? 0);
    if (!(monto > 0)) {
      errores.push({
        codigo: "ANTICIPO_INVALIDO",
        mensaje: "Captura el monto del anticipo entregado al productor.",
      });
    } else if (monto > total) {
      errores.push({
        codigo: "ANTICIPO_EXCEDE_TOTAL",
        mensaje: "El anticipo no puede exceder el total estimado de la boleta.",
      });
    }
  }
  return errores;
}

const formatoMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const formatoKg = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatoPesos(n: number): string {
  return formatoMoneda.format(Number.isFinite(n) ? n : 0);
}

export function formatoKilos(n: number): string {
  return `${formatoKg.format(Number.isFinite(n) ? n : 0)} kg`;
}

/** Convierte texto de input a número; vacío o inválido → 0. */
export function parseNumero(valor: string): number {
  const n = Number(valor.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
