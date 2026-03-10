import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2 } from "lucide-react";

import { useKardexLote } from "@/hooks/useKardexLote";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: string | null;
  loteLabel?: string | null;
};

const movimientoLabel: Record<string, string> = {
  traslado_interno: "Traslado a Cámara",
  envio_cdmx: "Envío a CDMX",
  merma: "Merma",
};

export function HistorialLoteModal({ open, onOpenChange, loteId, loteLabel }: Props) {
  const { data = [], isLoading, error } = useKardexLote(loteId || undefined, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Historial Kardex del Lote</DialogTitle>
          <DialogDescription>
            {loteLabel ? `Trazabilidad completa de movimientos para ${loteLabel}` : "Trazabilidad completa de movimientos del lote seleccionado."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando historial...
          </div>
        )}

        {error && (
          <div className="text-sm text-rose-600 space-y-1">
            <p>No se pudo cargar el historial del kardex.</p>
            <p className="text-xs opacity-80">{error instanceof Error ? error.message : "Error desconocido"}</p>
          </div>
        )}
        {error && <p className="text-sm text-rose-600">No se pudo cargar el historial del kardex.</p>}

        {!isLoading && !error && (
          <div className="max-h-[65vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Tipo de movimiento</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Origen → Destino</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">
                      {format(new Date(row.created_at), "dd MMM yyyy, HH:mm:ss", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{movimientoLabel[row.tipo_movimiento] || row.tipo_movimiento}</Badge>
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", row.cantidad >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {row.cantidad >= 0 ? `+${row.cantidad}` : row.cantidad}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.ubicacion_origen} → {row.ubicacion_destino}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.usuario_nombre || row.usuario_email || row.usuario_id}
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      Sin movimientos registrados para este lote.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
