import { Download, Printer, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { COMPANY_INFO } from "@/lib/company";
import { moneda } from "@/lib/recepcion/calculos";
import type { FormaPagoBascula } from "@/lib/recepcion/calculos";

export interface TicketRecepcion {
  folioOficial: string;
  folioFisico: string;
  numeroLote: string;
  productor: string;
  origen: string;
  huerto: string;
  localidad: string;
  variedad: string;
  chofer: string;
  placas: string;
  rejas: string;
  pesoBruto: number;
  taraVehiculo: number;
  taraRejas: number;
  taraTotal: number;
  pesoNeto: number;
  kilosMerma: number;
  defectosPct: number;
  precioKg: number;
  subtotal: number;
  costoBascula: number;
  basculaFormaPago: FormaPagoBascula;
  cuotaManiobra: number;
  total: number;
  fecha: string;
  statusUrl: string;
  /** true cuando el ticket muestra la captura en curso, no un lote guardado. */
  borrador: boolean;
}

interface TicketBasculaProps {
  ticket: TicketRecepcion;
  onImprimir: () => void;
}

export function TicketBascula({ ticket, onImprimir }: TicketBasculaProps) {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="no-print mb-4 flex flex-col gap-3 border-b border-emerald-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500 p-2 text-emerald-950">
            <Printer className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Boleta y ticket térmico (80 mm)</h3>
            <p className="text-sm text-muted-foreground">
              {ticket.borrador
                ? "Vista previa de la captura en curso"
                : `Boleta del lote ${ticket.numeroLote}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            onClick={onImprimir}
            disabled={ticket.pesoNeto <= 0}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[360px] rounded-xl bg-slate-100 p-4 shadow-inner">
        <div
          id="ticket-recepcion"
          className="ticket-print-root mx-auto w-[302px] bg-white px-4 py-3 font-mono text-[11px] leading-5 text-slate-900 shadow-lg"
        >
          <div className="border-b border-dashed border-slate-300 pb-2 text-center">
            <img
              src="/logo-ticket.png"
              alt="Logo JBM"
              className="mx-auto mb-1.5 h-14 w-auto object-contain"
            />
            <p className="text-[14px] font-black leading-none tracking-wide">
              {COMPANY_INFO.displayName.toUpperCase()}
            </p>
            <p className="mt-1 text-[9px] leading-tight text-slate-600">
              {COMPANY_INFO.legalName}
            </p>
            <p className="text-[9px] leading-tight text-slate-600">
              {COMPANY_INFO.addressLine1}
            </p>
            <p className="text-[9px] leading-tight text-slate-600">
              {COMPANY_INFO.addressLine2} · Tel. {COMPANY_INFO.phone}
            </p>

            <p className="mt-2 text-[9px] uppercase tracking-[0.25em] text-slate-500">
              Boleta de recepción
            </p>
            <p className="mt-0.5 text-[22px] font-black leading-none">
              {ticket.folioOficial || "POR ASIGNAR"}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">{ticket.fecha}</p>
            {ticket.folioFisico && (
              <p className="text-[9px] text-slate-500">
                Ticket báscula: {ticket.folioFisico}
              </p>
            )}
            <p className="text-[9px] text-slate-500">
              Lote: {ticket.numeroLote || "—"}
            </p>
          </div>

          <div className="my-2.5 space-y-1 border-b border-dashed border-slate-300 pb-2 text-[10px]">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">PRODUCTOR</span>
              <span className="max-w-[58%] text-right">{ticket.productor}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="font-semibold">ORIGEN</span>
              <span className="text-right">{ticket.origen}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="font-semibold">HUERTO</span>
              <span className="text-right">{ticket.huerto}</span>
            </div>
            {ticket.localidad && (
              <div className="flex justify-between gap-2">
                <span className="font-semibold">LOCALIDAD</span>
                <span className="text-right">{ticket.localidad}</span>
              </div>
            )}
            {ticket.variedad && (
              <div className="flex justify-between gap-2">
                <span className="font-semibold">VARIEDAD</span>
                <span className="text-right">{ticket.variedad}</span>
              </div>
            )}
            {(ticket.placas || ticket.chofer) && (
              <div className="flex justify-between gap-2">
                <span className="font-semibold">TRANSPORTE</span>
                <span className="text-right">
                  {[ticket.placas, ticket.chofer].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            {ticket.rejas && (
              <div className="flex justify-between gap-2">
                <span className="font-semibold">REJAS</span>
                <span className="text-right">{ticket.rejas}</span>
              </div>
            )}
          </div>

          <div className="space-y-1 text-[11px]">
            <p className="text-center text-[10px] font-semibold tracking-wide">
              DETALLE DE PESO (KG)
            </p>
            <div className="flex justify-between">
              <span>1ª PESADA (BRUTO)</span>
              <span>{ticket.pesoBruto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>2ª PESADA (TARA VEH.)</span>
              <span>- {ticket.taraVehiculo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            {ticket.taraRejas > 0 && (
              <div className="flex justify-between">
                <span>TARA REJAS/TARIMAS</span>
                <span>- {ticket.taraRejas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-semibold">TARA TOTAL</span>
              <span>- {ticket.taraTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-dashed border-slate-300 pt-1.5 text-[16px] font-black">
              <span>NETO</span>
              <span>{ticket.pesoNeto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="my-2.5 space-y-1 border-t border-b border-dashed border-slate-300 py-2 text-[11px]">
            <div className="flex justify-between">
              <span>PRECIO/KG</span>
              <span>{moneda(ticket.precioKg)}</span>
            </div>
            <div className="flex justify-between">
              <span>SUBTOTAL</span>
              <span>{moneda(ticket.subtotal)}</span>
            </div>
            {ticket.costoBascula > 0 && (
              <div className="flex justify-between">
                <span>
                  BÁSCULA
                  {ticket.basculaFormaPago === "efectivo" ? " (EFECTIVO)" : ""}
                </span>
                <span>
                  {ticket.basculaFormaPago === "efectivo" ? "" : "- "}
                  {moneda(ticket.costoBascula)}
                </span>
              </div>
            )}
            {ticket.cuotaManiobra > 0 && (
              <div className="flex justify-between">
                <span>MANIOBRA/ESTIBA</span>
                <span>- {moneda(ticket.cuotaManiobra)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between bg-slate-900 px-2 py-1.5 text-[15px] font-black text-white">
              <span>TOTAL</span>
              <span>{moneda(ticket.total)}</span>
            </div>
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
              <span>
                {ticket.kilosMerma.toLocaleString("es-MX", { minimumFractionDigits: 2 })} kg
              </span>
            </div>
            <p className="pt-1 text-[9px] leading-tight text-slate-500">
              El pago se calcula sobre el peso neto. La merma es informativa para
              control fitosanitario.
            </p>
          </div>

          <div className="mb-3 mt-2.5 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-[9px]">
            <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
              <QRCodeSVG
                value={ticket.statusUrl}
                size={64}
                level="M"
                includeMargin={false}
                bgColor="#f8fafc"
                fgColor="#0f172a"
              />
            </div>
            <p className="font-semibold uppercase tracking-wide">
              Trazabilidad del lote
            </p>
            <p className="mt-1 break-all text-slate-500">{ticket.statusUrl}</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 text-center text-[9px]">
            <div>
              <div className="border-t border-slate-500 pt-2 tracking-[0.15em]">
                OPERADOR DE BÁSCULA
              </div>
            </div>
            <div>
              <div className="border-t border-slate-500 pt-2 tracking-[0.15em]">
                PRODUCTOR / CHOFER
              </div>
            </div>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1 text-[9px] font-bold tracking-[0.2em]">
            <Ticket className="h-3 w-3" aria-hidden="true" />
            GRACIAS POR SU PREFERENCIA
          </p>
        </div>
      </div>
    </section>
  );
}
