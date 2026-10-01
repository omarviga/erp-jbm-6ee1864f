import { Copy, Printer, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { COMPANY_INFO, type DatosFiscalesEmpresa } from "@/lib/company";
import { moneda } from "@/lib/recepcion/calculos";
import {
  formatearResumenWhatsApp,
  copiarTextoTicket,
  urlConsultaPago,
  ANCHO_PAPEL_PX,
  type AnchoTicket,
} from "@/lib/recepcion/textoTicket";
import type { FormaPagoBascula } from "@/lib/recepcion/calculos";

export interface TicketRecepcion {
  folioOficial: string;
  folioFisico: string;
  numeroLote: string;
  productor: string;
  /** Reservado: origen del lote (fase futura, sin huerto/origen por ahora). */
  origen: string;
  /** Reservado: predio de procedencia (fase futura). */
  huerto: string;
  localidad: string;
  variedad: string;
  operador: string;
  pesoBruto: number;
  tara: number;
  pesoNeto: number;
  kilosMerma: number;
  defectosPct: number;
  precioKg: number;
  subtotal: number;
  costoBascula: number;
  basculaFormaPago: FormaPagoBascula;
  cuotaManiobraKg: number;
  cuotaManiobraConcepto: string;
  cuotaManiobra: number;
  totalDeducciones: number;
  total: number;
  precioNetoEfectivo: number;
  fecha: string;
  statusUrl: string;
  /** true cuando el ticket muestra la captura en curso, no un lote guardado. */
  borrador: boolean;
}

interface TicketBasculaProps {
  ticket: TicketRecepcion;
  onImprimir: () => void;
  /** Datos fiscales y de báscula. Por defecto, los de la empresa. */
  empresa?: DatosFiscalesEmpresa;
  /** Ancho del rollo térmico simulado. */
  ancho?: AnchoTicket;
}

/** Pago/anticipos en recepción (solo vista en vivo del modal). */
export interface PagoExtraTicket {
  etiqueta: string;
  anticipos: number;
  remanenteEstimado: number;
}

const FUENTE_TERMICA = '"Courier New", Courier, Monaco, monospace';

const formatearKilos = (valor: number): string =>
  valor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Borde dentado que simula el corte de guillotina del rollo térmico:
 * triángulos blancos (cuadros rotados 45°) sobre el fondo gris del visor.
 */
export function BordeDentado({ anchoPx }: { anchoPx: number }) {
  const dientes = Math.max(12, Math.floor(anchoPx / 11));
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex justify-between overflow-hidden px-1"
      style={{ width: anchoPx, maxWidth: "100%" }}
    >
      {Array.from({ length: dientes }).map((_, i) => (
        <span
          key={i}
          className="block h-2.5 w-2.5 shrink-0 rotate-45 bg-white"
          style={{ marginTop: -6 }}
        />
      ))}
    </div>
  );
}

interface PapelTicketProps {
  ticket: TicketRecepcion;
  empresa?: DatosFiscalesEmpresa;
  ancho?: AnchoTicket;
  pagoExtra?: PagoExtraTicket | null;
  conSombra?: boolean;
  /** Id DOM del papel (solo la vista inline lo fija para impresión). */
  id?: string;
  /** false = no participa en la impresión (modal y vista en vivo). */
  imprimible?: boolean;
}

/**
 * Papel térmico de 80/58 mm: membrete dual (folio físico + folio ERP),
 * bloque de pesajes, liquidación con deducciones, QR de validación en
 * línea y firmas. Núcleo compartido por la vista inline, el modal de
 * previsualización y la vista en vivo del modal de captura.
 */
export function PapelTicket({
  ticket,
  empresa = COMPANY_INFO,
  ancho = "80mm",
  pagoExtra = null,
  conSombra = true,
  id,
  imprimible = true,
}: PapelTicketProps) {
  const anchoPx = ANCHO_PAPEL_PX[ancho];
  const basculaEfectivo = ticket.basculaFormaPago === "efectivo";
  const urlPago = urlConsultaPago(ticket.folioOficial, ticket.statusUrl);

  return (
    <div style={{ width: anchoPx, maxWidth: "100%" }} className="mx-auto">
      <div
        id={id}
        className={`${imprimible ? "ticket-print-root " : ""}mx-auto bg-white px-4 py-3 text-[11px] leading-5 text-slate-900 ${conSombra ? "shadow-lg" : ""}`}
        style={{ width: anchoPx, maxWidth: "100%", fontFamily: FUENTE_TERMICA }}
      >
        <div className="border-b border-dashed border-slate-300 pb-2 text-center">
          <img
            src="/logo-ticket.png"
            alt="Logo JBM"
            className="mx-auto mb-1.5 h-14 w-auto object-contain"
          />
          <p className="text-[14px] font-black leading-none tracking-wide">
            {empresa.displayName.toUpperCase()}
          </p>
          <p className="mt-1 text-[9px] leading-tight text-slate-600">
            {empresa.legalName}
          </p>
          {empresa.rfc && (
            <p className="text-[9px] leading-tight text-slate-600">
              RFC: {empresa.rfc}
            </p>
          )}
          <p className="text-[9px] leading-tight text-slate-600">
            {empresa.addressLine1}
          </p>
          <p className="text-[9px] leading-tight text-slate-600">
            {empresa.addressLine2} · Tel. {empresa.phone}
          </p>
          {empresa.direccionBascula && (
            <p className="text-[9px] leading-tight text-slate-600">
              Báscula: {empresa.direccionBascula}
            </p>
          )}
          {empresa.registroSenasica && (
            <p className="text-[9px] leading-tight text-slate-600">
              Reg. SENASICA: {empresa.registroSenasica}
            </p>
          )}

          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            Ticket de báscula
          </p>
          <p className="mt-0.5 text-2xl font-black leading-none">
            {ticket.folioFisico || "—"}
          </p>
          <p className="mt-1 text-[11px] font-bold">
            FOLIO ERP: {ticket.folioOficial || "POR ASIGNAR"}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">{ticket.fecha}</p>
          <p className="text-[9px] text-slate-500">
            Lote: {ticket.numeroLote || "—"}
          </p>
        </div>

        <div className="my-2.5 space-y-1 border-b border-dashed border-slate-300 pb-2 text-[10px]">
          <div className="flex justify-between gap-2">
            <span className="font-semibold">PRODUCTOR</span>
            <span className="max-w-[58%] text-right">{ticket.productor}</span>
          </div>
          {ticket.variedad && (
            <div className="flex justify-between gap-2">
              <span className="font-semibold">VARIEDAD</span>
              <span className="text-right">{ticket.variedad}</span>
            </div>
          )}
          {ticket.localidad && (
            <div className="flex justify-between gap-2">
              <span className="font-semibold">LOCALIDAD</span>
              <span className="text-right">{ticket.localidad}</span>
            </div>
          )}
          {ticket.operador && (
            <div className="flex justify-between gap-2">
              <span className="font-semibold">OPERADOR</span>
              <span className="text-right">{ticket.operador}</span>
            </div>
          )}
        </div>

        <div className="space-y-1 text-[11px]">
          <p className="text-center text-[10px] font-semibold tracking-wide">
            DETALLE DE PESO (KG)
          </p>
          <div className="flex justify-between">
            <span>BRUTO</span>
            <span>{formatearKilos(ticket.pesoBruto)}</span>
          </div>
          <div className="flex justify-between">
            <span>TARA</span>
            <span>-{formatearKilos(ticket.tara)}</span>
          </div>
          <div className="mt-1 flex justify-between border-y border-dashed border-slate-300 py-1.5 text-xl font-black">
            <span>NETO</span>
            <span>{formatearKilos(ticket.pesoNeto)} kg</span>
          </div>
        </div>

        <div className="my-2.5 space-y-1 border-b border-dashed border-slate-300 py-2 text-[11px]">
          <div className="flex justify-between">
            <span>PRECIO/KG</span>
            <span>{moneda(ticket.precioKg)}</span>
          </div>
          <div className="flex justify-between">
            <span>SUBTOTAL FRUTA</span>
            <span>{moneda(ticket.subtotal)}</span>
          </div>
          {ticket.costoBascula > 0 && (
            <div className="flex justify-between">
              <span>
                CUOTA BÁSCULA {basculaEfectivo ? "(PAGADO EF.)" : "(DESCUENTO)"}
              </span>
              <span className={basculaEfectivo ? "" : "text-rose-600"}>
                {basculaEfectivo ? moneda(0) : `-${moneda(ticket.costoBascula)}`}
              </span>
            </div>
          )}
          {ticket.cuotaManiobra > 0 && (
            <div className="flex justify-between">
              <span className="max-w-[60%]">
                CARGOS OP. ({moneda(ticket.cuotaManiobraKg)}/KG)
                {ticket.cuotaManiobraConcepto && (
                  <span className="block text-[9px] text-slate-500">
                    {(ticket.cuotaManiobraConcepto || "").toUpperCase()}
                  </span>
                )}
              </span>
              <span>-{moneda(ticket.cuotaManiobra)}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between bg-black px-2 py-1.5 text-lg font-black text-white">
            <span>TOTAL A LIQUIDAR</span>
            <span>{moneda(ticket.total)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span>PRECIO NETO EFECTIVO</span>
            <span>{moneda(ticket.precioNetoEfectivo)} / kg</span>
          </div>
          {pagoExtra && pagoExtra.anticipos > 0 && (
            <>
              <div className="flex justify-between border-t border-dashed border-slate-300 pt-1">
                <span>{pagoExtra.etiqueta.toUpperCase()}:</span>
                <span>-{moneda(pagoExtra.anticipos)}</span>
              </div>
              <div className="flex justify-between">
                <span>REMANENTE ESTIMADO:</span>
                <span>{moneda(pagoExtra.remanenteEstimado)}</span>
              </div>
            </>
          )}
        </div>

        <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[10px]">
          <div className="flex justify-between">
            <span>DICTAMEN CALIDAD</span>
            <span className="font-semibold uppercase">
              {ticket.defectosPct}% defectos
            </span>
          </div>
          <div className="flex justify-between">
            <span>MERMA ESTIMADA</span>
            <span>{formatearKilos(ticket.kilosMerma)} kg</span>
          </div>
          <p className="pt-1 text-[9px] leading-tight text-slate-500">
            El pago se calcula sobre el peso neto. La merma es informativa para
            control fitosanitario.
          </p>
        </div>

        {urlPago && (
          <div className="mb-3 mt-2.5 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-[9px]">
            <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
              <QRCodeSVG
                value={urlPago}
                size={64}
                level="M"
                includeMargin={false}
                bgColor="#f8fafc"
                fgColor="#0f172a"
              />
            </div>
            <p className="font-semibold uppercase tracking-wide">
              Consulta tu pago
            </p>
            <p className="mt-1 break-all text-slate-500">{urlPago}</p>
          </div>
        )}

        {empresa.notaMovilizacion && (
          <p className="border-b border-dashed border-slate-300 pb-2 text-center text-[9px] leading-tight text-slate-500">
            {empresa.notaMovilizacion}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4 text-center text-[9px]">
          <div>
            <p className="mb-1 truncate font-semibold">
              {ticket.operador || " "}
            </p>
            <div className="border-t border-slate-500 pt-2 tracking-[0.15em]">
              FIRMA OPERADOR
            </div>
          </div>
          <div>
            <p className="mb-1 truncate font-semibold">
              {ticket.productor === "SIN ASIGNAR" ? " " : ticket.productor}
            </p>
            <div className="border-t border-slate-500 pt-2 tracking-[0.15em]">
              FIRMA PRODUCTOR
            </div>
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1 text-[9px] font-bold tracking-[0.2em]">
          <Ticket className="h-3 w-3" aria-hidden="true" />
          GRACIAS POR SU PREFERENCIA
        </p>
      </div>
      <BordeDentado anchoPx={anchoPx} />
    </div>
  );
}

export function TicketBascula({ ticket, onImprimir, empresa = COMPANY_INFO, ancho = "80mm" }: TicketBasculaProps) {
  const copiarResumen = async () => {
    const texto = formatearResumenWhatsApp(ticket);
    const ok = await copiarTextoTicket(texto);
    if (ok) {
      toast.success("Resumen copiado", {
        description: "Pégalo en WhatsApp o SMS para enviarlo al productor.",
      });
    } else {
      toast.error("No se pudo copiar el resumen", {
        description: "Intenta de nuevo o cópialo manualmente.",
      });
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="no-print mb-4 flex flex-col gap-3 border-b border-emerald-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500 p-2 text-emerald-950">
            <Printer className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Vista previa exacta del ticket</h3>
            <p className="text-sm text-muted-foreground">
              {ticket.borrador
                ? "Captura en curso"
                : `Boleta del lote ${ticket.numeroLote}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-300 text-xs">
            Papel {ancho}
          </Badge>
          <Badge
            variant="outline"
            className={
              ticket.borrador
                ? "border-amber-300 text-amber-700"
                : "border-emerald-300 text-emerald-700"
            }
          >
            {ticket.borrador ? "Borrador" : "Guardado"}
          </Badge>
          <Button
            type="button"
            className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            onClick={onImprimir}
            disabled={ticket.pesoNeto <= 0}
          >
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
            Imprimir ticket
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={copiarResumen}
            disabled={ticket.pesoNeto <= 0}
            data-testid="copiar-whatsapp"
          >
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            Copiar WhatsApp
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[360px] rounded-xl bg-slate-100 p-4 shadow-inner">
        <PapelTicket ticket={ticket} empresa={empresa} ancho={ancho} id="ticket-recepcion" />
      </div>
    </section>
  );
}
