import { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { formatoKilos, formatoPesos } from "../../lib/recepcion/calculos";
import {
  clavePeriodo,
  consolidarDeducciones,
  type ModoPeriodo,
  type MovimientoDeduccion,
} from "../../lib/finanzas/calculos";
import {
  abrirVentanaImpresion,
  exportarCsv,
  generarHtmlReporteDeduccion,
} from "../../lib/finanzas/documentos";

export interface FilaReporteExport {
  display: string;
  nBoletas: number;
  kilosNetos: number;
  deduccionFija: number;
  provision: number;
  total: number;
}

interface ReporteDeduccionOperativaProps {
  /** Una fila por boleta procesada (productor + kilos + fecha). */
  movimientos: (MovimientoDeduccion & { folioBascula: string })[];
  nombres: Record<string, string>; // productorId -> display
  /** Overrides de exportación (por defecto: CSV + ventana de impresión). */
  onExportarExcel?: (periodo: string, filas: FilaReporteExport[]) => void | Promise<void>;
  onExportarPdf?: (periodo: string, filas: FilaReporteExport[], total: number, kilos: number) => void | Promise<void>;
}

const MODOS: { id: ModoPeriodo; etiqueta: string }[] = [
  { id: "diario", etiqueta: "Diario" },
  { id: "semanal", etiqueta: "Semanal" },
  { id: "quincenal", etiqueta: "Quincenal" },
  { id: "mensual", etiqueta: "Mensual" },
];

/**
 * Consolidado de deducción operativa por periodo, con kilos y productor.
 * Exportable a Excel (CSV) y PDF.
 */
export function ReporteDeduccionOperativa({
  movimientos,
  nombres,
  onExportarExcel,
  onExportarPdf,
}: ReporteDeduccionOperativaProps) {
  const [modo, setModo] = useState<ModoPeriodo>("semanal");
  const [periodo, setPeriodo] = useState("");

  const periodos = useMemo(() => {
    const set = new Set(movimientos.map((m) => clavePeriodo(m.fecha, modo)));
    return [...set].sort().reverse();
  }, [movimientos, modo]);

  const periodoActivo = periodo || periodos[0] || "";
  const filtrados = useMemo(
    () => movimientos.filter((m) => clavePeriodo(m.fecha, modo) === periodoActivo),
    [movimientos, modo, periodoActivo],
  );
  const filas = useMemo(() => consolidarDeducciones(filtrados).map((c) => ({
    ...c,
    display: nombres[c.productorId] ?? c.productorId,
  })), [filtrados, nombres]);
  const totalKilos = filas.reduce((s, f) => s + f.kilosNetos, 0);
  const total = filas.reduce((s, f) => s + f.total, 0);

  const exportarExcel = () => {
    if (onExportarExcel) return onExportarExcel(periodoActivo, filas);
    return exportarCsv(`deduccion_operativa_${periodoActivo}`, [
      "Productor",
      "Boletas",
      "Kilos netos",
      "Deducción fija ($30/boleta)",
      "Provisión ($0.04/kg)",
      "Total",
    ], filas.map((f) => [f.display, f.nBoletas, f.kilosNetos, f.deduccionFija, f.provision, f.total]));
  };

  const exportarPdf = () => {
    if (onExportarPdf) return onExportarPdf(periodoActivo, filas, total, totalKilos);
    return abrirVentanaImpresion(
      `Deducción operativa ${periodoActivo}`,
      generarHtmlReporteDeduccion(
        periodoActivo,
        filas.map((f) => ({
          productorDisplay: f.display,
          nBoletas: f.nBoletas,
          kilosNetos: f.kilosNetos,
          deduccionFija: f.deduccionFija,
          provision: f.provision,
          total: f.total,
        })),
        total,
        totalKilos,
      ),
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-900">
            Deducción Operativa — Consolidado
          </h2>
          <p className="text-xs text-slate-500">Kilos y deducción por productor y periodo</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportarExcel}
            disabled={filas.length === 0}
            className="flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={exportarPdf}
            disabled={filas.length === 0}
            className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Modo de periodo">
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={modo === m.id}
              onClick={() => {
                setModo(m.id);
                setPeriodo("");
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                modo === m.id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
        <select
          value={periodoActivo}
          onChange={(e) => setPeriodo(e.target.value)}
          aria-label="Periodo"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
        >
          {periodos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
              <th className="px-3 py-2">Productor</th>
              <th className="px-3 py-2 text-right">Boletas</th>
              <th className="px-3 py-2 text-right">Kilos</th>
              <th className="px-3 py-2 text-right">Ded. fija</th>
              <th className="px-3 py-2 text-right">Provisión</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.productorId} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{f.display}</td>
                <td className="px-3 py-2 text-right font-mono">{f.nBoletas}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoKilos(f.kilosNetos)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(f.deduccionFija)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(f.provision)}</td>
                <td className="px-3 py-2 text-right font-mono font-black">
                  {formatoPesos(f.total)}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Sin movimientos en este periodo.
                </td>
              </tr>
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-amber-50 font-black">
                <td className="px-3 py-2">Total periodo</td>
                <td className="px-3 py-2 text-right font-mono">
                  {filas.reduce((s, f) => s + f.nBoletas, 0)}
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatoKilos(totalKilos)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
