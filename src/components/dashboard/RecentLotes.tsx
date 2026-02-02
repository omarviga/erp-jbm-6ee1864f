import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLotesRecientes } from "@/hooks/useLoteMutations";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const estadoConfig = {
  pendiente: { label: "Pendiente", className: "status-pendiente" },
  en_proceso: { label: "En Proceso", className: "status-en-proceso" },
  liquidado: { label: "Liquidado", className: "status-liquidado" },
};

export function RecentLotes() {
  const navigate = useNavigate();
  const { data: lotes, isLoading, error } = useLotesRecientes(5);

  const handleLoteClick = (numeroLote: string) => {
    navigate(`/lotes/${numeroLote}`);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  // Get producer/huerto name
  const getOrigen = (lote: NonNullable<typeof lotes>[number]) => {
    if (lote.es_cosecha_propia && lote.huertos) {
      return `Cosecha Propia - ${lote.huertos.nombre}`;
    }
    if (lote.productores) {
      return lote.productores.nombre;
    }
    return "Sin origen";
  };

  return (
    <Card className="module-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Lotes Recientes</CardTitle>
          <a href="/recepcion" className="text-sm text-primary font-medium hover:underline">
            Ver todos →
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-3 w-16 ml-auto" />
                </div>
              </div>
            ))
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Error al cargar lotes</p>
              <p className="text-sm">{error.message}</p>
            </div>
          ) : lotes && lotes.length > 0 ? (
            lotes.map((lote) => (
              <div
                key={lote.id}
                onClick={() => handleLoteClick(lote.numero_lote)}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 hover:border-primary/30 border border-transparent transition-all cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">{lote.numero_lote}</span>
                    <Badge variant="outline" className={cn("text-xs", estadoConfig[lote.estado].className)}>
                      {estadoConfig[lote.estado].label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {getOrigen(lote)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {(lote.peso_neto ?? 0).toLocaleString("es-MX")} kg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(lote.fecha_recepcion)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay lotes registrados</p>
              <a href="/recepcion" className="text-sm text-primary hover:underline">
                Registrar primer lote →
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
