import { useEffect, useMemo, useRef, useState } from "react";
import { useTransferenciasCDMX } from "@/hooks/useTransferenciasCDMX";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Camera, Eye, Loader2, ShieldCheck, Truck, Upload, X } from "lucide-react";

interface DetalleRecepcionForm {
  presentacion_id: string;
  presentacion_nombre: string;
  cantidad_enviada: number;
  cantidad_recibida: number;
  precio_base: number;
  precio_venta: number;
  notas_diferencia: string;
  evidencia?: File | null;
  evidenciaPreview?: string | null;
}

export default function RecepcionesTab() {
  const { transferencias, isLoading, useDetallesTransferencia, procesarRecepcion } = useTransferenciasCDMX();

  const [transferenciaId, setTransferenciaId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, DetalleRecepcionForm>>({});
  const [open, setOpen] = useState(false);
  const [presentacionCarga, setPresentacionCarga] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: detalles } = useDetallesTransferencia(transferenciaId || undefined);

  const enTransito = useMemo(
    () => (transferencias || []).filter((item) => item.estado === "en_transito"),
    [transferencias]
  );

  useEffect(() => {
    if (!detalles || !detalles.length) return;

    const next: Record<string, DetalleRecepcionForm> = {};
    detalles.forEach((d) => {
      next[d.presentacion_id] = {
        presentacion_id: d.presentacion_id,
        presentacion_nombre: d.presentacion?.nombre || "Producto",
        cantidad_enviada: d.cantidad_enviada,
        cantidad_recibida: d.cantidad_recibida || 0,
        precio_base: d.precio_base,
        precio_venta: Math.max(d.precio_venta || d.precio_base, d.precio_base),
        notas_diferencia: d.notas_diferencia || "",
        evidencia: null,
        evidenciaPreview: null,
      };
    });

    setForm(next);
  }, [detalles]);

  const abrirRecepcion = (id: string) => {
    setTransferenciaId(id);
    setForm({});
    setOpen(true);
  };

  const setDetalle = (presentacionId: string, patch: Partial<DetalleRecepcionForm>) => {
    setForm((prev) => ({
      ...prev,
      [presentacionId]: { ...prev[presentacionId], ...patch },
    }));
  };

  const onPickFoto = (presentacionId: string) => {
    setPresentacionCarga(presentacionId);
    inputRef.current?.click();
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file || !presentacionCarga) return;

    const preview = URL.createObjectURL(file);
    const old = form[presentacionCarga]?.evidenciaPreview;
    if (old) URL.revokeObjectURL(old);

    setDetalle(presentacionCarga, {
      evidencia: file,
      evidenciaPreview: preview,
    });

    setPresentacionCarga(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const limpiarTodo = () => {
    Object.values(form).forEach((x) => {
      if (x.evidenciaPreview) URL.revokeObjectURL(x.evidenciaPreview);
    });
    setForm({});
    setTransferenciaId(null);
    setOpen(false);
  };

  const guardarRecepcion = async () => {
    if (!transferenciaId) return;

    const rows = Object.values(form);
    if (!rows.length) {
      toast.error("No hay partidas para recepcionar");
      return;
    }

    const sinConteo = rows.some((r) => r.cantidad_recibida < 0);
    if (sinConteo) {
      toast.error("Cantidad recibida invalida");
      return;
    }

    const precioDebajo = rows.some((r) => r.precio_venta < r.precio_base);
    if (precioDebajo) {
      toast.error("Candado de precio activado", {
        description: "precio_venta debe ser mayor o igual a precio_base.",
      });
      return;
    }

    const sinEvidencia = rows.some((r) => !r.evidencia);
    if (sinEvidencia) {
      toast.error("Evidencia fotografica obligatoria", {
        description: "Debes subir al menos una foto por cada producto recibido.",
      });
      return;
    }

    try {
      for (const row of rows) {
        if (!row.evidencia) continue;

        const ext = row.evidencia.name.split(".").pop() || "jpg";
        const path = `transferencias/${transferenciaId}/${row.presentacion_id}_${Date.now()}.${ext}`;

        const { error } = await supabase.storage.from("gastos-tickets").upload(path, row.evidencia);
        if (error) throw error;
      }

      await procesarRecepcion.mutateAsync({
        transferenciaId,
        detalles: rows.map((row) => ({
          presentacion_id: row.presentacion_id,
          cantidad_recibida: row.cantidad_recibida,
          precio_venta: row.precio_venta,
          notas_diferencia: row.notas_diferencia || undefined,
        })),
      });

      toast.success("Recepcion procesada");
      limpiarTodo();
    } catch (error: any) {
      toast.error("No se pudo procesar la recepcion", {
        description: error?.message || "Error desconocido",
      });
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Recepciones CDMX</h1>
        <p className="text-sm text-muted-foreground">Cotejo ciego: no se muestra la cantidad enviada al operador.</p>
      </div>

      <Card className="mb-6 border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4 flex items-center gap-3 text-emerald-800">
          <ShieldCheck className="h-5 w-5" />
          Regla activa: evidencias fotograficas obligatorias y candado de precio en recepcion.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Transferencias en transito</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : !enTransito.length ? (
            <p className="text-sm text-muted-foreground">No hay transferencias pendientes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Fecha salida</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enTransito.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-bold">{t.folio}</TableCell>
                    <TableCell>{new Date(t.fecha_salida).toLocaleString("es-MX")}</TableCell>
                    <TableCell>{t.chofer || "-"}</TableCell>
                    <TableCell><Badge variant="outline">En transito</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => abrirRecepcion(t.id)}>
                        <Eye className="h-4 w-4 mr-2" /> Recepcionar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(value) => (!value ? limpiarTodo() : setOpen(value))}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Recepcion ciega</DialogTitle>
            <DialogDescription>
              No se muestra cantidad enviada; captura conteo fisico y evidencia por cada producto.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="w-[150px]">Cantidad recibida</TableHead>
                  <TableHead className="w-[150px]">Precio venta</TableHead>
                  <TableHead>Notas de diferencia</TableHead>
                  <TableHead className="w-[230px]">Evidencia foto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(form).map((row) => {
                  const diferencia = row.cantidad_recibida - row.cantidad_enviada;
                  return (
                    <TableRow key={row.presentacion_id}>
                      <TableCell>
                        <div className="font-medium">{row.presentacion_nombre}</div>
                        {diferencia !== 0 && <div className="text-xs text-amber-600">Diferencia detectada: {diferencia > 0 ? `+${diferencia}` : diferencia}</div>}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={row.cantidad_recibida}
                          onChange={(e) => setDetalle(row.presentacion_id, { cantidad_recibida: Number(e.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={row.precio_base}
                          step="0.01"
                          value={row.precio_venta}
                          onChange={(e) => setDetalle(row.presentacion_id, { precio_venta: Number(e.target.value || row.precio_base) })}
                        />
                        <p className="text-[10px] mt-1 text-muted-foreground">Min: ${row.precio_base.toFixed(2)}</p>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={row.notas_diferencia}
                          onChange={(e) => setDetalle(row.presentacion_id, { notas_diferencia: e.target.value })}
                          placeholder="Observaciones"
                        />
                      </TableCell>
                      <TableCell>
                        {!row.evidencia ? (
                          <Button type="button" variant="outline" onClick={() => onPickFoto(row.presentacion_id)}>
                            <Camera className="h-4 w-4 mr-2" /> Subir evidencia
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2 border rounded-md p-2">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs truncate">{row.evidencia.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (row.evidenciaPreview) URL.revokeObjectURL(row.evidenciaPreview);
                                setDetalle(row.presentacion_id, { evidencia: null, evidenciaPreview: null });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={limpiarTodo}>Cancelar</Button>
            <Button onClick={guardarRecepcion} disabled={procesarRecepcion.isPending}>
              {procesarRecepcion.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</> : "Confirmar recepcion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
