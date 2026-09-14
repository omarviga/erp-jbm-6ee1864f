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
