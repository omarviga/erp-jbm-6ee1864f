import { Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calcularPagoCortador,
  moneda,
  PORCENTAJE_CORTADOR,
} from "@/lib/recepcion/calculos";
import type { PropsSeccionRecepcion } from "./tipos";

export function SeccionCortadores({
  form,
  setCampo,
  cortadores,
  cortadoresLote,
  setCortadoresLote,
}: PropsSeccionRecepcion) {
  const precioCaja = Number(form.precioCajaCortador) || 0;
  const totalCajas = cortadoresLote.reduce(
    (acc, c) => acc + (Number(c.cajas) || 0),
    0
  );
  const pagoCortadores = calcularPagoCortador(totalCajas, precioCaja);

  const agregarCortador = (id: string) => {
    const cortador = cortadores.find((c) => c.id === id);
    if (!cortador) return;
    if (cortadoresLote.some((c) => c.id === id)) return;
    setCortadoresLote([...cortadoresLote, { ...cortador, cajas: 0 }]);
  };

  const actualizarCajas = (id: string, cajas: number) => {
    setCortadoresLote(
      cortadoresLote.map((c) => (c.id === id ? { ...c, cajas } : c))
    );
  };

  const quitarCortador = (id: string) => {
    setCortadoresLote(cortadoresLote.filter((c) => c.id !== id));
  };

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          Cortadores del lote (cosecha propia)
        </CardTitle>
        <CardDescription>
          Cajas recolectadas por cortador y su pago estimado (
          {Math.round(PORCENTAJE_CORTADOR * 100)}% del precio por caja).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="precio-caja" className="text-sm font-semibold">
              Precio por caja (referencia de pago)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                $
              </span>
              <Input
                id="precio-caja"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={form.precioCajaCortador}
                onChange={(e) => setCampo("precioCajaCortador", e.target.value)}
                placeholder="Ej. 100.00"
                className="h-12 pl-8 font-mono text-lg"
              />
            </div>
            {precioCaja > 0 && (
              <p className="text-xs text-muted-foreground">
                Pago por caja al cortador:{" "}
                <span className="font-semibold">
                  {moneda(precioCaja * PORCENTAJE_CORTADOR)}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Agregar cortador</Label>
            <Select onValueChange={agregarCortador} value="">
              <SelectTrigger className="h-12" aria-label="Agregar cortador">
                <SelectValue placeholder="Selecciona un cortador..." />
              </SelectTrigger>
              <SelectContent>
                {cortadores.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No hay cortadores activos registrados
                  </div>
                ) : (
                  cortadores
                    .filter((c) => !cortadoresLote.some((cl) => cl.id === c.id))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {cortadoresLote.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-muted-foreground">
            <Plus className="mx-auto mb-1 h-4 w-4" aria-hidden="true" />
            Sin cortadores asignados a este lote.
          </p>
        ) : (
          <div className="space-y-3">
            {cortadoresLote.map((cortador) => (
              <div
                key={cortador.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <span className="min-w-[140px] flex-1 font-medium">
                  {cortador.nombre}
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={cortador.cajas}
                  onChange={(e) =>
                    actualizarCajas(
                      cortador.id,
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    )
                  }
                  className="h-10 w-24 text-center font-mono"
                  aria-label={`Cajas recolectadas por ${cortador.nombre}`}
                />
                <span className="text-xs text-muted-foreground">cajas</span>
                <Badge
                  variant="outline"
                  className="ml-auto border-emerald-300 font-mono text-emerald-700"
                >
                  {moneda(calcularPagoCortador(cortador.cajas, precioCaja))}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => quitarCortador(cortador.id)}
                  aria-label={`Quitar a ${cortador.nombre}`}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" aria-hidden="true" />
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 p-3">
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Total pago a cortadores
                </p>
                <p className="text-xs text-emerald-700">
                  {totalCajas} cajas × {moneda(precioCaja)} ×{" "}
                  {Math.round(PORCENTAJE_CORTADOR * 100)}%
                </p>
              </div>
              <span className="font-mono text-xl font-bold text-emerald-900">
                {moneda(pagoCortadores)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
