import { useMemo, useState } from "react";
import { Banknote, CheckSquare, Search, Square } from "lucide-react";
import { formatoKilos, formatoPesos } from "../../lib/recepcion/calculos";
import {
  buscarProductores,
  calcularTotalesLiquidacion,
  leerDesgloseBoleta,
  nombreProductorDisplay,
  type BoletaLiquidable,
} from "../../lib/finanzas/calculos";
import { LiquidacionConfirmationModal } from "./LiquidacionConfirmationModal";
import type { ProductorCuenta } from "./types";

export interface LiquidacionConfirmada {
  productor: ProductorCuenta;
  boletas: BoletaLiquidable[];
}

export type BoletaConProductor = BoletaLiquidable & { productorId?: string };

interface MesaControlPagosProps {
  productores: ProductorCuenta[];
  /** Boletas pendientes de pago (todas; el componente filtra por productor). */
  boletasPendientes: BoletaConProductor[];
  isSaving?: boolean;
  onConfirmarLiquidacion: (sel: LiquidacionConfirmada) => void | Promise<void>;
}

/**
 * Pestaña "Liquidaciones a Productores": búsqueda por alias/nombre,
 * tabla de boletas pendientes con selección múltiple, barra de totales
 * en tiempo real y pago con confirmación obligatoria.
 */
export function MesaControlPagos({
  productores,
  boletasPendientes,
  isSaving = false,
  onConfirmarLiquidacion,
}: MesaControlPagosProps) {
  const [query, setQuery] = useState("");
  const [productorId, setProductorId] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);

  const coincidencias = useMemo(
    () => buscarProductores(productores, query),
    [productores, query],
  );
  const productor =
    productores.find((p) => p.id === productorId) ?? null;

  const boletasProductor = useMemo(
    () =>
      boletasPendientes.filter(
        (b) => !productorId || b.productorId === undefined || b.productorId === productorId,
      ),
    [boletasPendientes, productorId],
  );

  const boletasSel = useMemo(
    () => boletasProductor.filter((b) => seleccion.has(b.id)),
    [boletasProductor, seleccion],
  );
  const totales = useMemo(
    () => calcularTotalesLiquidacion(boletasSel),
    [boletasSel],
  );

  const elegirProductor = (id: string) => {
    setProductorId(id);
    setSeleccion(new Set());
  };

  const toggle = (id: string) =>
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const seleccionarTodos = () =>
    setSeleccion((s) =>
      s.size === boletasProductor.length
        ? new Set()
        : new Set(boletasProductor.map((b) => b.id)),
    );

  const confirmar = async () => {
    if (!productor || boletasSel.length === 0) return;
    await onConfirmarLiquidacion({ productor, boletas: boletasSel });
    setSeleccion(new Set());
    setConfirmando(false);
  };

  const todos = boletasProductor.length > 0 && seleccion.size === boletasProductor.length;

  return (
    <div className="space-y-4">
      {/* Cabecera: mesa de control de pagos */}
      <section className="rounded-2xl bg-slate-900 p-4 text-white">
        <h2 className="text-base font-black">Mesa de Control de Pagos</h2>
        <p className="text-xs text-slate-400">
          Filtra al productor por su alias o nombre legal
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Buscar: "Don Angel", "Martel", "Doña Lucía"…'
              autoComplete="off"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2 pr-3 pl-9 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
            />
          </label>
          <select
            value={productorId}
            onChange={(e) => elegirProductor(e.target.value)}
            aria-label="Productor"
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 sm:max-w-xs"
          >
            <option value="">Seleccionar productor…</option>
            {coincidencias.map((p) => (
              <option key={p.id} value={p.id}>
                {nombreProductorDisplay(p)}
              </option>
            ))}
          </select>
        </div>
        {productor && (
          <p className="mt-2 text-sm font-bold text-emerald-400">
            {nombreProductorDisplay(productor)}
            {productor.localidad ? ` — ${productor.localidad}` : ""}
          </p>
        )}
      </section>

      {/* Tabla de boletas pendientes */}
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={seleccionarTodos}
                  className="flex items-center gap-1 font-bold hover:text-slate-900"
                  title="Seleccionar todos"
                >
                  {todos ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  Todos
                </button>
              </th>
              <th className="px-3 py-2">Folio báscula</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 text-right">Bruto</th>
              <th className="px-3 py-2 text-right">Tara</th>
              <th className="px-3 py-2 text-right">Netos</th>
              <th className="px-3 py-2 text-right">Precio/kg</th>
              <th className="px-3 py-2 text-right">Anticipos</th>
              <th className="px-3 py-2 text-right">Ded. báscula</th>
              <th className="px-3 py-2 text-right">Ded. oper.</th>
              <th className="px-3 py-2 text-right">Saldo boleta</th>
            </tr>
          </thead>
          <tbody>
            {boletasProductor.map((b) => {
              const d = leerDesgloseBoleta(b);
              const checked = seleccion.has(b.id);
              return (
                <tr
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className={`cursor-pointer border-t border-slate-100 ${checked ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(b.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Seleccionar ${b.folioBascula}`}
                      className="h-4 w-4 accent-emerald-700"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-bold">{b.folioBascula}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{b.fechaEntrada.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatoKilos(b.pesoBruto)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatoKilos(b.pesoTara)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{formatoKilos(b.kilosNetos)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatoPesos(b.precioKg)}</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-600">
                    {b.anticipos > 0 ? `-${formatoPesos(b.anticipos)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-rose-600">
                    {d.descuentoBascula > 0 ? `-${formatoPesos(d.descuentoBascula)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-rose-600">
                    {d.deduccionOperativa > 0 ? `-${formatoPesos(d.deduccionOperativa)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-black">
                    {formatoPesos(d.saldoNeto)}
                  </td>
                </tr>
              );
            })}
            {boletasProductor.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-slate-500">
                  {productorId
                    ? "Sin boletas pendientes para este productor."
                    : "Selecciona un productor para ver sus boletas pendientes."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Barra de control: totales en tiempo real + pagar */}
      <section className="sticky bottom-0 flex flex-col gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-2xl sm:flex-row sm:items-center">
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <p className="text-[11px] text-slate-400 uppercase">Boletas</p>
            <p className="font-mono font-black">{totales.nBoletas}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase">Kilos netos</p>
            <p className="font-mono font-black">{formatoKilos(totales.kilosNetos)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase">Precio prom.</p>
            <p className="font-mono font-black">{formatoPesos(totales.precioPromedio)}/kg</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase">Total neto</p>
            <p className="font-mono font-black text-amber-400">
              {formatoPesos(totales.totalNeto)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={!productor || boletasSel.length === 0 || isSaving}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          <Banknote className="h-4 w-4" />
          Pagar
        </button>
      </section>

      <LiquidacionConfirmationModal
        open={confirmando}
        productorDisplay={productor ? nombreProductorDisplay(productor) : ""}
        totales={totales}
        isSaving={isSaving}
        onConfirm={confirmar}
        onBack={() => setConfirmando(false)}
      />
    </div>
  );
}
