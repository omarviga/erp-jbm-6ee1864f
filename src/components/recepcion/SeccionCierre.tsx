import { AlertTriangle, Loader2, Printer, RotateCcw, Save, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PropsSeccionRecepcion } from "./tipos";

interface SeccionCierreProps extends PropsSeccionRecepcion {
  errores: string[];
  onReiniciar: () => void;
}

export function SeccionCierre({
  form,
  setCampo,
  dictamen,
  guardando,
  onGuardarEImprimir,
  onGuardar,
  onReiniciar,
  errores,
}: SeccionCierreProps) {
  const bloqueado = errores.length > 0;

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          Cierre de la recepción
        </CardTitle>
        <CardDescription>
          Responsable del pesaje y observaciones del lote.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="operador-bascula" className="font-semibold">
              Operador de báscula *
            </Label>
            <Input
              id="operador-bascula"
              value={form.operadorBascula}
              onChange={(e) => setCampo("operadorBascula", e.target.value)}
              placeholder="Nombre del operador"
              className="h-12"
              autoComplete="off"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Queda registrado como responsable del pesaje en la trazabilidad.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas" className="font-semibold">
              Observaciones / lote
            </Label>
            <Textarea
              id="notas"
              value={form.notas}
              onChange={(e) => setCampo("notas", e.target.value)}
              placeholder="Ej. Fruta verde corte matutino"
              className="min-h-[92px]"
              maxLength={500}
            />
          </div>
        </div>

        {bloqueado && (
          <ul className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            {errores.map((error) => (
              <li
                key={error}
                className="flex items-start gap-2 text-sm text-amber-800"
              >
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                {error}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            size="lg"
            className={cn(
              "h-14 flex-1 text-base font-bold",
              dictamen === "rechazado"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            )}
            onClick={onGuardarEImprimir}
            disabled={bloqueado || guardando}
            data-testid="guardar-imprimir"
          >
            {guardando ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                Guardando...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-5 w-5" aria-hidden="true" />
                Guardar e imprimir directo
              </>
            )}
          </Button>

          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-14 sm:w-52"
            onClick={onGuardar}
            disabled={bloqueado || guardando}
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            Guardar boleta
          </Button>

          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="h-14"
            onClick={onReiniciar}
            disabled={guardando}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
