/**
 * Cálculos puros del módulo de Recepción.
 *
 * Se mantienen fuera del componente para poder probarlos y para que la
 * regla de negocio viva en un solo lugar.
 *
 * Regla vigente (docs/PESO_NETO_RULE.md): el peso neto es la única base
 * de cálculo. La merma por defectos se registra y se informa, pero no
 * descuenta el pago al productor.
 */

export type FormaPagoBascula = "efectivo" | "liquidacion";
export type DictamenCalidad = "aceptado" | "observado" | "rechazado";
export type OrigenRecepcion = "terceros" | "propia";

/** Porcentaje de defectos a partir del cual el lote se observa. */
export const DEFECTOS_OBSERVADO = 10;
/** Porcentaje de defectos a partir del cual el lote se rechaza. */
export const DEFECTOS_RECHAZADO = 20;

/** Comisión sobre el precio por caja que se paga al cortador. */
export const PORCENTAJE_CORTADOR = 0.3;

/** En la zona de operación solo se recibe Limón Mexicano. */
export const VARIEDAD_UNICA = "Limón Mexicano";

/** Cuota habitual del cargo operativo por kilo recibido. */
export const TARIFA_MANIOBRA_DEFAULT = 0.4;

/** Concepto habitual del cargo operativo. */
export const CONCEPTO_MANIOBRA_DEFAULT = "Servicios operativos y maniobra";

/** Importe habitual del servicio de báscula. */
export const CUOTA_BASCULA_DEFAULT = 50;

export interface EntradaCalculoRecepcion {
  pesoBruto: number;
  /** Tara del vehículo vacío (segunda pesada). */
  taraVehiculo: number;
  precioKg: number;
  defectosPct: number;
  incluirBascula: boolean;
  costoBascula: number;
  basculaFormaPago: FormaPagoBascula;
  incluirManiobra: boolean;
  cuotaManiobraKg: number;
}

export interface ResultadoCalculoRecepcion {
  /** Tara total descontada: la del vehículo. */
  taraTotal: number;
  /** Lo que marca la báscula: bruto - tara. */
  pesoNetoFisico: number;
  /** Kilos estimados de descarte por defectos. Informativo, no descuenta. */
  kilosMerma: number;
  /** Base de pago: siempre el peso neto. */
  pesoNeto: number;
  subtotal: number;
  /** Importe de báscula efectivamente cobrado. */
  costoBascula: number;
  /** Parte del cobro de báscula que se descuenta de la liquidación. */
  basculaDescontada: number;
  /** Parte del cobro de báscula que se liquida en efectivo al momento. */
  basculaEnEfectivo: number;
  cuotaManiobraTotal: number;
  totalDeducciones: number;
  totalLiquidar: number;
  /** Rendimiento neto real por kilo tras absorber las deducciones. */
  precioNetoEfectivo: number;
  dictamen: DictamenCalidad;
  /**
   * Avisos que no bloquean. Las reglas que impiden registrar la
   * recepción viven en `validarRecepcion`, para que este módulo se
   * limite a los números.
   */
  advertencias: string[];
}

export const redondear2 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 100) / 100;

export const aNumero = (valor: string | number | null | undefined): number => {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const parseado = parseFloat(String(valor ?? "").replace(/,/g, ""));
  return Number.isFinite(parseado) ? parseado : 0;
};

export const obtenerDictamen = (defectosPct: number): DictamenCalidad => {
  if (defectosPct >= DEFECTOS_RECHAZADO) return "rechazado";
  if (defectosPct >= DEFECTOS_OBSERVADO) return "observado";
  return "aceptado";
};

/** Pago al cortador por sus cajas recolectadas. */
export const calcularPagoCortador = (
  cajas: number,
  precioCaja: number
): number => redondear2(cajas * precioCaja * PORCENTAJE_CORTADOR);

export function calcularRecepcion(
  entrada: EntradaCalculoRecepcion
): ResultadoCalculoRecepcion {
  const pesoBruto = Math.max(0, aNumero(entrada.pesoBruto));
  const taraTotal = Math.max(0, aNumero(entrada.taraVehiculo));
  const precioKg = Math.max(0, aNumero(entrada.precioKg));
  const defectosPct = Math.max(0, aNumero(entrada.defectosPct));
  const costoBascula = Math.max(0, aNumero(entrada.costoBascula));
  const cuotaManiobraKg = Math.max(0, aNumero(entrada.cuotaManiobraKg));

  const pesoNetoFisico = redondear2(Math.max(0, pesoBruto - taraTotal));
  const kilosMerma = redondear2(pesoNetoFisico * (defectosPct / 100));

  // Base de pago = peso neto (regla operativa vigente).
  const pesoNeto = pesoNetoFisico;
  const subtotal = redondear2(pesoNeto * precioKg);

  const basculaAplicable = entrada.incluirBascula ? costoBascula : 0;
  const basculaDescontada =
    entrada.basculaFormaPago === "liquidacion" ? basculaAplicable : 0;
  const basculaEnEfectivo =
    entrada.basculaFormaPago === "efectivo" ? basculaAplicable : 0;

  const cuotaManiobraTotal = entrada.incluirManiobra
    ? redondear2(pesoNeto * cuotaManiobraKg)
    : 0;

  const totalDeducciones = redondear2(basculaDescontada + cuotaManiobraTotal);
  const totalLiquidar = redondear2(Math.max(0, subtotal - totalDeducciones));
  const precioNetoEfectivo =
    pesoNeto > 0 ? redondear2(totalLiquidar / pesoNeto) : 0;

  const advertencias: string[] = [];

  if (precioKg <= 0) {
    advertencias.push("El precio por kilo está en cero: el lote no generará pago.");
  }

  if (pesoBruto > 0 && taraTotal >= pesoBruto) {
    advertencias.push(
      `La tara (${taraTotal.toLocaleString("es-MX")} kg) no puede ser mayor o igual al peso bruto (${pesoBruto.toLocaleString("es-MX")} kg).`
    );
  }

  if (pesoBruto > 0 && taraTotal <= 0) {
    advertencias.push(
      "Falta la tara del vehículo: el peso neto quedaría igual al peso bruto."
    );
  }

  const dictamen = obtenerDictamen(defectosPct);

  if (dictamen === "rechazado") {
    advertencias.push(
      `Dictamen ${dictamen.toUpperCase()} con ${defectosPct}% de defectos: el lote no puede ingresar.`
    );
  } else if (dictamen === "observado") {
    advertencias.push(
      `Dictamen OBSERVADO con ${defectosPct}% de defectos: se guardará con observaciones.`
    );
  }

  if (entrada.incluirBascula && entrada.basculaFormaPago === "efectivo") {
    advertencias.push(
      "La cuota de báscula se cobra en efectivo: se registra el ingreso pero no se descuenta de la liquidación."
    );
  }

  return {
    taraTotal,
    pesoNetoFisico,
    kilosMerma,
    pesoNeto,
    subtotal,
    costoBascula: basculaAplicable,
    basculaDescontada,
    basculaEnEfectivo,
    cuotaManiobraTotal,
    totalDeducciones,
    totalLiquidar,
    precioNetoEfectivo,
    dictamen,
    advertencias,
  };
}

/**
 * Folio local de respaldo para cuando la RPC `siguiente_folio_recepcion`
 * todavía no está desplegada. Mantiene el mismo formato REC-YYYY-NNN.
 */
export const formatearFolioRecepcion = (
  anio: number,
  consecutivo: number
): string => `REC-${anio}-${String(consecutivo).padStart(3, "0")}`;

export const moneda = (valor: number): string =>
  `$${(Number.isFinite(valor) ? valor : 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const kilos = (valor: number): string =>
  `${(Number.isFinite(valor) ? valor : 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;

/** "carlos.barragan@jbm.com.mx" → "Carlos Barragan" (solo como sugerencia). */
export const nombreDesdeEmail = (email?: string | null): string => {
  const local = String(email ?? "").split("@")[0] ?? "";
  if (!local) return "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(" ");
};

// ---------------------------------------------------------------
// Historial de precios del productor
// ---------------------------------------------------------------

export interface PrecioHistorico {
  folio: string | null;
  fecha: string;
  precio: number;
  kilos: number;
  variedad: string | null;
}

export interface HistorialPrecios {
  precios: PrecioHistorico[];
  ultimo: number | null;
  promedio: number | null;
  maximo: number | null;
  minimo: number | null;
  /** Variación porcentual del último precio contra el promedio. */
  variacionPct: number | null;
  lotesRegistrados: number;
}

export const HISTORIAL_PRECIOS_VACIO: HistorialPrecios = {
  precios: [],
  ultimo: null,
  promedio: null,
  maximo: null,
  minimo: null,
  variacionPct: null,
  lotesRegistrados: 0,
};

export function calcularHistorialPrecios(
  filas: PrecioHistorico[]
): HistorialPrecios {
  const precios = (filas ?? []).filter((f) => Number(f.precio) > 0);

  if (precios.length === 0) return HISTORIAL_PRECIOS_VACIO;

  const valores = precios.map((p) => Number(p.precio));
  const ultimo = valores[0];
  const promedio = redondear2(
    valores.reduce((acc, valor) => acc + valor, 0) / valores.length
  );

  return {
    precios,
    ultimo,
    promedio,
    maximo: Math.max(...valores),
    minimo: Math.min(...valores),
    variacionPct:
      promedio > 0 ? redondear2(((ultimo - promedio) / promedio) * 100) : null,
    lotesRegistrados: precios.length,
  };
}

// ---------------------------------------------------------------
// Validación de la recepción (pantalla única)
// ---------------------------------------------------------------

export interface EntradaValidacionRecepcion {
  origen: OrigenRecepcion;
  productorId: string;
  huertoId: string;
  pesoBruto: number;
  taraTotal: number;
  precioKg: number;
  operadorBascula: string;
  dictamen: DictamenCalidad;
}

/**
 * Errores que impiden registrar la recepción. Único lugar donde viven
 * las reglas de captura obligatoria; las advertencias no bloquean.
 */
export function validarRecepcion(
  entrada: EntradaValidacionRecepcion
): string[] {
  const errores: string[] = [];

  if (!entrada.productorId) {
    errores.push(
      entrada.origen === "propia"
        ? "Selecciona al productor responsable de la cosecha."
        : "Selecciona el productor al que se le compra la fruta."
    );
  }

  if (entrada.origen === "propia" && !entrada.huertoId) {
    errores.push("Selecciona el huerto de procedencia de la cosecha propia.");
  }

  if (entrada.pesoBruto <= 0) {
    errores.push("Captura el peso bruto del camión cargado.");
  } else if (entrada.taraTotal <= 0) {
    errores.push("Captura la tara del vehículo vacío (segunda pesada).");
  } else if (entrada.taraTotal >= entrada.pesoBruto) {
    errores.push(
      "La tara debe ser menor al peso bruto: revisa el pesaje del vehículo."
    );
  }

  if (entrada.origen === "terceros" && entrada.precioKg <= 0) {
    errores.push("Captura el precio por kilo pactado con el productor.");
  }

  if (!entrada.operadorBascula.trim()) {
    errores.push("Captura el nombre del operador de báscula responsable.");
  }

  if (entrada.dictamen === "rechazado") {
    errores.push(
      "El dictamen es RECHAZADO: no es posible ingresar el lote a producción."
    );
  }

  return errores;
}

// ---------------------------------------------------------------
// Boleta de Recepción & Pesaje (modal de pantalla dividida)
// ---------------------------------------------------------------
//
// Piezas del flujo "Nueva Boleta": resumen compacto para el modal,
// validación con códigos y pago/anticipos en recepción. La pantalla
// de recepción principal sigue usando `calcularRecepcion` y
// `validarRecepcion` de arriba.

export interface EntradaResumenRecepcion {
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

export interface ErrorValidacionRecepcion {
  codigo: CodigoErrorRecepcion;
  mensaje: string;
}

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

/** Peso neto certificado: única base válida de pago (bruto − tara). */
export function calcularPesoNeto(pesoBruto: number, pesoTara: number): number {
  return redondear2(pesoBruto - pesoTara);
}

export function calcularResumenRecepcion(
  entrada: EntradaResumenRecepcion,
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

export interface EntradaValidacionBoleta {
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
 * Validaciones automáticas del ConfirmationModal de la boleta. Bloquean
 * el guardado si el bruto es ≤ 0, la tara es ≥ al bruto, el precio es
 * $0.00 o el anticipo es inválido, además de exigir productor y folio.
 */
export function validarBoletaRecepcion(
  entrada: EntradaValidacionBoleta,
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
