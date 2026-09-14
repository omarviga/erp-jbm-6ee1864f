import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASOS_RECEPCION } from "./tipos";
import type { RecepcionFormState } from "./tipos";
import type { ResultadoCalculoRecepcion } from "@/lib/recepcion/calculos";

interface StepperRecepcionProps {
  pasoActual: number;
  pasoMaximo: number;
  form: RecepcionFormState;
  calculo: ResultadoCalculoRecepcion;
  onIrAPaso: (paso: number) => void;
}

export function StepperRecepcion({
  pasoActual,
  pasoMaximo,
  form,
  calculo,
  onIrAPaso,
}: StepperRecepcionProps) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PASOS_RECEPCION.map((paso) => {
        const activo = paso.id === pasoActual;
        const completado = paso.id < pasoActual;
        const alcanzable = paso.id <= pasoMaximo;

        return (
          <li key={paso.id}>
            <button
              type="button"
              onClick={() => alcanzable && onIrAPaso(paso.id)}
              disabled={!alcanzable}
              aria-current={activo ? "step" : undefined}
              className={cn(
                "flex h-full w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                activo
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : completado
                    ? "border-emerald-200 bg-white hover:bg-emerald-50/60"
                    : "border-slate-200 bg-slate-50",
                alcanzable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  activo
                    ? "bg-emerald-500 text-emerald-950"
                    : completado
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-slate-300 text-slate-600"
                )}
              >
                {completado ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : alcanzable ? (
                  paso.id
                ) : (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>

              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  {paso.titulo}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {paso.descripcion}
                </span>
                <span
                  className={cn(
                    "mt-1.5 block truncate text-xs font-medium",
                    activo ? "text-emerald-700" : "text-slate-500"
                  )}
                >
                  {paso.resumen(form, calculo)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
