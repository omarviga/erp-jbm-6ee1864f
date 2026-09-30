import { Forklift, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moneda, TARIFA_MANIOBRA_DEFAULT } from "@/lib/recepcion/calculos";
import type { PropsSeccionRecepcion } from "./tipos";

export function SeccionCargos({
  form,
  setCampo,
  calculo,
}: PropsSeccionRecepcion) {
  const tarifa = Number(form.cuotaManiobraKg) || 0;

  return (
    <Card className="rounded-2xl border border-indigo-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Forklift className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          Cargos adicionales por kilo recibido
        </CardTitle>
        <CardDescription>
          Maniobra, descarga, pesaje certificado y preclasificación
          fitosanitaria en patio. Deja la tarifa en 0 si no aplica.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-2">
        <p className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-800">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Tarifa habitual: {moneda(TARIFA_MANIOBRA_DEFAULT)}/kg
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maniobra-kg" className="font-semibold">
              Tarifa por kg ($/kg)
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                $
              </span>
              <Input
                id="maniobra-kg"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={form.cuotaManiobraKg}
                onChange={(e) => setCampo("cuotaManiobraKg", e.target.value)}
                placeholder="0.00"
                className="h-14 pl-9 text-center font-mono text-2xl font-bold text-indigo-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maniobra-concepto" className="font-semibold">
              Concepto del cargo
            </Label>
            <Input
              id="maniobra-concepto"
              value={form.cuotaManiobraConcepto}
              onChange={(e) =>
                setCampo("cuotaManiobraConcepto", e.target.value)
              }
              placeholder="Ej. Servicios operativos y maniobra"
              className="h-14"
              maxLength={120}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Deducción operativa
            </p>
            <p className="text-xs text-muted-foreground">
              ({calculo.pesoNeto.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              kg × {moneda(tarifa)})
            </p>
          </div>
          <span className="font-mono text-xl font-bold text-indigo-700">
            - {moneda(calculo.cuotaManiobraTotal)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
