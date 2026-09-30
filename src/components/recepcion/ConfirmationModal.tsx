import { AlertTriangle, CheckCircle2, PencilLine } from "lucide-react";
import {
  formatoKilos,
  formatoPesos,
  type ErrorValidacionRecepcion,
} from "../../lib/recepcion/calculos";

export type AccionConfirmacion = "guardar" | "imprimir";

interface ConfirmationModalProps {
  open: boolean;
  accion: AccionConfirmacion;
  pesoNeto: number;
  totalLiquidar: number;
  anticipos?: number;
  remanenteEstimado?: number;
  errores: ErrorValidacionRecepcion[];
  isSaving?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

/**
 * Segundo paso antes de asentar en BD: muestra errores de validación
 * o el resumen (neto certificado + total) para confirmación explícita.
 */
export function ConfirmationModal({
  open,
  accion,
  pesoNeto,
  totalLiquidar,
  anticipos = 0,
  remanenteEstimado = 0,
  errores,
  isSaving = false,
  onConfirm,
  onBack,
}: ConfirmationModalProps) {
  if (!open) return null;
  const bloqueado = errores.length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmación de pesaje"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        {bloqueado ? (
          <>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-rose-100 p-2">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  No se puede guardar
                </h3>
                <p className="text-sm text-slate-500">
                  Corrige los siguientes puntos:
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {errores.map((e) => (
                <li
                  key={e.codigo}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
                >
                  {e.mensaje}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onBack}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              <PencilLine className="h-4 w-4" />
              Volver a Editar
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-black text-slate-900">
              {accion === "imprimir"
                ? "Confirmar, guardar e imprimir"
                : "Confirmar y guardar pesaje"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Se asentará en la base de datos con los siguientes valores
              certificados:
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center">
                <p className="text-[11px] font-bold tracking-wide text-emerald-700 uppercase">
                  Peso Neto Certificado
                </p>
                <p className="mt-1 font-mono text-xl font-black text-emerald-900">
                  {formatoKilos(pesoNeto)}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-center">
                <p className="text-[11px] font-bold tracking-wide text-amber-700 uppercase">
                  Total Neto a Liquidar
                </p>
                <p className="mt-1 font-mono text-xl font-black text-amber-900">
                  {formatoPesos(totalLiquidar)}
                </p>
              </div>
            </div>
            {anticipos > 0 && (
              <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-sky-800">Anticipo en recepción</span>
                  <span className="font-mono font-bold text-sky-900">
                    -{formatoPesos(anticipos)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sky-800">Remanente estimado</span>
                  <span className="font-mono font-bold text-sky-900">
                    {formatoPesos(remanenteEstimado)}
                  </span>
                </div>
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onBack}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <PencilLine className="h-4 w-4" />
                Volver a Editar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isSaving ? "Guardando…" : "Confirmar y Guardar Pesaje"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
