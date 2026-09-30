import { FileDown, HandCoins } from "lucide-react";
import { formatoKilos, formatoPesos } from "../../lib/recepcion/calculos";
import {
  calcularSaldoLiquidacion,
  nombreProductorDisplay,
} from "../../lib/finanzas/calculos";
import { ETIQUETA_ESTADO, type Liquidacion } from "./types";

interface HistorialLiquidacionesProps {
  liquidaciones: Liquidacion[];
  onAbonar: (liq: Liquidacion) => void;
  onDescargarPdf: (liq: Liquidacion) => void;
}

/** Historial de liquidaciones emitidas con abono por fila (pagos mixtos). */
export function HistorialLiquidaciones({
  liquidaciones,
  onAbonar,
  onDescargarPdf,
}: HistorialLiquidacionesProps) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-black text-slate-900">
          Historial de Liquidaciones Emitidas
        </h2>
      </div>
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
            <th className="px-3 py-2">Folio</th>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Productor</th>
            <th className="px-3 py-2 text-right">Boletas</th>
            <th className="px-3 py-2 text-right">Kilos</th>
            <th className="px-3 py-2 text-right">Total neto</th>
            <th className="px-3 py-2 text-right">Abonado</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {liquidaciones.map((liq) => {
            const s = calcularSaldoLiquidacion(liq.totales.totalNeto, liq.abonos);
            return (
              <tr key={liq.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-bold">{liq.folio}</td>
                <td className="px-3 py-2 whitespace-nowrap">{liq.fecha.slice(0, 10)}</td>
                <td className="px-3 py-2 font-medium">
                  {nombreProductorDisplay({
                    id: liq.productor.id,
                    alias: liq.productor.alias,
                    nombreLegal: liq.productor.nombreLegal,
                  })}
                </td>
                <td className="px-3 py-2 text-right font-mono">{liq.totales.nBoletas}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatoKilos(liq.totales.kilosNetos)}
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold">
                  {formatoPesos(liq.totales.totalNeto)}
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(s.abonado)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold">
                  {formatoPesos(s.saldo)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                      s.estado === "pagada"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {ETIQUETA_ESTADO[s.estado]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    {s.estado !== "pagada" && (
                      <button
                        type="button"
                        onClick={() => onAbonar(liq)}
                        className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                      >
                        <HandCoins className="h-3.5 w-3.5" />
                        Abonar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDescargarPdf(liq)}
                      title="Descargar Boleta Oficial (PDF)"
                      className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {liquidaciones.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                Aún no hay liquidaciones emitidas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
