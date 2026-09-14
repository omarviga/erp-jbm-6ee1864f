import type { Database } from "@/integrations/supabase/types";
import type { CortadorDelLote } from "@/hooks/useRecepcion";
import {
  CONCEPTO_MANIOBRA_DEFAULT,
  CUOTA_BASCULA_DEFAULT,
  TARIFA_MANIOBRA_DEFAULT,
  VARIEDAD_UNICA,
  type DictamenCalidad,
  type FormaPagoBascula,
  type HistorialPrecios,
  type OrigenRecepcion,
  type ResultadoCalculoRecepcion,
} from "@/lib/recepcion/calculos";

export type Productor = Database["public"]["Tables"]["productores"]["Row"];
export type Huerto = Database["public"]["Tables"]["huertos"]["Row"];
export type Cortador = Database["public"]["Tables"]["cortadores"]["Row"];

export { VARIEDAD_UNICA };

/** Rótulo fijo de la báscula de plataforma de la planta. */
export const ROTULO_BASCULA = "Báscula Camionera #1";

export interface RecepcionFormState {
  origen: OrigenRecepcion;
  /** Folio del ticket físico que emite la báscula (B-10293). */
  folioFisico: string;
  productorId: string;
  /** Solo aplica a cosecha propia. */
  huertoId: string;

  // Pesaje de báscula
  pesoBruto: string;
  taraVehiculo: string;

  // Comercial
  precioKg: string;
  precioCajaCortador: string;
  defectos: number;
  costoBascula: string;
  basculaFormaPago: FormaPagoBascula;
  cuotaManiobraKg: string;
  cuotaManiobraConcepto: string;

  // Cierre
  operadorBascula: string;
  notas: string;
}

export const crearEstadoInicial = (
  operadorSugerido = ""
): RecepcionFormState => ({
  origen: "terceros",
  folioFisico: "",
  productorId: "",
  huertoId: "",
  pesoBruto: "",
  taraVehiculo: "",
  precioKg: "",
  precioCajaCortador: "",
  defectos: 0,
  costoBascula: String(CUOTA_BASCULA_DEFAULT),
  basculaFormaPago: "liquidacion",
  cuotaManiobraKg: String(TARIFA_MANIOBRA_DEFAULT),
  cuotaManiobraConcepto: CONCEPTO_MANIOBRA_DEFAULT,
  operadorBascula: operadorSugerido,
  notas: "",
});

/** Props compartidas por las secciones del formulario de recepción. */
export interface PropsSeccionRecepcion {
  form: RecepcionFormState;
  setCampo: <K extends keyof RecepcionFormState>(
    campo: K,
    valor: RecepcionFormState[K]
  ) => void;
  calculo: ResultadoCalculoRecepcion;
  dictamen: DictamenCalidad;

  productores: Productor[];
  loadingProductores: boolean;
  errorProductores: boolean;
  onProductorCreado: (productorId: string) => void;
  huertos: Huerto[];

  folioOficialSugerido: string | null;
  folioDuplicado: { numero_lote: string; fecha_recepcion: string } | null;

  cortadores: Cortador[];
  cortadoresLote: CortadorDelLote[];
  setCortadoresLote: (cortadores: CortadorDelLote[]) => void;

  historial: HistorialPrecios;
  cargandoHistorial: boolean;

  guardando: boolean;
  onGuardarEImprimir: () => void;
  onGuardar: () => void;
}

export interface ItemChecklist {
  etiqueta: string;
  listo: boolean;
  obligatorio: boolean;
}
