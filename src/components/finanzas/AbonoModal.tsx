import { useMemo, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import {
  formatoPesos,
  parseNumero,
} from "../../lib/recepcion/calculos";
import {
  calcularSaldoLiquidacion,
  validarAbono,
  type MetodoAbono,
} from "../../lib/finanzas/calculos";
import { ETIQUETA_METODO, type Abono } from "./types";

export interface NuevoAbono {
  metodo: MetodoAbono;
  referencia: string;
  importe: number;
}

interface AbonoModalProps {
  open: boolean;
  folioLiquidacion: string;
  productorDisplay: string;
  totalNeto: number;
  abonosPrevios: Abono[];
  isSaving?: boolean;
  onClose: () => void;
  onGuardar: (abono: NuevoAbono) => void | Promise<void>;
}

const inputBase =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

/**
 * Registro de pagos mixtos: cada abono indica método e importe; el cheque
 * exige folio/referencia. Proyecta el saldo en tiempo real; al llegar a
 * $0.00 exacto la liquidación pasa automáticamente a PAGADA.
 */
export function AbonoModal({
  open,
  folioLiquidacion,
  productorDisplay,
  totalNeto,
  abonosPrevios,
  isSaving = false,
  onClose,
  onGuardar,
}: AbonoModalProps) {
  const [metodo, setMetodo] = useState<MetodoAbono>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [importeTxt, setImporteTxt] = useState("");
  const [intento, setIntento] = useState(false);

  const base = useMemo(
    () => calcularSaldoLiquidacion(totalNeto, abonosPrevios),
    [totalNeto, abonosPrevios],
  );
  const importe = parseNumero(importeTxt);
  const errores = useMemo(
    () =>
      validarAbono({
        importe,
        saldoPendiente: base.saldo,
        metodo,
        referencia,
      }),
    [importe, base.saldo, metodo, referencia],
  );
  const proyectado = Math.max(0, base.saldo - (errores.length ? 0 : importe));

  if (!open) return null;

  const liquidarRestante = () => {
    setImporteTxt(base.saldo.toFixed(2));
  };

  const guardar = async () => {
    setIntento(true);
    if (errores.length > 0) return;
    await onGuardar({ metodo, referencia: referencia.trim(), importe });
    setReferencia("");
    setImporteTxt("");
    setIntento(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Abonar liquidación ${folioLiquidacion}`}
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Abonar — {folioLiquidacion}
            </h3>
            <p className="text-sm font-bold text-emerald-800">{productorDisplay}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-100 px-2 py-2">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Total</p>
            <p className="font-mono text-sm font-black">{formatoPesos(totalNeto)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 px-2 py-2">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Abonado</p>
            <p className="font-mono text-sm font-black">{formatoPesos(base.abonado)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-2 py-2">
            <p className="text-[10px] font-bold tracking-wide text-amber-700 uppercase">Saldo</p>
            <p className="font-mono text-sm font-black text-amber-900">{formatoPesos(base.saldo)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="abono-metodo" className="mb-1 block text-sm font-bold text-slate-700">
              Método de pago
            </label>
            <select
              id="abono-metodo"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoAbono)}
              className={inputBase}
            >
              {(Object.keys(ETIQUETA_METODO) as MetodoAbono[]).map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_METODO[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="abono-ref" className="mb-1 block text-sm font-bold text-slate-700">
              {metodo === "cheque" ? "Número de folio / referencia del cheque *" : "Referencia (opcional)"}
            </label>
            <input
              id="abono-ref"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              autoComplete="off"
              placeholder={metodo === "cheque" ? "Ej. CH-88213" : "Ej. SPEI-…"}
              className={`${inputBase} font-mono`}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="abono-importe" className="text-sm font-bold text-slate-700">
                Importe entregado
              </label>
              <button
                type="button"
                onClick={liquidarRestante}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
              >
                Liquidar Saldo Restante Completo
              </button>
            </div>
            <input
              id="abono-importe"
              inputMode="decimal"
              value={importeTxt}
              onChange={(e) => setImporteTxt(e.target.value)}
              autoComplete="off"
              placeholder="0.00"
              className={`${inputBase} font-mono text-base font-black`}
            />
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-center">
          <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            Saldo pendiente proyectado
          </p>
          <p className="font-mono text-xl font-black text-amber-400">
            {formatoPesos(proyectado)}
          </p>
        </div>

        {intento && errores.length > 0 && (
          <ul className="mt-3 space-y-1">
            {errores.map((e) => (
              <li
                key={e.codigo}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
              >
                {e.mensaje}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={guardar}
          disabled={isSaving}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isSaving ? "Guardando…" : "Registrar abono"}
        </button>
      </div>
    </div>
  );
}
