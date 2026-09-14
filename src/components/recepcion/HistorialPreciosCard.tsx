import { History, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { moneda, type HistorialPrecios } from "@/lib/recepcion/calculos";

interface HistorialPreciosCardProps {
  historial: HistorialPrecios;
  cargando: boolean;
  productorNombre?: string;
  onAplicarPrecio: (precio: number) => void;
}

const formatearFecha = (valor: string): string => {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};

export function HistorialPreciosCard({
  historial,
  cargando,
  productorNombre,
  onAplicarPrecio,
}: HistorialPreciosCardProps) {
  return (
    <Card className="rounded-2xl border border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" aria-hidden="true" />
          Precios reales del productor
        </CardTitle>
        <CardDescription>
          {productorNombre
            ? `Últimos lotes recibidos de ${productorNombre}`
            : "Selecciona un productor para consultar su historial"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {cargando ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Consultando historial...
          </p>
        ) : historial.precios.length === 0 ? (
          <div className="py-6 text-center">
            <History
              className="mx-auto mb-2 h-10 w-10 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              {productorNombre
                ? "Este productor todavía no tiene lotes con precio registrado."
                : "Sin productor seleccionado."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">Último</p>
                <p className="font-mono text-sm font-bold">
                  {moneda(historial.ultimo ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Promedio</p>
                <p className="font-mono text-sm font-bold">
                  {moneda(historial.promedio ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Rango</p>
                <p className="font-mono text-sm font-bold">
                  {moneda(historial.minimo ?? 0)}–{moneda(historial.maximo ?? 0)}
                </p>
              </div>
            </div>

            {historial.variacionPct !== null && (
              <p
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  historial.variacionPct >= 0 ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {historial.variacionPct >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                El último precio está {historial.variacionPct >= 0 ? "+" : ""}
                {historial.variacionPct}% contra el promedio de{" "}
                {historial.lotesRegistrados} lote(s).
              </p>
            )}

            <ul className="space-y-2">
              {historial.precios.map((precio, indice) => (
                <li key={`${precio.fecha}-${indice}`}>
                  <button
                    type="button"
                    onClick={() => onAplicarPrecio(precio.precio)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/50 p-2.5 text-left transition-colors hover:bg-muted"
                    aria-label={`Aplicar precio ${precio.precio} del ${formatearFecha(precio.fecha)}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {indice + 1}
                      </Badge>
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground">
                          {formatearFecha(precio.fecha)}
                          {precio.variedad ? ` · ${precio.variedad}` : ""}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {precio.folio ?? "sin folio"} ·{" "}
                          {precio.kilos.toLocaleString("es-MX")} kg
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold">
                      {moneda(precio.precio)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="text-center text-xs text-muted-foreground">
              Toca un precio para aplicarlo a esta recepción
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
