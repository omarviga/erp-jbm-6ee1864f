import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsumoUI } from "@/hooks/useInsumos";
import {
  PRESENTACIONES_BOM,
  agruparStockPorTipo,
  calcularCapacidad,
  calcularCostos,
  simularCorrida,
  type CodigoMaterial,
  type CodigoPresentacion,
} from "@/lib/insumos/bom";

const CALIBRES = ["V-XXX", "V-XX", "V-X", "V", "IV", "III"];

/** Tipo de insumo con stock por material; null = sin control de stock. */
const TIPO_STOCK: Record<CodigoMaterial, string | null> = {
  envase: null, // se resuelve por presentación (envaseTipo)
  tarimas: "tarima",
  esquineros: "esquinero",
  grapas: null,
  plu: null,
  senasica: null,
  cera: "cera",
  papel: null,
};

const fmtInt = (n: number) =>
  Math.round(n).toLocaleString("es-MX");

const fmtDec = (n: number, dec = 2) =>
  n.toLocaleString("es-MX", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

const fmtPesos = (n: number) =>
  n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });

/** Proyección de solo lectura: consumo, residual y cuello de botella. */
export function SimuladorBOM({ items }: { items: InsumoUI[] }) {
  const [codigo, setCodigo] = useState<CodigoPresentacion>("exp-18");
  const [cajasStr, setCajasStr] = useState("500");
  const [calibre, setCalibre] = useState("V-XX");

  const boxes = Math.max(0, Math.floor(Number(cajasStr) || 0));

  const modelo = useMemo(() => {
    const sim = simularCorrida(codigo, boxes, calibre);
    const buckets = agruparStockPorTipo(items);
    const stock: Partial<Record<CodigoMaterial, number>> = {};
    const costos: Partial<Record<CodigoMaterial, number>> = {};
    for (const l of sim.lineas) {
      if (!l.aplica) continue;
      const tipo =
        l.material === "envase" ? sim.presentacion.envaseTipo : TIPO_STOCK[l.material];
      const b = tipo ? buckets[tipo] : undefined;
      if (b) {
        stock[l.material] = b.stock;
        costos[l.material] = b.costo;
      }
    }
    const capacidad = calcularCapacidad(sim.lineas, stock);
    const costosCorrida = calcularCostos(sim.lineas, sim.boxes, sim.frutaKg, costos);
    return { sim, stock, capacidad, costosCorrida };
  }, [codigo, boxes, calibre, items]);

  const { sim, stock, capacidad, costosCorrida } = modelo;
  const etiquetaLimitante = capacidad.limitante
    ? sim.lineas.find((l) => l.material === capacidad.limitante)?.etiqueta
    : null;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FlaskConical className="h-5 w-5 text-emerald-700" />
          Simulador BOM Producción ↔ Insumos
        </CardTitle>
        <CardDescription>
          Proyecta el consumo y el inventario residual antes de la corrida. No descuenta stock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Presentación</Label>
            <Select value={codigo} onValueChange={(v) => setCodigo(v as CodigoPresentacion)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESENTACIONES_BOM.map((p) => (
                  <SelectItem key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cajas objetivo</Label>
            <Input
              type="number"
              min="0"
              value={cajasStr}
              onChange={(e) => setCajasStr(e.target.value)}
              placeholder="500"
            />
          </div>
          <div className="space-y-2">
            <Label>Calibre</Label>
            <Select value={calibre} onValueChange={setCalibre}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALIBRES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
            boxes <= 0 || capacidad.maxCajas === null
              ? "border-slate-200 bg-slate-50 text-slate-600"
              : capacidad.maxCajas >= boxes
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          {capacidad.maxCajas !== null && boxes > 0 && capacidad.maxCajas >= boxes ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>
            {boxes <= 0 ? (
              <>Captura las cajas objetivo para proyectar.</>
            ) : capacidad.maxCajas === null ? (
              <>Sin datos de stock para proyectar capacidad.</>
            ) : capacidad.maxCajas >= boxes ? (
              <>
                Stock suficiente para <strong>{fmtInt(boxes)} cajas</strong> (máximo{" "}
                {fmtInt(capacidad.maxCajas)}).
              </>
            ) : (
              <>
                Stock suficiente para máximo <strong>{fmtInt(capacidad.maxCajas)} cajas</strong>{" "}
                debido a déficit de <strong>{etiquetaLimitante}</strong>.
              </>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2 text-right">Necesario</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right">Residual</th>
                <th className="px-3 py-2 text-right">Máx. cajas</th>
              </tr>
            </thead>
            <tbody>
              {sim.lineas
                .filter((l) => l.aplica)
                .map((l) => {
                  const s = stock[l.material];
                  const residual = s === undefined ? null : s - l.cantidad;
                  const max = capacidad.porMaterial.find((p) => p.material === l.material)?.maxCajas;
                  const esLimitante = capacidad.limitante === l.material;
                  return (
                    <tr key={l.material} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">
                        {l.etiqueta}
                        {l.material === "plu" && (
                          <span className="text-slate-500"> #{sim.plu}</span>
                        )}
                        {esLimitante && (
                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                            Cuello de botella
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {l.material === "cera" ? fmtDec(l.cantidad) : fmtInt(l.cantidad)}{" "}
                        <span className="text-slate-500">{l.unidad}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {s === undefined ? (
                          <span className="text-slate-400">Sin control</span>
                        ) : (
                          <>{l.material === "cera" ? fmtDec(s) : fmtInt(s)}</>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono",
                          residual !== null && residual < 0 && "font-bold text-rose-600"
                        )}
                      >
                        {residual === null
                          ? "—"
                          : l.material === "cera"
                            ? fmtDec(residual)
                            : fmtInt(residual)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {max === null || max === undefined ? "—" : fmtInt(max)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Fruta total</p>
            <p className="font-mono font-bold">{fmtInt(sim.frutaKg)} kg</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Costo insumos</p>
            <p className="font-mono font-bold">{fmtPesos(costosCorrida.total)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Por caja</p>
            <p className="font-mono font-bold">{fmtPesos(costosCorrida.porCaja)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Por kilo</p>
            <p className="font-mono font-bold">{fmtPesos(costosCorrida.porKilo)}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Cera ≈ {fmtDec(sim.ceraTambos, 3)} tambos. Grapas, etiquetas y papel sin control de
          stock en el catálogo: verifica manual. El cartón suma todos los renglones.
        </p>
      </CardContent>
    </Card>
  );
}
