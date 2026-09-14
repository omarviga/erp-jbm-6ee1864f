import { AlertOctagon, Loader2, QrCode, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { moneda } from "@/lib/recepcion/calculos";
import type {
  DictamenCalidad,
  OrigenRecepcion,
  ResultadoCalculoRecepcion,
} from "@/lib/recepcion/calculos";
import type { RecepcionFormState } from "./tipos";

interface ResumenLiquidacionCardProps {
  form: RecepcionFormState;
  calculo: ResultadoCalculoRecepcion;
  dictamen: DictamenCalidad;
  origen: OrigenRecepcion;
  folioOficial: string | null;
  pasoActual: number;
  totalPasos: number;
  guardando: boolean;
  onConfirmar: () => void;
}

const ETIQUETA_DICTAMEN: Record<DictamenCalidad, string> = {
  aceptado: "Aceptado",
  observado: "Observado",
  rechazado: "Rechazado",
};

export function ResumenLiquidacionCard({
  form,
  calculo,
  dictamen,
  origen,
  folioOficial,
  pasoActual,
  totalPasos,
  guardando,
  onConfirmar,
}: ResumenLiquidacionCardProps) {
  const vacio =
    !form.pesoBruto &&
    !form.productorId &&
    !form.precioKg &&
    calculo.totalLiquidar === 0;
  const puedeConfirmar = pasoActual >= totalPasos && calculo.errores.length === 0;

  return (
    <Card className="sticky top-4 border border-slate-800 bg-[#14151d] text-white shadow-2xl">
      <CardHeader className="border-b border-white/10 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
              Resumen de liquidación
            </p>
            <CardTitle className="font-mono text-2xl text-white">
              {folioOficial ?? "TICKET #"}
            </CardTitle>
          </div>
          <QrCode className="h-10 w-10 text-emerald-300" aria-hidden="true" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="border-white/20 text-xs font-bold uppercase text-white/80"
          >
            {origen === "terceros" ? "Compra externa" : "Cosecha propia"}
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              "text-xs font-bold uppercase",
              dictamen === "aceptado"
                ? "bg-emerald-100 text-emerald-800"
                : dictamen === "observado"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
            )}
          >
            {ETIQUETA_DICTAMEN[dictamen]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {vacio ? (
          <p className="rounded-xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-white/70">
            Captura productor, pesos y precio para ver aquí el resumen de la
            recepción.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-white/60">Bruto</p>
                <p className="text-lg font-bold">
                  {(Number(form.pesoBruto) || 0).toLocaleString("es-MX")}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60">Tara</p>
                <p className="text-lg font-bold">
                  {calculo.taraTotal.toLocaleString("es-MX")}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60">Neto</p>
                <p className="text-lg font-bold text-emerald-300">
                  {calculo.pesoNeto.toLocaleString("es-MX")}
                </p>
              </div>
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Peso a pagar:</span>
                <span className="font-mono font-semibold">
                  {calculo.pesoNeto.toLocaleString("es-MX")} kg
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/60">Precio/kg:</span>
                <span className="rounded bg-emerald-500/20 px-2 font-mono font-bold text-emerald-300">
                  {moneda(Number(form.precioKg) || 0)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-white/60">Subtotal fruta:</span>
                <span className="font-mono">{moneda(calculo.subtotal)}</span>
              </div>

              {calculo.kilosMerma > 0 && (
                <div className="flex justify-between text-rose-300">
                  <span>Merma ({form.defectos}%):</span>
                  <span className="font-mono">
                    {calculo.kilosMerma.toLocaleString("es-MX")} kg
                  </span>
                </div>
              )}

              {calculo.basculaDescontada > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>(-) Báscula descontada:</span>
                  <span className="font-mono">
                    -{moneda(calculo.basculaDescontada)}
                  </span>
                </div>
              )}

              {calculo.basculaEnEfectivo > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span>Báscula cobrada en efectivo:</span>
                  <span className="font-mono">{moneda(calculo.basculaEnEfectivo)}</span>
                </div>
              )}

              {calculo.cuotaManiobraTotal > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>(-) Maniobra:</span>
                  <span className="font-mono">
                    -{moneda(calculo.cuotaManiobraTotal)}
                  </span>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between border-t-2 border-white/20 pt-3">
                <span className="text-lg font-black text-emerald-300">
                  Total a pagar:
                </span>
                <span className="font-mono text-xl font-black">
                  {moneda(calculo.totalLiquidar)}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="pt-2">
          <Button
            type="button"
            className={cn(
              "h-14 w-full text-base font-bold shadow-md transition-transform hover:scale-[1.02]",
              dictamen === "rechazado"
                ? "bg-rose-600 hover:bg-rose-700"
                : dictamen === "observado"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
            )}
            disabled={!puedeConfirmar || guardando}
            onClick={onConfirmar}
          >
            {guardando ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                GUARDANDO...
              </>
            ) : dictamen === "rechazado" ? (
              <>
                <AlertOctagon className="mr-2 h-5 w-5" aria-hidden="true" />
                LOTE RECHAZADO
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" aria-hidden="true" />
                CONFIRMAR INGRESO
              </>
            )}
          </Button>

          <p className="mt-2 text-center text-xs text-white/50">
            {puedeConfirmar
              ? "Listo para registrar el lote"
              : `Completa y revisa el paso ${totalPasos} para confirmar`}
          </p>
        </div>

        {form.notas && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="mb-1 text-xs text-white/60">Notas</p>
            <p className="text-sm text-white/90">{form.notas}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
