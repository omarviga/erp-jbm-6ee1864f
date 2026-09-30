import { VARIEDAD_UNICA, formatoKilos, formatoPesos } from "../../lib/recepcion/calculos";
import type { ResumenRecepcion, TipoPagoRecepcion } from "../../lib/recepcion/calculos";

export interface DatosTicketRecepcion {
  folioOficial: string;
  folioBascula: string;
  fecha: Date;
  productorNombre: string;
  productorLocalidad?: string | null;
  pesoBruto: number;
  pesoTara: number;
  precioKg: number;
  cuotaBascula: number;
  formaPagoBascula: "liquidacion" | "efectivo";
  tarifaManiobraKg: number;
  conceptoManiobra: string;
  operadorBascula: string;
  tipoPago?: TipoPagoRecepcion;
  anticipos?: number;
  remanenteEstimado?: number;
  resumen: ResumenRecepcion;
}

interface ThermalTicketProps {
  datos: DatosTicketRecepcion;
  /** true = vista previa en vivo dentro del modal; false = impresión. */
  isLivePreview?: boolean;
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{etiqueta}</span>
      <span className="font-bold">{valor}</span>
    </div>
  );
}

/**
 * Réplica del ticket térmico de 80 mm. En el modal se usa con
 * isLivePreview para actualización reactiva mientras el operador captura.
 */
export function ThermalTicket({ datos, isLivePreview = false }: ThermalTicketProps) {
  const { resumen } = datos;
  const anticipos = datos.anticipos ?? 0;
  const etiquetaPago =
    datos.tipoPago === "total"
      ? "Pago total en recepción"
      : datos.tipoPago === "anticipo"
        ? "Anticipo en recepción"
        : null;
  return (
    <div
      className="mx-auto bg-white font-mono text-[11px] leading-snug text-slate-900 shadow-lg"
      style={{ width: "80mm", maxWidth: "100%" }}
      role={isLivePreview ? "img" : undefined}
      aria-label={isLivePreview ? "Vista previa del ticket térmico" : undefined}
    >
      {isLivePreview && (
        <div className="bg-amber-400 px-2 py-1 text-center text-[10px] font-black tracking-widest text-slate-900 uppercase">
          Vista previa en vivo
        </div>
      )}
      <div className="px-3 py-3">
        <div className="text-center">
          <p className="text-sm font-black tracking-wide">JBM CÍTRICOS BARRAGÁN</p>
          <p className="text-[10px]">Boleta de Recepción &amp; Pesaje</p>
        </div>
        <div className="my-2 border-t border-dashed border-slate-400" />
        <Fila etiqueta="Folio:" valor={datos.folioOficial || "—"} />
        <Fila etiqueta="Ticket báscula:" valor={datos.folioBascula || "—"} />
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
        <Fila etiqueta="Variedad:" valor={VARIEDAD_UNICA} />
        <div className="my-2 border-t border-dashed border-slate-400" />
        <p className="font-bold">Productor:</p>
        <p>{datos.productorNombre || "—"}</p>
        {datos.productorLocalidad && (
          <p className="text-[10px] text-slate-600">{datos.productorLocalidad}</p>
        )}
        <div className="my-2 border-t border-dashed border-slate-400" />
        <Fila etiqueta="Bruto:" valor={formatoKilos(datos.pesoBruto)} />
        <Fila etiqueta="Tara:" valor={formatoKilos(datos.pesoTara)} />
        <Fila etiqueta="NETO:" valor={formatoKilos(resumen.pesoNeto)} />
        <div className="my-2 border-t border-dashed border-slate-400" />
        <Fila etiqueta={`Fruta (${formatoKilos(resumen.pesoNeto)} × ${formatoPesos(datos.precioKg)}/kg):`} valor={`+${formatoPesos(resumen.subtotalFruta)}`} />
        <Fila
          etiqueta={`Báscula (${datos.formaPagoBascula === "liquidacion" ? "descuento" : "efectivo"}):`}
          valor={resumen.descuentoBascula > 0 ? `-${formatoPesos(resumen.descuentoBascula)}` : formatoPesos(0)}
        />
        <Fila
          etiqueta={`${datos.conceptoManiobra || "Maniobra"} (${formatoPesos(datos.tarifaManiobraKg)}/kg):`}
          valor={resumen.cargoManiobraTotal > 0 ? `-${formatoPesos(resumen.cargoManiobraTotal)}` : formatoPesos(0)}
        />
        <div className="my-2 border-t border-dashed border-slate-400" />
        <div className="text-center">
          <p className="text-[10px]">TOTAL NETO A LIQUIDAR</p>
          <p className="text-xl font-black">{formatoPesos(resumen.totalLiquidar)}</p>
          <p className="text-[10px]">
            Precio neto efectivo: {formatoPesos(resumen.precioNetoEfectivo)}/kg
          </p>
        </div>
        {etiquetaPago && anticipos > 0 && (
          <>
            <div className="my-2 border-t border-dashed border-slate-400" />
            <Fila etiqueta={`${etiquetaPago}:`} valor={`-${formatoPesos(anticipos)}`} />
            <Fila
              etiqueta="Remanente estimado:"
              valor={formatoPesos(datos.remanenteEstimado ?? 0)}
            />
          </>
        )}
        <div className="my-2 border-t border-dashed border-slate-400" />
        <Fila etiqueta="Operador:" valor={datos.operadorBascula || "—"} />
        <div className="mt-2 border border-slate-300 px-2 py-1 text-center text-[10px]">
          QR trazabilidad: {datos.folioOficial || "—"}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-center text-[10px]">
          <div>
            <div className="border-t border-slate-500 pt-1">Operador báscula</div>
          </div>
          <div>
            <div className="border-t border-slate-500 pt-1">Productor / Chofer</div>
          </div>
        </div>
      </div>
    </div>
  );
}
