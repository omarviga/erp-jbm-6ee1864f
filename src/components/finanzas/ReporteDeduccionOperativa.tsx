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
import type { FilaDetalleTicket } from "../../lib/finanzas/mapeo";

export interface FilaReporteExport {
  display: string;
  nBoletas: number;
  kilosNetos: number;
  deduccion: number;
}

interface ReporteDeduccionOperativaProps {
  /** Una fila por boleta procesada (productor + kilos + fecha). */
  movimientos: (MovimientoDeduccion & { folioBascula: string })[];
  nombres: Record<string, string>; // productorId -> display
  /** Detalle ticket por ticket (se filtra por el periodo activo). */
  detalle?: FilaDetalleTicket[];
  /** Overrides de exportación (por defecto: CSV + ventana de impresión). */
  onExportarExcel?: (periodo: string, filas: FilaReporteExport[], detallePeriodo: FilaDetalleTicket[]) => void | Promise<void>;
  onExportarPdf?: (periodo: string, filas: FilaReporteExport[], total: number, kilos: number, detallePeriodo: FilaDetalleTicket[]) => void | Promise<void>;
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
  detalle = [],
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
  const total = filas.reduce((s, f) => s + f.deduccion, 0);

  const detalleFiltrado = useMemo(
    () =>
      detalle.filter(
        (f) => f.fecha !== "" && clavePeriodo(f.fecha, modo) === periodoActivo,
      ),
    [detalle, modo, periodoActivo],
  );
  const totalesDetalle = useMemo(
    () => ({
      kilos: detalleFiltrado.reduce((s, f) => s + f.kilosNetos, 0),
      subtotal: detalleFiltrado.reduce((s, f) => s + f.subtotal, 0),
      deduccion: detalleFiltrado.reduce((s, f) => s + f.deduccion, 0),
      bascula: detalleFiltrado.reduce((s, f) => s + f.bascula, 0),
      neto: detalleFiltrado.reduce((s, f) => s + f.neto, 0),
    }),
    [detalleFiltrado],
  );

  const exportarExcel = () => {
    if (onExportarExcel) return onExportarExcel(periodoActivo, filas, detalleFiltrado);
    return exportarCsv(`deduccion_operativa_${periodoActivo}`, [
      "Productor",
      "Boletas",
      "Kilos netos",
      "Deducción operativa",
    ], filas.map((f) => [f.display, f.nBoletas, f.kilosNetos, f.deduccion]));
  };

  const exportarPdf = () => {
    if (onExportarPdf) return onExportarPdf(periodoActivo, filas, total, totalKilos, detalleFiltrado);
    return abrirVentanaImpresion(
      `Deducción operativa ${periodoActivo}`,
      generarHtmlReporteDeduccion(
        periodoActivo,
        filas.map((f) => ({
          productorDisplay: f.display,
          nBoletas: f.nBoletas,
          kilosNetos: f.kilosNetos,
          deduccion: f.deduccion,
        })),
        total,
        totalKilos,
        detalleFiltrado.map((f) => ({
          fecha: f.fecha.slice(0, 10),
          ticket: f.ticket,
          productorDisplay: f.productorDisplay,
          kilosNetos: f.kilosNetos,
          precioKg: f.precioKg,
          subtotal: f.subtotal,
          deduccion: f.deduccion,
          bascula: f.bascula,
          neto: f.neto,
        })),
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
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
              <th className="px-3 py-2">Productor</th>
              <th className="px-3 py-2 text-right">Boletas</th>
              <th className="px-3 py-2 text-right">Kilos</th>
              <th className="px-3 py-2 text-right">Deducción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.productorId} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{f.display}</td>
                <td className="px-3 py-2 text-right font-mono">{f.nBoletas}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoKilos(f.kilosNetos)}</td>
                <td className="px-3 py-2 text-right font-mono font-black">
                  {formatoPesos(f.deduccion)}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
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
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <h3 className="mt-6 text-sm font-black text-slate-900">
        Detalle por ticket
      </h3>
      <p className="text-xs text-slate-500">
        Auditoría: cada fila es un ticket con sus valores congelados.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Ticket</th>
              <th className="px-3 py-2">Productor</th>
              <th className="px-3 py-2 text-right">Kilos</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
              <th className="px-3 py-2 text-right">Deducción</th>
              <th className="px-3 py-2 text-right">Báscula</th>
              <th className="px-3 py-2 text-right">Neto</th>
            </tr>
          </thead>
          <tbody>
            {detalleFiltrado.map((f) => (
              <tr key={f.id} className="border-t border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap">{f.fecha.slice(0, 10)}</td>
                <td className="px-3 py-2 font-mono font-bold">{f.ticket}</td>
                <td className="px-3 py-2 font-medium">{f.productorDisplay}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoKilos(f.kilosNetos)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(f.precioKg)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(f.subtotal)}</td>
                <td className="px-3 py-2 text-right font-mono text-rose-600">
                  {f.deduccion > 0 ? `-${formatoPesos(f.deduccion)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-rose-600">
                  {f.bascula > 0 ? `-${formatoPesos(f.bascula)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black">
                  {formatoPesos(f.neto)}
                </td>
              </tr>
            ))}
            {detalleFiltrado.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Sin tickets en este periodo.
                </td>
              </tr>
            )}
          </tbody>
          {detalleFiltrado.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-amber-50 font-black">
                <td className="px-3 py-2" colSpan={3}>Total periodo</td>
                <td className="px-3 py-2 text-right font-mono">{formatoKilos(totalesDetalle.kilos)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(totalesDetalle.subtotal)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(totalesDetalle.deduccion)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(totalesDetalle.bascula)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatoPesos(totalesDetalle.neto)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
