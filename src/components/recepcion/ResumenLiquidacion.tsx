import { Calculator, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { moneda } from "@/lib/recepcion/calculos";
import type { PropsSeccionRecepcion } from "./tipos";

const formatearKilos = (valor: number): string =>
  valor.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function ResumenLiquidacion({
  form,
  calculo,
}: PropsSeccionRecepcion) {
  const esPropia = form.origen === "propia";
  const tarifaManiobra = Number(form.cuotaManiobraKg) || 0;

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Resumen en tiempo real de liquidación
          </CardTitle>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            Cálculo automático
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        <dl className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sm text-slate-700">
              <span className="mr-1.5 font-mono font-bold text-emerald-600">
                (+)
              </span>
              Fruta ({formatearKilos(calculo.pesoNeto)} kg ×{" "}
              {moneda(Number(form.precioKg) || 0)})
            </dt>
            <dd
              className="font-mono text-base font-semibold text-slate-900"
              data-testid="resumen-fruta"
            >
              {moneda(calculo.subtotal)}
            </dd>
          </div>

          {calculo.basculaDescontada > 0 && (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-slate-700">
                <span className="mr-1.5 font-mono font-bold text-rose-500">
                  (-)
                </span>
                Tarifa de báscula (deducción)
              </dt>
              <dd className="font-mono text-base font-semibold text-rose-600">
                {moneda(calculo.basculaDescontada)}
              </dd>
            </div>
          )}

          {calculo.basculaEnEfectivo > 0 && (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-slate-700">
                <span className="mr-1.5 font-mono font-bold text-slate-400">
                  (=)
                </span>
                Tarifa de báscula cobrada en efectivo (no se descuenta)
              </dt>
              <dd className="font-mono text-base font-semibold text-slate-500">
                {moneda(calculo.basculaEnEfectivo)}
              </dd>
            </div>
          )}

          {calculo.cuotaManiobraTotal > 0 && (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-slate-700">
                <span className="mr-1.5 font-mono font-bold text-rose-500">
                  (-)
                </span>
                Cargo operativo ({moneda(tarifaManiobra)}/kg ×{" "}
                {formatearKilos(calculo.pesoNeto)} kg)
                {form.cuotaManiobraConcepto && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {form.cuotaManiobraConcepto}
                  </span>
                )}
              </dt>
              <dd className="font-mono text-base font-semibold text-rose-600">
                {moneda(calculo.cuotaManiobraTotal)}
              </dd>
            </div>
          )}
        </dl>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <TrendingDown className="h-4 w-4 text-rose-500" aria-hidden="true" />
            Total deducciones aplicadas
          </span>
          <span className="font-mono text-lg font-bold text-rose-600">
            - {moneda(calculo.totalDeducciones)}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">
            Precio neto efectivo real
          </span>
          <span className="font-mono text-lg font-bold text-slate-900">
            {moneda(calculo.precioNetoEfectivo)} / kg
          </span>
        </div>

        <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-50">
            {esPropia ? "Costo neto del lote" : "Total neto a liquidar"}
          </p>
          <p className="mt-1 font-mono text-3xl font-black" data-testid="total-neto">
            {moneda(calculo.totalLiquidar)}
          </p>
          <p className="mt-1 text-xs text-emerald-50">
            {esPropia
              ? "Costo de la fruta propia tras deducciones operativas."
              : "Monto final a pagar al productor."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
