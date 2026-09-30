import { CheckCircle2, PencilLine } from "lucide-react";
import { formatoKilos, formatoPesos } from "../../lib/recepcion/calculos";
import type { TotalesLiquidacion } from "../../lib/finanzas/calculos";

interface LiquidacionConfirmationModalProps {
  open: boolean;
  productorDisplay: string;
  totales: TotalesLiquidacion;
  isSaving?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

function Linea({ e, v, rojo = false }: { e: string; v: string; rojo?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <dt className="text-slate-600">{e}</dt>
      <dd className={`font-mono font-bold ${rojo ? "text-rose-600" : "text-slate-900"}`}>{v}</dd>
    </div>
  );
}

/**
 * Confirmación obligatoria antes de registrar la póliza contable:
 * desglose visual completo de la liquidación a pagar.
 */
export function LiquidacionConfirmationModal({
  open,
  productorDisplay,
  totales: t,
  isSaving = false,
  onConfirm,
  onBack,
}: LiquidacionConfirmationModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmación de liquidación"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-slate-900">Confirmar liquidación</h3>
        <p className="mt-1 text-sm font-bold text-emerald-800">{productorDisplay}</p>
        <dl className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 px-4 py-3">
          <Linea e="Boletas procesadas" v={String(t.nBoletas)} />
          <Linea e="Kilos Netos totales" v={formatoKilos(t.kilosNetos)} />
          <Linea e="Precio pactado promedio /kg" v={formatoPesos(t.precioPromedio)} />
          <Linea e="Subtotal Fruta Bruta" v={formatoPesos(t.subtotalFruta)} />
          <Linea e="(−) Anticipos amortizados" v={`-${formatoPesos(t.anticipos)}`} rojo />
          <Linea e="(−) Deducción báscula" v={`-${formatoPesos(t.deduccionBascula)}`} rojo />
          <Linea
            e="(−) Deducción operativa por kilo"
            v={`-${formatoPesos(t.deduccionOperativa)}`}
            rojo
          />
        </dl>
        <div className="mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-center">
          <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            Importe total neto a pagar
          </p>
          <p className="font-mono text-2xl font-black text-amber-400">
            {formatoPesos(t.totalNeto)}
          </p>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <PencilLine className="h-4 w-4" />
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSaving ? "Registrando…" : "Confirmar y Pagar"}
          </button>
        </div>
      </div>
    </div>
  );
}
