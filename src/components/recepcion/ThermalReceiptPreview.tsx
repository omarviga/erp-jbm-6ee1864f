import { useEffect, useState } from "react";
import { Copy, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { COMPANY_INFO, type DatosFiscalesEmpresa } from "@/lib/company";
import {
  ANCHO_PAPEL_PX,
  copiarTextoTicket,
  formatearResumenWhatsApp,
  type AnchoTicket,
} from "@/lib/recepcion/textoTicket";
import { PapelTicket, type TicketRecepcion } from "./TicketBascula";

interface ThermalReceiptPreviewProps {
  open: boolean;
  onClose: () => void;
  ticket: TicketRecepcion;
  empresa?: DatosFiscalesEmpresa;
  onImprimir?: () => void;
}

const ZOOMS = [80, 100, 120] as const;

/**
 * Visor modal del ticket térmico en alta resolución: control de zoom,
 * conmutador de ancho 80/58 mm, copiar resumen WhatsApp e impresión
 * directa en ticketeras térmicas POS.
 */
export function ThermalReceiptPreview({
  open,
  onClose,
  ticket,
  empresa = COMPANY_INFO,
  onImprimir,
}: ThermalReceiptPreviewProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [ancho, setAncho] = useState<AnchoTicket>("80mm");

  useEffect(() => {
    if (open) {
      setZoom(100);
      setAncho("80mm");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const acercar = () => {
    const idx = ZOOMS.indexOf(zoom as (typeof ZOOMS)[number]);
    if (idx < ZOOMS.length - 1) setZoom(ZOOMS[idx + 1]);
  };
  const alejar = () => {
    const idx = ZOOMS.indexOf(zoom as (typeof ZOOMS)[number]);
    if (idx > 0) setZoom(ZOOMS[idx - 1]);
  };

  const copiarResumen = async () => {
    const ok = await copiarTextoTicket(formatearResumenWhatsApp(ticket));
    if (ok) {
      toast.success("Resumen copiado", {
        description: "Pégalo en WhatsApp para notificar al productor.",
      });
    } else {
      toast.error("No se pudo copiar el resumen");
    }
  };

  const imprimir = () => {
    if (onImprimir) onImprimir();
    else window.print();
  };

  const escala = zoom / 100;
  const anchoPx = ANCHO_PAPEL_PX[ancho];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del ticket térmico"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 bg-slate-900 px-4 py-3">
          <p className="mr-auto text-sm font-black text-white">
            Ticket {ticket.folioFisico || ticket.folioOficial || "—"}
          </p>

          <div className="flex items-center gap-1 rounded-xl bg-slate-800 p-1">
            <button
              type="button"
              onClick={alejar}
              disabled={zoom <= ZOOMS[0]}
              aria-label="Reducir zoom"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span
              className="min-w-12 text-center font-mono text-xs font-bold text-white"
              aria-live="polite"
            >
              {zoom}%
            </span>
            <button
              type="button"
              onClick={acercar}
              disabled={zoom >= ZOOMS[ZOOMS.length - 1]}
              aria-label="Aumentar zoom"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          <div
            className="flex items-center gap-1 rounded-xl bg-slate-800 p-1"
            role="group"
            aria-label="Ancho del papel"
          >
            {(["80mm", "58mm"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAncho(a)}
                aria-pressed={ancho === a}
                className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold ${
                  ancho === a
                    ? "bg-emerald-500 text-emerald-950"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={copiarResumen}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            <Copy className="h-4 w-4" />
            Copiar resumen
          </button>
          <button
            type="button"
            onClick={imprimir}
            disabled={ticket.pesoNeto <= 0}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-auto p-6">
          <div
            className="mx-auto w-fit max-w-full rounded-xl bg-slate-200/60 p-4 shadow-inner"
            style={{ zoom: escala }}
          >
            <PapelTicket ticket={ticket} empresa={empresa} ancho={ancho} imprimible={false} />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            Papel térmico de {ancho} · {anchoPx} px @ 96 dpi · zoom {zoom}%
          </p>
        </div>
      </div>
    </div>
  );
}
