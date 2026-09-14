import type { Database } from "@/integrations/supabase/types";
import type { CortadorDelLote } from "@/hooks/useRecepcion";
import type {
  DictamenCalidad,
  FormaPagoBascula,
  HistorialPrecios,
  OrigenRecepcion,
  ResultadoCalculoRecepcion,
} from "@/lib/recepcion/calculos";

export type Productor = Database["public"]["Tables"]["productores"]["Row"];
export type Huerto = Database["public"]["Tables"]["huertos"]["Row"];
export type Cortador = Database["public"]["Tables"]["cortadores"]["Row"];

export interface RecepcionFormState {
  origen: OrigenRecepcion;
  /** Folio del ticket físico que emite la báscula (B-10293). */
  folioFisico: string;
  productorId: string;
  huertoId: string;
  variedad: string;
  chofer: string;
  placas: string;
  rejas: string;

  // Doble pesada
  pesoBruto: string;
  taraVehiculo: string;
  taraRejasKg: string;
  pesoBrutoAt: string | null;
  pesoTaraAt: string | null;

  // Comercial
  precioKg: string;
  precioCajaCortador: string;
  defectos: number;
  incluirBascula: boolean;
  costoBascula: string;
  basculaFormaPago: FormaPagoBascula;
  incluirManiobra: boolean;
  cuotaManiobraKg: string;
  notas: string;
}

export const COSTO_BASCULA_DEFAULT = 50;

export const crearEstadoInicial = (): RecepcionFormState => ({
  origen: "terceros",
  folioFisico: "",
  productorId: "",
  huertoId: "",
  variedad: "",
  chofer: "",
  placas: "",
  rejas: "",
  pesoBruto: "",
  taraVehiculo: "",
  taraRejasKg: "",
  pesoBrutoAt: null,
  pesoTaraAt: null,
  precioKg: "",
  precioCajaCortador: "",
  defectos: 0,
  incluirBascula: true,
  costoBascula: String(COSTO_BASCULA_DEFAULT),
  basculaFormaPago: "liquidacion",
  incluirManiobra: false,
  cuotaManiobraKg: "",
  notas: "",
});

export interface PasoRecepcion {
  id: number;
  titulo: string;
  descripcion: string;
  /** Requisito para que el indicador se pinte como completo. */
  resumen: (form: RecepcionFormState, calculo: ResultadoCalculoRecepcion) => string;
}

export const PASOS_RECEPCION: PasoRecepcion[] = [
  {
    id: 1,
    titulo: "Origen y transporte",
    descripcion: "Productor, huerto, variedad y datos del vehículo",
    resumen: (form) =>
      form.productorId
        ? form.origen === "propia"
          ? "Cosecha propia"
          : "Compra a terceros"
        : "Sin definir",
  },
  {
    id: 2,
    titulo: "Pesaje (doble pesada)",
    descripcion: "Peso bruto del camión cargado, tara del vehículo y peso neto",
    resumen: (_form, calculo) =>
      calculo.pesoNeto > 0
        ? `${calculo.pesoNeto.toLocaleString("es-MX")} kg netos`
        : "Pendiente",
  },
  {
    id: 3,
    titulo: "Calidad y comercial",
    descripcion: "Defectos, precio pactado, báscula y maniobra",
    resumen: (form, calculo) =>
      form.precioKg
        ? `$${form.precioKg}/kg · ${calculo.dictamen}`
        : `Dictamen ${calculo.dictamen}`,
  },
  {
    id: 4,
    titulo: "Revisión y confirmación",
    descripcion: "Verifica la información y genera la boleta de recepción",
    resumen: (_form, calculo) =>
      calculo.totalLiquidar > 0
        ? `Total ${calculo.totalLiquidar.toLocaleString("es-MX", {
            minimumFractionDigits: 2,
          })} MXN`
        : "Sin total",
  },
];

export const PASO_ORIGEN = 1;
export const PASO_PESAJE = 2;
export const PASO_CALIDAD = 3;
export const PASO_REVISION = 4;
export const TOTAL_PASOS = PASOS_RECEPCION.length;

/** Props compartidas por los 4 pasos del asistente. */
export interface PropsPasoRecepcion {
  form: RecepcionFormState;
  setCampo: <K extends keyof RecepcionFormState>(
    campo: K,
    valor: RecepcionFormState[K]
  ) => void;
  calculo: ResultadoCalculoRecepcion;
  origen: OrigenRecepcion;
  dictamen: DictamenCalidad;

  productores: Productor[];
  loadingProductores: boolean;
  errorProductores: boolean;
  onProductorCreado: (productorId: string) => void;

  huertos: Huerto[];
  cortadores: Cortador[];
  cortadoresLote: CortadorDelLote[];
  setCortadoresLote: (cortadores: CortadorDelLote[]) => void;

  historial: HistorialPrecios;
  cargandoHistorial: boolean;

  folioOficialSugerido: string | null;
  folioDuplicado: { numero_lote: string; fecha_recepcion: string } | null;

  onRegistrarPrimeraPesada: () => void;
  onRegistrarSegundaPesada: () => void;

  guardando: boolean;
  onConfirmar: () => void;
  onReiniciar: () => void;
}
