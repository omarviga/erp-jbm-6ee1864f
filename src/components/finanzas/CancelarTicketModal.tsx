import { useEffect, useState } from "react";
import { AlertTriangle, Ban, X } from "lucide-react";
import {
  MOTIVO_CANCELACION_MINIMO,
  validarMotivoCancelacion,
} from "../../lib/tickets/cancelacion";

interface CancelarTicketModalProps {
  open: boolean;
  folio: string;
  isSaving?: boolean;
  onConfirm: (motivo: string) => void | Promise<void>;
  onBack: () => void;
}

/** Confirmación de cancelación de ticket con motivo obligatorio. */
export function CancelarTicketModal({
  open,
  folio,
  isSaving = false,
  onConfirm,
  onBack,
}: CancelarTicketModalProps) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (open) setMotivo("");
  }, [open ]);

  if (!open) return null;

  const errores = validarMotivoCancelacion(motivo);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Cancelar ticket"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Ban className="h-5 w-5 text-rose-600" />
            Cancelar ticket
          </h3>
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            aria-label="Cerrar"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 font-mono text-sm font-bold text-slate-700">{folio}</p>

        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          La cancelación es individual e irreversible: anula la nota por pagar
          de este ticket y queda registrada con tu usuario, fecha y motivo.
        </p>

        <label
          htmlFor="cancelar-motivo"
          className="mt-4 mb-1 block text-sm font-bold text-slate-700"
        >
          Motivo de cancelación
        </label>
        <textarea
          id="cancelar-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={`Ej. Ticket duplicado por error de captura (mínimo ${MOTIVO_CANCELACION_MINIMO} caracteres)`}
          rows={3}
          maxLength={280}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
        />
        {motivo.length > 0 && errores.length > 0 && (
          <p className="mt-1 text-xs font-bold text-rose-600">{errores[0]}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(motivo.trim())}
            disabled={isSaving || errores.length > 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-700 px-4 py-3 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50"
          >
            <Ban className="h-4 w-4" />
            {isSaving ? "Cancelando…" : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}
