import { CheckCircle, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  DEFECTOS_OBSERVADO,
  DEFECTOS_RECHAZADO,
  kilos,
} from "@/lib/recepcion/calculos";
import type { PropsSeccionRecepcion } from "./tipos";

const ESTILOS_DICTAMEN: Record<string, string> = {
  aceptado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  observado: "border-amber-200 bg-amber-50 text-amber-700",
  rechazado: "border-rose-200 bg-rose-50 text-rose-700",
};

export function SeccionCalidad({
  form,
  setCampo,
  calculo,
  dictamen,
}: PropsSeccionRecepcion) {
  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Percent className="h-5 w-5 text-rose-500" aria-hidden="true" />
          Calidad de campo
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="defectos" className="font-semibold text-rose-600">
            Porcentaje de defectos
          </Label>
          <span className="font-mono text-2xl font-bold text-rose-600">
            {form.defectos}%
          </span>
        </div>

        <Slider
          id="defectos"
          value={[form.defectos]}
          min={0}
          max={30}
          step={1}
          onValueChange={(valor) => setCampo("defectos", valor[0] ?? 0)}
          aria-label="Porcentaje de defectos"
        />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0% excelente</span>
          <span>{DEFECTOS_OBSERVADO}% observado</span>
          <span>{DEFECTOS_RECHAZADO}% rechazado</span>
          <span>30% máximo</span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between rounded-lg border-2 p-3",
            ESTILOS_DICTAMEN[dictamen]
          )}
          role="status"
        >
          <div>
            <p className="text-sm font-semibold">
              Dictamen: {dictamen.toUpperCase()}
            </p>
            <p className="text-xs opacity-80">
              {dictamen === "aceptado"
                ? "Fruta en condiciones óptimas para selección."
                : dictamen === "observado"
                  ? "Se guardará con observaciones para revisión en patio."
                  : "No cumple el mínimo: el lote no puede ingresar."}
            </p>
            <p className="mt-1 text-xs opacity-80">
              Merma estimada: {kilos(calculo.kilosMerma)} (informativa, no
              descuenta el pago)
            </p>
          </div>
          {dictamen === "aceptado" && (
            <CheckCircle className="h-7 w-7" aria-hidden="true" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
