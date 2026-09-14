import { Banknote, Calculator, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { moneda, type FormaPagoBascula } from "@/lib/recepcion/calculos";
import type { PropsSeccionRecepcion } from "./tipos";

const MODALIDADES: Array<{
  valor: FormaPagoBascula;
  titulo: string;
  descripcion: string;
  icono: typeof CreditCard;
}> = [
  {
    valor: "liquidacion",
    titulo: "Descontar de liquidación",
    descripcion: "Se retiene del pago al productor.",
    icono: CreditCard,
  },
  {
    valor: "efectivo",
    titulo: "Pagado en efectivo",
    descripcion: "El productor o chofer pagó en mano.",
    icono: Banknote,
  },
];

export function SeccionBascula({
  form,
  setCampo,
  calculo,
}: PropsSeccionRecepcion) {
  return (
    <Card className="rounded-2xl border border-blue-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-blue-600" aria-hidden="true" />
          Cuota de báscula (cobro al productor)
        </CardTitle>
        <CardDescription>
          Servicio de pesaje vehicular. Si el importe es 0, no se cobra.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-2">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="costo-bascula" className="font-semibold">
            Importe de la cuota
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
              $
            </span>
            <Input
              id="costo-bascula"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={form.costoBascula}
              onChange={(e) => setCampo("costoBascula", e.target.value)}
              className="h-14 pl-9 font-mono text-2xl font-bold text-blue-700"
            />
          </div>
        </div>

        <RadioGroup
          value={form.basculaFormaPago}
          onValueChange={(valor) =>
            setCampo("basculaFormaPago", valor as FormaPagoBascula)
          }
          className="grid gap-3 sm:grid-cols-2"
          aria-label="Modalidad de cobro de la báscula"
        >
          {MODALIDADES.map((modalidad) => {
            const Icono = modalidad.icono;
            const activa = form.basculaFormaPago === modalidad.valor;

            return (
              <label
                key={modalidad.valor}
                htmlFor={`bascula-${modalidad.valor}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  activa
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <RadioGroupItem
                  value={modalidad.valor}
                  id={`bascula-${modalidad.valor}`}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {modalidad.titulo}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {modalidad.descripcion}
                  </span>
                  <span
                    className={cn(
                      "mt-2 block text-xs font-medium",
                      modalidad.valor === "liquidacion"
                        ? "text-rose-600"
                        : "text-emerald-700"
                    )}
                  >
                    {modalidad.valor === "liquidacion"
                      ? `Resta -${moneda(calculo.basculaDescontada)} al total a pagar`
                      : `Productor pagó en mano (${moneda(
                          calculo.basculaEnEfectivo
                        )} no deducidos)`}
                  </span>
                </span>
              </label>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
