import { VARIEDAD_UNICA } from "../../lib/recepcion/calculos";
import type { ResumenRecepcion, TipoPagoRecepcion } from "../../lib/recepcion/calculos";
import { PapelTicket, type TicketRecepcion } from "./TicketBascula";
import type { AnchoTicket } from "../../lib/recepcion/textoTicket";

export interface DatosTicketRecepcion {
  folioOficial: string;
  folioBascula: string;
  fecha: Date;
  productorNombre: string;
  productorLocalidad?: string | null;
  pesoBruto: number;
  pesoTara: number;
  precioKg: number;
  cuotaBascula: number;
  formaPagoBascula: "liquidacion" | "efectivo";
  tarifaManiobraKg: number;
  conceptoManiobra: string;
  operadorBascula: string;
  tipoPago?: TipoPagoRecepcion;
  anticipos?: number;
  remanenteEstimado?: number;
  resumen: ResumenRecepcion;
}

interface ThermalTicketProps {
  datos: DatosTicketRecepcion;
  /** true = vista previa en vivo dentro del modal; false = impresión. */
  isLivePreview?: boolean;
  ancho?: AnchoTicket;
}

/**
 * Vista en vivo del ticket térmico de 80/58 mm dentro del modal de
 * captura. Reutiliza el mismo papel que la vista guardada para que la
 * previsualización sea idéntica al comprobante impreso.
 */
export function ThermalTicket({ datos, isLivePreview = false, ancho = "80mm" }: ThermalTicketProps) {
  const { resumen } = datos;
  const anticipos = datos.anticipos ?? 0;
  const etiquetaPago =
    datos.tipoPago === "total"
      ? "Pago total en recepción"
      : datos.tipoPago === "anticipo"
        ? "Anticipo en recepción"
        : null;

  const ticket: TicketRecepcion = {
    folioOficial: datos.folioOficial,
    folioFisico: datos.folioBascula,
    numeroLote: "",
    productor: datos.productorNombre || "—",
    origen: "",
    huerto: "—",
    localidad: datos.productorLocalidad ?? "",
    variedad: VARIEDAD_UNICA,
    operador: datos.operadorBascula,
    pesoBruto: datos.pesoBruto,
    tara: datos.pesoTara,
    pesoNeto: Math.max(0, resumen.pesoNeto),
    kilosMerma: 0,
    defectosPct: 0,
    precioKg: datos.precioKg,
    subtotal: resumen.subtotalFruta,
    costoBascula: datos.cuotaBascula,
    basculaFormaPago: datos.formaPagoBascula,
    cuotaManiobraKg: datos.tarifaManiobraKg,
    cuotaManiobraConcepto: datos.conceptoManiobra,
    cuotaManiobra: resumen.cargoManiobraTotal,
    totalDeducciones: resumen.descuentoBascula + resumen.cargoManiobraTotal,
    total: resumen.totalLiquidar,
    precioNetoEfectivo: resumen.precioNetoEfectivo,
    fecha: datos.fecha.toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    statusUrl: "",
    borrador: true,
  };

  return (
    <div
      role={isLivePreview ? "img" : undefined}
      aria-label={isLivePreview ? "Vista previa del ticket térmico" : undefined}
    >
      {isLivePreview && (
        <div className="mx-auto mb-2 max-w-[302px] rounded-t-xl bg-amber-400 px-2 py-1 text-center text-[10px] font-black tracking-widest text-slate-900 uppercase">
          Vista previa en vivo
        </div>
      )}
      <PapelTicket
        ticket={ticket}
        ancho={ancho}
        imprimible={false}
        pagoExtra={
          etiquetaPago && anticipos > 0
            ? {
                etiqueta: etiquetaPago,
                anticipos,
                remanenteEstimado: datos.remanenteEstimado ?? 0,
              }
            : null
        }
      />
    </div>
  );
}
