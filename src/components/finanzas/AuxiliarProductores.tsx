import { FileDown } from "lucide-react";
import { formatoKilos, formatoPesos } from "../../lib/recepcion/calculos";
import { nombreProductorDisplay } from "../../lib/finanzas/calculos";
import type { CuentaCorrienteProductor } from "./types";

interface AuxiliarProductoresProps {
  cuentas: CuentaCorrienteProductor[];
  onEstadoCuenta: (productorId: string) => void;
}

/** Auxiliar contable: cuentas corrientes de los productores. */
export function AuxiliarProductores({ cuentas, onEstadoCuenta }: AuxiliarProductoresProps) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-black text-slate-900">
          Auxiliar Contable de Productores
        </h2>
        <p className="text-xs text-slate-500">Cuentas corrientes de proveedores</p>
      </div>
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
            <th className="px-3 py-2">Alias</th>
            <th className="px-3 py-2">Productor</th>
            <th className="px-3 py-2 text-right">Kilos históricos</th>
            <th className="px-3 py-2 text-right">Precio prom.</th>
            <th className="px-3 py-2 text-right">Pagos dispersados</th>
            <th className="px-3 py-2 text-right">Por liquidar</th>
            <th className="px-3 py-2 text-right">Estado de cuenta</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => (
            <tr key={c.productor.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 font-mono font-bold text-emerald-800">
                {c.productor.alias?.trim() ? `"${c.productor.alias.trim()}"` : "—"}
              </td>
              <td className="px-3 py-2 font-medium">
                {nombreProductorDisplay({
                  id: c.productor.id,
                  alias: c.productor.alias,
                  nombreLegal: c.productor.nombreLegal,
                })}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatoKilos(c.kilosEntregados)}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatoPesos(c.precioPromedio)}/kg
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatoPesos(c.pagosDispersados)}
              </td>
              <td className="px-3 py-2 text-right font-mono font-black">
                {formatoPesos(c.porLiquidar)}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onEstadoCuenta(c.productor.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Estado de Cuenta PDF
                </button>
              </td>
            </tr>
          ))}
          {cuentas.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                Sin cuentas por mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
