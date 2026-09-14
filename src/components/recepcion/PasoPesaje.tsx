import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Scale,
  Truck,
  Weight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { kilos, moneda } from "@/lib/recepcion/calculos";
import type { PropsPasoRecepcion } from "./tipos";

const formatearHora = (valor: string | null): string =>
  valor
    ? new Date(valor).toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

export function PasoPesaje({
  form,
  setCampo,
  calculo,
  onRegistrarPrimeraPesada,
  onRegistrarSegundaPesada,
}: PropsPasoRecepcion) {
  const primeraPesadaLista = Boolean(form.pesoBrutoAt);
  const segundaPesadaLista = Boolean(form.pesoTaraAt);

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950">
            2
          </span>
          Pesaje de báscula (doble pesada)
        </CardTitle>
        <CardDescription>
          Primero el camión cargado, después el vehículo vacío. El sistema
          calcula el peso neto real de la fruta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Primera pesada */}
          <div
            className={cn(
              "rounded-xl border p-4",
              primeraPesadaLista
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-slate-200 bg-slate-50"
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Truck className="h-4 w-4" aria-hidden="true" />
                1ª pesada · Camión cargado
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  primeraPesadaLista
                    ? "border-emerald-300 text-emerald-700"
                    : "border-slate-300 text-slate-500"
                )}
              >
                {primeraPesadaLista ? "Registrada" : "Pendiente"}
              </Badge>
            </div>

            <Label htmlFor="peso-bruto" className="text-sm font-semibold">
              Peso bruto (kg) *
            </Label>
            <Input
              id="peso-bruto"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={form.pesoBruto}
              onChange={(e) => setCampo("pesoBruto", e.target.value)}
              placeholder="0.00"
              className="mt-1 h-14 text-center font-mono text-2xl"
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {primeraPesadaLista
                  ? formatearHora(form.pesoBrutoAt)
                  : "Sin hora registrada"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRegistrarPrimeraPesada}
                disabled={!form.pesoBruto}
              >
                Marcar hora
              </Button>
            </div>
          </div>

          {/* Segunda pesada */}
          <div
            className={cn(
              "rounded-xl border p-4",
              segundaPesadaLista
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-slate-200 bg-slate-50"
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Weight className="h-4 w-4" aria-hidden="true" />
                2ª pesada · Vehículo vacío + rejas
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  segundaPesadaLista
                    ? "border-emerald-300 text-emerald-700"
                    : "border-slate-300 text-slate-500"
                )}
              >
                {segundaPesadaLista ? "Registrada" : "Pendiente"}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="tara-vehiculo" className="text-sm font-semibold">
                  Tara del vehículo (kg)
                </Label>
                <Input
                  id="tara-vehiculo"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={form.taraVehiculo}
                  onChange={(e) => setCampo("taraVehiculo", e.target.value)}
                  placeholder="0.00"
                  className="mt-1 h-14 text-center font-mono text-2xl"
                />
              </div>
              <div>
                <Label htmlFor="tara-rejas" className="text-sm font-semibold">
                  Tara de rejas (kg)
                </Label>
                <Input
                  id="tara-rejas"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={form.taraRejasKg}
                  onChange={(e) => setCampo("taraRejasKg", e.target.value)}
                  placeholder="0.00"
                  className="mt-1 h-14 text-center font-mono text-2xl"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {segundaPesadaLista
                  ? formatearHora(form.pesoTaraAt)
                  : "Sin hora registrada"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRegistrarSegundaPesada}
                disabled={!form.taraVehiculo && !form.taraRejasKg}
              >
                Marcar hora
              </Button>
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Peso bruto
              </p>
              <p className="font-mono text-lg font-semibold">
                {kilos(Number(form.pesoBruto) || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Tara total
              </p>
              <p className="font-mono text-lg font-semibold">
                - {kilos(calculo.taraTotal)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                vehículo {kilos(Number(form.taraVehiculo) || 0)} + rejas{" "}
                {kilos(Number(form.taraRejasKg) || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Peso neto real
              </p>
              <p className="font-mono text-2xl font-bold text-primary">
                {kilos(calculo.pesoNetoFisico)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Merma informativa
              </p>
              <p className="font-mono text-lg font-semibold text-rose-600">
                {kilos(calculo.kilosMerma)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {form.defectos}% de defectos · no descuenta el pago
              </p>
            </div>
          </div>
        </div>

        {/* Avisos */}
        {calculo.errores.length > 0 && (
          <div className="space-y-2">
            {calculo.errores.map((error) => (
              <p
                key={error}
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ))}
          </div>
        )}

        {calculo.errores.length === 0 && calculo.pesoNetoFisico > 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Pesaje consistente: {kilos(calculo.pesoNetoFisico)} disponibles para
            producción ({moneda(calculo.subtotal)} a{" "}
            {moneda(Number(form.precioKg) || 0)}/kg).
          </p>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Regla operativa vigente: el pago al productor se calcula siempre sobre
          el peso neto. La merma por defectos se registra para calidad y
          descarte fitosanitario, pero no descuenta kilos pagados.
        </p>
      </CardContent>
    </Card>
  );
}
