import type {
  FormaPagoBascula,
  ResumenRecepcion,
  TipoPagoRecepcion,
} from "../../lib/recepcion/calculos";

export type { FormaPagoBascula, ResumenRecepcion, TipoPagoRecepcion };

export interface ProductorOption {
  id: string;
  nombre: string;
  localidad?: string | null;
}

/** Estado crudo del formulario (strings de inputs + selectores). */
export interface RecepcionFormState {
  productorId: string;
  folioBascula: string;
  pesoBruto: string;
  pesoTara: string;
  precioKg: string;
  formaPagoBascula: FormaPagoBascula;
  cuotaBascula: string;
  tarifaManiobraKg: string;
  conceptoManiobra: string;
  operadorBascula: string;
  tipoPagoRecepcion: TipoPagoRecepcion;
  montoAnticipo: string;
}

/** Payload numérico listo para persistir (vía RPC registrar_recepcion). */
export interface RecepcionPayload {
  productorId: string;
  folioBascula: string;
  pesoBruto: number;
  pesoTara: number;
  precioKg: number;
  formaPagoBascula: FormaPagoBascula;
  cuotaBascula: number;
  tarifaManiobraKg: number;
  conceptoManiobra: string;
  operadorBascula: string;
  tipoPagoRecepcion: TipoPagoRecepcion;
  /** Anticipo que Finanzas amortizará en la liquidación de la boleta. */
  anticipos: number;
  resumen: ResumenRecepcion;
}

export const ESTADO_INICIAL_RECEPCION: RecepcionFormState = {
  productorId: "",
  folioBascula: "",
  pesoBruto: "",
  pesoTara: "",
  precioKg: "",
  formaPagoBascula: "liquidacion",
  cuotaBascula: "30",
  tarifaManiobraKg: "",
  conceptoManiobra: "Maniobra de descarga",
  operadorBascula: "",
  tipoPagoRecepcion: "pendiente",
  montoAnticipo: "",
};
