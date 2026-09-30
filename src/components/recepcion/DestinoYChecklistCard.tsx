import { CheckCircle2, Circle, MapPin, PackageCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ItemChecklist } from "./tipos";

interface DestinoYChecklistCardProps {
  items: ItemChecklist[];
  destino?: string;
}

export function DestinoYChecklistCard({
  items,
  destino = "Línea de Producción",
}: DestinoYChecklistCardProps) {
  const pendientesObligatorios = items.filter(
    (item) => item.obligatorio && !item.listo
  ).length;
  const listo = pendientesObligatorios === 0;

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-4 w-4" aria-hidden="true" />
          Cierre de la recepción
        </CardTitle>
        <CardDescription>
          El lote queda disponible en producción en cuanto se confirma.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">Destino del lote</p>
            <p className="text-sm font-semibold">{destino}</p>
          </div>
        </div>

        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.etiqueta} className="flex items-center gap-2 text-sm">
              {item.listo ? (
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className={cn(
                    "h-4 w-4 shrink-0",
                    item.obligatorio ? "text-rose-400" : "text-slate-300"
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  item.listo ? "text-slate-700" : "text-slate-500",
                  !item.listo && item.obligatorio && "font-medium text-rose-600"
                )}
              >
                {item.etiqueta}
                {!item.obligatorio && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (opcional)
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <p
          className={cn(
            "rounded-lg p-3 text-xs font-medium",
            listo
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
          )}
        >
          {listo
            ? "Requisitos completos: puedes confirmar el ingreso del lote."
            : `Faltan ${pendientesObligatorios} dato(s) obligatorio(s) para poder confirmar.`}
        </p>
      </CardContent>
    </Card>
  );
}
