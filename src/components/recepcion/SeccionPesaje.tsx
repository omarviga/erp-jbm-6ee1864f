import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kilos, moneda } from "@/lib/recepcion/calculos";
import { ROTULO_BASCULA, type PropsSeccionRecepcion } from "./tipos";

export function SeccionPesaje({
  form,
  setCampo,
  calculo,
}: PropsSeccionRecepcion) {
  const esPropia = form.origen === "propia";

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Pesaje de báscula (kg)
          </CardTitle>
          <Badge variant="outline" className="border-slate-300 text-xs">
            {ROTULO_BASCULA}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="peso-bruto" className="font-semibold">
              Bruto (kg) *
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
              className="h-14 text-center font-mono text-2xl"
            />
            <p className="text-xs text-muted-foreground">
              Primera pesada: camión cargado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tara" className="font-semibold">
              Tara (kg)
            </Label>
            <Input
              id="tara"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={form.taraVehiculo}
              onChange={(e) => setCampo("taraVehiculo", e.target.value)}
              placeholder="0.00"
              className="h-14 text-center font-mono text-2xl"
            />
            <p className="text-xs text-muted-foreground">
              Segunda pesada: vehículo vacío.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Neto (kg)</Label>
            <div
              className="flex h-14 items-center justify-center rounded-md border-2 border-primary/30 bg-primary/10 font-mono text-2xl font-bold text-primary"
              aria-live="polite"
              data-testid="peso-neto"
            >
              {calculo.pesoNeto.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Cálculo automático: bruto − tara.
            </p>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="precio-kg" className="font-semibold">
              {esPropia
                ? "Costo por kilo ($/kg) — opcional para costeo"
                : "Precio por kilo ($/kg) *"}
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                $
              </span>
              <Input
                id="precio-kg"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={form.precioKg}
                onChange={(e) => setCampo("precioKg", e.target.value)}
                placeholder="0.00"
                className="h-14 pl-9 text-center font-mono text-2xl"
              />
            </div>
            {esPropia && (
              <p className="text-xs text-muted-foreground">
                En cosecha propia no se paga al productor; este valor solo
                alimenta el costeo de producción.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">
              Subtotal fruta ({kilos(calculo.pesoNeto)})
            </Label>
            <div
              className="flex h-14 items-center justify-center rounded-md border-2 border-emerald-200 bg-emerald-50 font-mono text-2xl font-bold text-emerald-800"
              data-testid="subtotal-fruta"
            >
              {moneda(calculo.subtotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              Kilos netos × precio pactado, antes de deducciones.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
