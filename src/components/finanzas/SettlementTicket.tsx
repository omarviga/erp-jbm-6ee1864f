import { formatoKilos, formatoPesos } from "../../lib/recepcion/calculos";
import type { TotalesLiquidacion } from "../../lib/finanzas/calculos";
import type { Abono } from "./types";
import { ETIQUETA_METODO } from "./types";

export interface DatosTicketLiquidacion {
  folioLiquidacion: string;
  fecha: Date;
  productorDisplay: string;
  totales: TotalesLiquidacion;
  abonos: Abono[];
  saldoPendiente: number;
  cajeroNombre: string;
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{etiqueta}</span>
      <span className="font-bold">{valor}</span>
    </div>
  );
}

/** Comprobante de liquidación en papel térmico de 80 mm. */
export function SettlementTicket({ datos }: { datos: DatosTicketLiquidacion }) {
  const t = datos.totales;
  return (
    <div
      className="mx-auto bg-white font-mono text-[11px] leading-snug text-slate-900 shadow-lg"
      style={{ width: "80mm", maxWidth: "100%" }}
    >
      <div className="px-3 py-3">
        <div className="text-center">
          <p className="text-sm font-black tracking-wide">JBM CÍTRICOS PREMIUM</p>
          <p className="text-[10px]">Liquidación a Productores</p>
        </div>
        <div className="my-2 border-t border-dashed border-slate-400" />
        <Fila etiqueta="Folio:" valor={datos.folioLiquidacion} />
        <Fila
          etiqueta="Fecha:"
          valor={datos.fecha.toLocaleString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <p className="mt-1 font-bold">Beneficiario:</p>
        <p>{datos.productorDisplay}</p>
        <div className="my-2 border-t border-dashed border-slate-400" />
        <Fila etiqueta="Boletas:" valor={String(t.nBoletas)} />
        <Fila etiqueta="Kilos netos:" valor={formatoKilos(t.kilosNetos)} />
        <Fila etiqueta="Precio prom.:" valor={`${formatoPesos(t.precioPromedio)}/kg`} />
        <Fila etiqueta="Subtotal fruta:" valor={`+${formatoPesos(t.subtotalFruta)}`} />
        <Fila etiqueta="Anticipos:" valor={`-${formatoPesos(t.anticipos)}`} />
        <Fila etiqueta="Ded. báscula:" valor={`-${formatoPesos(t.deduccionBascula)}`} />
        <Fila etiqueta="Ded. operativa:" valor={`-${formatoPesos(t.deduccionOperativa)}`} />
        <div className="my-2 border-t border-dashed border-slate-400" />
        <div className="text-center">
          <p className="text-[10px]">TOTAL NETO PAGADO</p>
          <p className="text-xl font-black">{formatoPesos(t.totalNeto)}</p>
        </div>
        {datos.abonos.length > 0 && (
          <>
            <div className="my-2 border-t border-dashed border-slate-400" />
            <p className="font-bold">Abonos:</p>
            {datos.abonos.map((a) => (
              <Fila
                key={a.id}
                etiqueta={`${ETIQUETA_METODO[a.metodo]}${a.referencia ? ` ${a.referencia}` : ""}:`}
                valor={formatoPesos(a.importe)}
              />
            ))}
            <Fila etiqueta="Saldo pendiente:" valor={formatoPesos(datos.saldoPendiente)} />
          </>
        )}
        <div className="my-2 border-t border-dashed border-slate-400" />
        <Fila etiqueta="Cajero:" valor={datos.cajeroNombre || "—"} />
        <div className="mt-4 grid grid-cols-2 gap-4 text-center text-[10px]">
          <div>
            <div className="border-t border-slate-500 pt-1">Productor</div>
          </div>
          <div>
            <div className="border-t border-slate-500 pt-1">Pagador</div>
          </div>
        </div>
      </div>
    </div>
  );
}
