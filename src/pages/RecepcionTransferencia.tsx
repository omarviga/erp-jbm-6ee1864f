import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useTransferenciasCDMX } from "@/hooks/useTransferenciasCDMX";
import { Truck, PackageCheck, AlertTriangle, CheckCircle, Eye, Loader2, Camera, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DetalleRecepcion {
  presentacion_id: string;
  presentacion_nombre: string;
  cantidad_enviada: number; // Kept internally for DB, but HIDDEN from UI
  cantidad_recibida: number;
  precio_base: number;
  precio_venta: number;
  notas_diferencia: string;
}

interface FotoEvidencia {
  presentacion_id: string;
  file: File;
  preview: string;
}

export default function RecepcionTransferencia() {
  const { transferencias, isLoading, useDetallesTransferencia, procesarRecepcion } = useTransferenciasCDMX();
  const [transferenciaSeleccionada, setTransferenciaSeleccionada] = useState<string | null>(null);
  const [detallesRecepcion, setDetallesRecepcion] = useState<Record<string, DetalleRecepcion>>({});
  const [mostrarDialog, setMostrarDialog] = useState(false);
  const [fotos, setFotos] = useState<FotoEvidencia[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fotoParaProducto, setFotoParaProducto] = useState<string | null>(null);

  const { data: detalles, isLoading: loadingDetalles } = useDetallesTransferencia(transferenciaSeleccionada || undefined);

  const transferenciasEnTransito = transferencias?.filter(t => t.estado === 'en_transito') || [];

  const seleccionarTransferencia = (id: string) => {
    setTransferenciaSeleccionada(id);
    setDetallesRecepcion({});
    setFotos([]);
    setMostrarDialog(true);
  };

  const actualizarDetalle = (presentacionId: string, campo: keyof DetalleRecepcion, valor: any) => {
    setDetallesRecepcion(prev => ({
      ...prev,
      [presentacionId]: {
        ...prev[presentacionId],
        [campo]: valor,
      }
    }));
  };

  // Initialize details - cantidad_enviada is stored internally but NOT shown
  useEffect(() => {
    if (detalles && detalles.length > 0 && Object.keys(detallesRecepcion).length === 0) {
      const nuevosDetalles: Record<string, DetalleRecepcion> = {};
      detalles.forEach(d => {
        nuevosDetalles[d.presentacion_id] = {
          presentacion_id: d.presentacion_id,
          presentacion_nombre: d.presentacion?.nombre || 'Producto',
          cantidad_enviada: d.cantidad_enviada, // Internal only
          cantidad_recibida: 0, // Operator must count from scratch
          precio_base: d.precio_base,
          precio_venta: d.precio_base,
          notas_diferencia: '',
        };
      });
      setDetallesRecepcion(nuevosDetalles);
    }
  }, [detalles, detallesRecepcion]);

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fotoParaProducto) return;

    const preview = URL.createObjectURL(file);
    setFotos(prev => [...prev, { presentacion_id: fotoParaProducto, file, preview }]);
    setFotoParaProducto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const eliminarFoto = (index: number) => {
    setFotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const abrirCamara = (presentacionId: string) => {
    setFotoParaProducto(presentacionId);
    fileInputRef.current?.click();
  };

  const procesarRecepcionClick = async () => {
    if (!transferenciaSeleccionada) return;

    // Check if any discrepancy exists without photo evidence
    const hayDiscrepanciaSinFoto = Object.values(detallesRecepcion).some(d => {
      const diferencia = d.cantidad_recibida - d.cantidad_enviada;
      if (diferencia === 0) return false;
      const tieneFoto = fotos.some(f => f.presentacion_id === d.presentacion_id);
      return !tieneFoto;
    });

    if (hayDiscrepanciaSinFoto) {
      toast.error("Evidencia requerida", {
        description: "Debes subir una foto para cada producto con discrepancia."
      });
      return;
    }

    // Upload photos to storage if any
    for (const foto of fotos) {
      const ext = foto.file.name.split('.').pop();
      const path = `transferencias/${transferenciaSeleccionada}/${foto.presentacion_id}_${Date.now()}.${ext}`;
      
      const { error } = await supabase.storage
        .from('gastos-tickets') // Reusing existing bucket
        .upload(path, foto.file);

      if (error) {
        console.error("Error uploading photo:", error);
      }
    }

    const detallesArray = Object.values(detallesRecepcion).map(d => ({
      presentacion_id: d.presentacion_id,
      cantidad_recibida: d.cantidad_recibida,
      precio_venta: d.precio_venta,
      notas_diferencia: d.notas_diferencia || undefined,
    }));

    await procesarRecepcion.mutateAsync({
      transferenciaId: transferenciaSeleccionada,
      detalles: detallesArray,
    });

    // Cleanup
    fotos.forEach(f => URL.revokeObjectURL(f.preview));
    setMostrarDialog(false);
    setTransferenciaSeleccionada(null);
    setDetallesRecepcion({});
    setFotos([]);
  };

  const calcularDiferencia = (presentacionId: string) => {
    const detalle = detallesRecepcion[presentacionId];
    if (!detalle) return 0;
    return detalle.cantidad_recibida - detalle.cantidad_enviada;
  };

  const tieneDiferencias = () => {
    return Object.keys(detallesRecepcion).some(id => calcularDiferencia(id) !== 0);
  };

  const validarPrecios = () => {
    return Object.values(detallesRecepcion).every(d => d.precio_venta >= d.precio_base);
  };

  const todosContados = () => {
    return Object.values(detallesRecepcion).every(d => d.cantidad_recibida > 0);
  };

  if (isLoading) {
    return (
      <MainLayout title="Recepción de Transferencias" subtitle="Bodega CDMX">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Recepción de Transferencias" 
      subtitle="Cotejo ciego de mercancía desde Michoacán"
    >
      {/* Hidden file input for camera/gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFotoUpload}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">En Tránsito</p>
                <p className="text-3xl font-black text-orange-600">{transferenciasEnTransito.length}</p>
              </div>
              <Truck className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Recibidas Hoy</p>
                <p className="text-3xl font-black text-success">
                  {transferencias?.filter(t => 
                    t.estado === 'recibido' && 
                    new Date(t.fecha_recepcion || '').toDateString() === new Date().toDateString()
                  ).length || 0}
                </p>
              </div>
              <PackageCheck className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Con Discrepancia</p>
                <p className="text-3xl font-black text-destructive">
                  {transferencias?.filter(t => t.estado === 'con_discrepancia').length || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transfer list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transferencias por Recibir
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transferenciasEnTransito.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackageCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay transferencias pendientes de recepción</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Fecha Salida</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Placas</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferenciasEnTransito.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-bold">{t.folio}</TableCell>
                    <TableCell>{new Date(t.fecha_salida).toLocaleDateString('es-MX')}</TableCell>
                    <TableCell>{t.chofer || '—'}</TableCell>
                    <TableCell className="font-mono">{t.placas || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{t.notas_salida || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => seleccionarTransferencia(t.id)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Recepcionar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reception Dialog - BLIND: no cantidad_enviada column */}
      <Dialog open={mostrarDialog} onOpenChange={setMostrarDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Cotejo Ciego de Transferencia
            </DialogTitle>
            <DialogDescription>
              Cuenta físicamente cada producto y registra la cantidad recibida. <strong>No verás cuánto se envió.</strong>
            </DialogDescription>
          </DialogHeader>

          {loadingDetalles ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : detalles && detalles.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    {/* NO "Enviado" column - BLIND matching */}
                    <TableHead className="text-center">Cantidad Recibida</TableHead>
                    <TableHead className="text-right">Precio Base</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead>Notas / Evidencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.map((d) => {
                    const precioVentaValido = (detallesRecepcion[d.presentacion_id]?.precio_venta || d.precio_base) >= d.precio_base;
                    const fotosProducto = fotos.filter(f => f.presentacion_id === d.presentacion_id);

                    return (
                      <TableRow 
                        key={d.id}
                        className={cn(
                          !precioVentaValido && "bg-warning/10"
                        )}
                      >
                        <TableCell className="font-medium">
                          {d.presentacion?.nombre}
                          <div className="text-xs text-muted-foreground">
                            {d.presentacion?.peso_kg} kg • {d.presentacion?.tipo}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            placeholder="Contar..."
                            className="w-24 text-center text-lg font-bold mx-auto"
                            value={detallesRecepcion[d.presentacion_id]?.cantidad_recibida ?? ''}
                            onChange={(e) => actualizarDetalle(d.presentacion_id, 'cantidad_recibida', parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${d.precio_base.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min={d.precio_base}
                            className={cn(
                              "w-28 text-right font-mono",
                              !precioVentaValido && "border-destructive focus:border-destructive"
                            )}
                            value={detallesRecepcion[d.presentacion_id]?.precio_venta || d.precio_base}
                            onChange={(e) => actualizarDetalle(d.presentacion_id, 'precio_venta', parseFloat(e.target.value) || d.precio_base)}
                          />
                          {!precioVentaValido && (
                            <p className="text-xs text-destructive mt-1">Debe ser ≥ precio base</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Notas (opcional)..."
                              className="min-h-[50px] text-sm"
                              value={detallesRecepcion[d.presentacion_id]?.notas_diferencia || ''}
                              onChange={(e) => actualizarDetalle(d.presentacion_id, 'notas_diferencia', e.target.value)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => abrirCamara(d.presentacion_id)}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Foto evidencia
                            </Button>
                            {fotosProducto.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {fotosProducto.map((foto, i) => (
                                  <div key={i} className="relative w-16 h-16 rounded border border-border overflow-hidden">
                                    <img src={foto.preview} alt="Evidencia" className="w-full h-full object-cover" />
                                    <button
                                      onClick={() => eliminarFoto(fotos.indexOf(foto))}
                                      className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Separator />

              {tieneDiferencias() && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-destructive">⚠️ Se detectarán discrepancias</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Al confirmar, el sistema cruzará tus números con los de Michoacán. Si hay diferencias, se marcará como "Con Discrepancia" y se notificará al dueño con la evidencia fotográfica.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    fotos.forEach(f => URL.revokeObjectURL(f.preview));
                    setMostrarDialog(false);
                    setTransferenciaSeleccionada(null);
                    setDetallesRecepcion({});
                    setFotos([]);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={procesarRecepcionClick}
                  disabled={!validarPrecios() || !todosContados() || procesarRecepcion.isPending}
                >
                  {procesarRecepcion.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar Recepción
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No hay detalles disponibles</p>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
