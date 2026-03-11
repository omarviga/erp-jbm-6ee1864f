import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HandCoins, Loader2 } from "lucide-react";

interface VentaDetalleLigero {
  cantidad: number;
  subtotal: number | null;
  precio_unitario: number;
  inventario: { transferencia_id: string | null } | null;
  venta: { id: string; total: number; created_at: string } | null;
}

interface MemoConciliacion {
  maniobra: number;
  flete: number;
  comisiones: number;
  status: "pendiente" | "disponible" | "conciliado";
  referencia: string;
}

const STORAGE_KEY = "bodega_cdmx_conciliacion_v1";

const readStore = (): Record<string, MemoConciliacion> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, MemoConciliacion>;
  } catch {
    return {};
  }
};

const writeStore = (data: Record<string, MemoConciliacion>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export default function ConciliacionTab() {
  const [store, setStore] = useState<Record<string, MemoConciliacion>>({});

  useEffect(() => {
    setStore(readStore());
  }, []);

  const { data: transferencias, isLoading: loadingTransferencias, refetch } = useQuery({
    queryKey: ["conciliacion-transferencias-cdmx"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transferencias_bodega")
        .select("id,folio,estado,fecha_salida,fecha_recepcion,notas_recepcion")
        .order("fecha_salida", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ventasDetalle, isLoading: loadingVentas } = useQuery({
    queryKey: ["conciliacion-ventas-detalle-cdmx"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venta_detalles_cdmx")
        .select("cantidad,subtotal,precio_unitario,inventario:inventario_id(transferencia_id),venta:venta_id(id,total,created_at)");

      if (error) throw error;
      return (data || []) as unknown as VentaDetalleLigero[];
    },
  });

  const ventasPorTransferencia = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of ventasDetalle || []) {
      const transferenciaId = row.inventario?.transferencia_id;
      if (!transferenciaId) continue;
      const subtotal = row.subtotal ?? row.cantidad * row.precio_unitario;
      map.set(transferenciaId, (map.get(transferenciaId) || 0) + subtotal);
    }
    return map;
  }, [ventasDetalle]);

  const rows = useMemo(() => {
    return (transferencias || []).map((t) => {
      const memo = store[t.id] || {
        maniobra: 0,
        flete: 0,
        comisiones: 0,
        status: "pendiente" as const,
        referencia: "",
      };

      const ventas = ventasPorTransferencia.get(t.id) || 0;
      const totalDeducciones = memo.maniobra + memo.flete + memo.comisiones;
      const montoLiquidar = ventas - totalDeducciones;

      return {
        ...t,
        memo,
        ventas,
        totalDeducciones,
        montoLiquidar,
      };
    });
  }, [transferencias, store, ventasPorTransferencia]);

  const patchMemo = (id: string, patch: Partial<MemoConciliacion>) => {
    const next = {
      ...store,
      [id]: {
        ...(store[id] || { maniobra: 0, flete: 0, comisiones: 0, status: "pendiente", referencia: "" }),
        ...patch,
      },
    };
    setStore(next);
    writeStore(next);
  };

  const marcarDisponible = async (id: string, folio: string) => {
    patchMemo(id, { status: "disponible" });
    try {
      const { error } = await supabase.from("notificaciones").insert({
        titulo: "Flujo de retorno disponible",
        mensaje: `El viaje ${folio} tiene monto a liquidar disponible para deposito en cuenta de la empresa.`,
        categoria: "sistema",
        tipo: "alert",
        referencia_id: id,
        referencia_tipo: "conciliacion_cdmx",
        user_id: null,
      });
      if (error) throw error;
      toast.success("Alerta enviada a finanzas (Michoacan)");
    } catch {
      toast.success("Estatus en disponible guardado");
    }
  };

  const marcarConciliado = async (id: string) => {
    patchMemo(id, { status: "conciliado" });

    const current = rows.find((r) => r.id === id);
    const note = `${current?.notas_recepcion || ""}\n[CONCILIADO_CDMX ${new Date().toISOString()} ${store[id]?.referencia || ""}]`.trim();

    const { error } = await supabase
      .from("transferencias_bodega")
      .update({ notas_recepcion: note })
      .eq("id", id);

    if (error) {
      toast.warning("Conciliado localmente, no se pudo persistir en transferencia");
    } else {
      toast.success("Viaje marcado como conciliado");
      refetch();
    }
  };

  const isLoading = loadingTransferencias || loadingVentas;

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Conciliacion y flujo de retorno</h1>
        <p className="text-sm text-muted-foreground">
          Reporte de liquidacion por viaje: Ventas Totales - (Maniobra + Flete + Comisiones) = Monto a Liquidar.
        </p>
      </div>

      <Card className="mb-6 border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 text-sm text-blue-900">
          Proceso: al quedar el monto disponible se notifica a finanzas en Michoacan. Tras deposito del vendedor se marca como conciliado.
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><HandCoins className="h-4 w-4" /> {row.folio}</span>
                  <Badge variant={row.memo.status === "conciliado" ? "default" : row.memo.status === "disponible" ? "secondary" : "outline"}>
                    {row.memo.status === "pendiente" ? "Pendiente" : row.memo.status === "disponible" ? "Disponible para deposito" : "Conciliado"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Salida: {new Date(row.fecha_salida).toLocaleString("es-MX")} • Recepcion: {row.fecha_recepcion ? new Date(row.fecha_recepcion).toLocaleString("es-MX") : "Pendiente"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <Label>Ventas totales</Label>
                    <div className="h-10 rounded-md border px-3 flex items-center font-mono">${row.ventas.toFixed(2)}</div>
                  </div>
                  <div>
                    <Label>Maniobra</Label>
                    <Input type="number" step="0.01" value={row.memo.maniobra} onChange={(e) => patchMemo(row.id, { maniobra: Number(e.target.value || 0) })} />
                  </div>
                  <div>
                    <Label>Flete</Label>
                    <Input type="number" step="0.01" value={row.memo.flete} onChange={(e) => patchMemo(row.id, { flete: Number(e.target.value || 0) })} />
                  </div>
                  <div>
                    <Label>Comisiones</Label>
                    <Input type="number" step="0.01" value={row.memo.comisiones} onChange={(e) => patchMemo(row.id, { comisiones: Number(e.target.value || 0) })} />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-md border p-3">Deducciones: <strong className="font-mono">${row.totalDeducciones.toFixed(2)}</strong></div>
                  <div className="rounded-md border p-3">Monto a liquidar: <strong className="font-mono">${row.montoLiquidar.toFixed(2)}</strong></div>
                  <div className="rounded-md border p-3">
                    Referencia deposito
                    <Input className="mt-2" value={row.memo.referencia} onChange={(e) => patchMemo(row.id, { referencia: e.target.value })} placeholder="Ej: SPEI 12345" />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => marcarDisponible(row.id, row.folio)} disabled={row.memo.status === "conciliado"}>
                    Marcar disponible
                  </Button>
                  <Button onClick={() => marcarConciliado(row.id)} disabled={row.memo.status === "conciliado"}>
                    Marcar conciliado
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!rows.length && <p className="text-sm text-muted-foreground">No hay transferencias para conciliar.</p>}
        </div>
      )}
    </div>
  );
}
