import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useTransferenciasCDMX } from "@/hooks/useTransferenciasCDMX";
import { Truck, PackageCheck, AlertTriangle, Eye, Loader2, Camera, X } from "lucide-react";
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
  cantidad_enviada: number; // HIDDEN from operator - internal only
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

export default function RecepcionesTab() {
  const { transferencias, isLoading, error, useDetallesTransferencia, procesarRecepcion } = useTransferenciasCDMX();
  const [transferenciaSeleccionada, setTransferenciaSeleccionada] = useState<string | null>(null);
  const [transferenciaSeguimiento, setTransferenciaSeguimiento] = useState<string | null>(null);
  const [detallesRecepcion, setDetallesRecepcion] = useState<Record<string, DetalleRecepcion>>({});
  const [mostrarDialog, setMostrarDialog] = useState(false);
  const [mostrarSeguimientoDialog, setMostrarSeguimientoDialog] = useState(false);
  const [fotos, setFotos] = useState<FotoEvidencia[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fotoParaProducto, setFotoParaProducto] = useState<string | null>(null);

  const { data: detalles, isLoading: loadingDetalles } = useDetallesTransferencia(transferenciaSeleccionada || undefined);
  const { data: detallesSeguimiento, isLoading: loadingDetallesSeguimiento } = useDetallesTransferencia(transferenciaSeguimiento || undefined);

  const transferenciasEnTransito = transferencias?.filter(t => t.estado === 'en_transito') || [];

  const badgeEstado = (estado: string) => {
    if (estado === 'recibido') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Recibido</Badge>;
    if (estado === 'con_discrepancia') return <Badge className="bg-rose-100 text-rose-700 border-rose-200">Con discrepancia</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">En tránsito</Badge>;
  };

  const seleccionarTransferencia = (id: string) => {
    setTransferenciaSeleccionada(id);
    setDetallesRecepcion({});
    setFotos([]);
    setMostrarDialog(true);
  };

  const abrirSeguimiento = (id: string) => {
    setTransferenciaSeguimiento(id);
    setMostrarSeguimientoDialog(true);
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

  // Initialize details - cantidad_enviada is stored internally but NEVER shown to operator
  useEffect(() => {
    if (detalles && detalles.length > 0 && Object.keys(detallesRecepcion).length === 0) {
      const nuevosDetalles: Record<string, DetalleRecepcion> = {};
      detalles.forEach(d => {
        nuevosDetalles[d.presentacion_id] = {
          presentacion_id: d.presentacion_id,
          presentacion_nombre: d.presentacion?.nombre || 'Producto',
          cantidad_enviada: d.cantidad_enviada, // Internal only - BLIND matching
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

    // Upload photos to storage
    for (const foto of fotos) {
      const ext = foto.file.name.split('.').pop();
      const path = `transferencias/${transferenciaSeleccionada}/${foto.presentacion_id}_${Date.now()}.${ext}`;
      
      const { error } = await supabase.storage
        .from('gastos-tickets')
        .upload(path, foto.file);

      if (error) {
        throw new Error(`No se pudo subir la evidencia para ${detallesRecepcion[foto.presentacion_id]?.presentacion_nombre || 'el producto'}.`);
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

  const transferenciaSeguimientoData = (transferencias || []).find((t) => t.id === transferenciaSeguimiento);
  const resumenSeguimiento = detallesSeguimiento?.reduce((acc, detalle) => {
    const enviados = detalle.cantidad_enviada || 0;
    const recibidos = detalle.cantidad_recibida || 0;
    const diferencia = detalle.diferencia ?? (recibidos - enviados);

    acc.totalEnviado += enviados;
    acc.totalRecibido += recibidos;
    acc.totalDiferencia += diferencia;

    if (diferencia !== 0) {
      acc.lineasConDiferencia += 1;
    }

    return acc;
  }, {
    totalEnviado: 0,
    totalRecibido: 0,
    totalDiferencia: 0,
    lineasConDiferencia: 0,
  });

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      {/* Hidden file input for camera/gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFotoUpload}
      />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Recepción de Transferencias</h1>
        <p className="text-sm text-muted-foreground">Cotejo ciego de mercancía desde Michoacán</p>
      </div>

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
                <p className="text-3xl font-black text-green-600">
                  {transferencias?.filter(t => 
                    t.estado === 'recibido' && 
                    new Date(t.fecha_recepcion || '').toDateString() === new Date().toDateString()
                  ).length || 0}
                </p>
              </div>
              <PackageCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Con Discrepancia</p>
                <p className="text-3xl font-black text-red-600">
                  {transferencias?.filter(t => t.estado === 'con_discrepancia').length || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transfer list */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transferencias por Recibir
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : transferenciasEnTransito.length === 0 ? (
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

      {/* Seguimiento completo */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Seguimiento de envíos</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              No se pudieron cargar las transferencias. Verifica permisos del rol para seguimiento de envíos.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Recepción</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Cotejo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(transferencias || []).slice(0, 20).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.folio}</TableCell>
                    <TableCell>{new Date(t.fecha_salida).toLocaleString('es-MX')}</TableCell>
                    <TableCell>{t.fecha_recepcion ? new Date(t.fecha_recepcion).toLocaleString('es-MX') : 'Pendiente'}</TableCell>
                    <TableCell>{t.chofer || '—'}</TableCell>
                    <TableCell>{badgeEstado(t.estado)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirSeguimiento(t.id)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver cotejo
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(transferencias || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay envíos registrados aún.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reception Dialog - BLIND: NO cantidad_enviada column visible */}
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
                        className={cn(!precioVentaValido && "bg-yellow-50")}
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
                              !precioVentaValido && "border-red-500 focus:border-red-500"
                            )}
                            value={detallesRecepcion[d.presentacion_id]?.precio_venta || d.precio_base}
                            onChange={(e) => actualizarDetalle(d.presentacion_id, 'precio_venta', parseFloat(e.target.value) || d.precio_base)}
                          />
                          {!precioVentaValido && (
                            <p className="text-xs text-red-600 mt-1">Debe ser ≥ precio base</p>
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
                                  <div key={i} className="relative w-16 h-16 rounded border overflow-hidden">
                                    <img src={foto.preview} alt="Evidencia" className="w-full h-full object-cover" />
                                    <button
                                      onClick={() => eliminarFoto(fotos.indexOf(foto))}
                                      className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
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
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-700">⚠️ Se detectarán discrepancias</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Solo lo que declares como recibido entrará a tu inventario. Las diferencias quedarán registradas.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setMostrarDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={procesarRecepcionClick}
                  disabled={!todosContados() || !validarPrecios() || procesarRecepcion.isPending}
                  className="bg-[#1E5128] hover:bg-[#1E5128]/90"
                >
                  {procesarRecepcion.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                  ) : (
                    <><PackageCheck className="w-4 h-4 mr-2" /> Confirmar Recepción</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No hay detalles para esta transferencia</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={mostrarSeguimientoDialog}
        onOpenChange={(open) => {
          setMostrarSeguimientoDialog(open);
          if (!open) {
            setTransferenciaSeguimiento(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Cotejo de envío
            </DialogTitle>
            <DialogDescription>
              Vista administrativa para comparar lo enviado desde Michoacán contra lo recibido en CDMX.
            </DialogDescription>
          </DialogHeader>

          {transferenciaSeguimientoData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Folio</p>
                  <p className="mt-2 font-mono text-lg font-bold">{transferenciaSeguimientoData.folio}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Estado</p>
                  <div className="mt-2">{badgeEstado(transferenciaSeguimientoData.estado)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Chofer</p>
                  <p className="mt-2 text-sm font-medium">{transferenciaSeguimientoData.chofer || '—'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Recepción</p>
                  <p className="mt-2 text-sm font-medium">
                    {transferenciaSeguimientoData.fecha_recepcion
                      ? new Date(transferenciaSeguimientoData.fecha_recepcion).toLocaleString('es-MX')
                      : 'Pendiente'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {resumenSeguimiento && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Total enviado</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{resumenSeguimiento.totalEnviado}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Total recibido</p>
                  <p className="mt-2 text-2xl font-black text-emerald-700">{resumenSeguimiento.totalRecibido}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Diferencia neta</p>
                  <p className={cn(
                    "mt-2 text-2xl font-black",
                    resumenSeguimiento.totalDiferencia === 0 ? "text-slate-900" : "text-rose-700"
                  )}>
                    {resumenSeguimiento.totalDiferencia > 0 ? "+" : ""}
                    {resumenSeguimiento.totalDiferencia}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Líneas con diferencia</p>
                  <p className="mt-2 text-2xl font-black text-amber-700">{resumenSeguimiento.lineasConDiferencia}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {loadingDetallesSeguimiento ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : detallesSeguimiento && detallesSeguimiento.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Enviado</TableHead>
                  <TableHead className="text-center">Recibido</TableHead>
                  <TableHead className="text-center">Diferencia</TableHead>
                  <TableHead className="text-right">Precio base</TableHead>
                  <TableHead className="text-right">Precio venta</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detallesSeguimiento.map((detalle) => {
                  const enviados = detalle.cantidad_enviada || 0;
                  const recibidos = detalle.cantidad_recibida || 0;
                  const diferencia = detalle.diferencia ?? (recibidos - enviados);
                  const tieneDiferencia = diferencia !== 0;

                  return (
                    <TableRow key={detalle.id} className={cn(tieneDiferencia && "bg-rose-50/70")}>
                      <TableCell>
                        <div className="font-medium">{detalle.presentacion?.nombre || 'Producto'}</div>
                        <div className="text-xs text-muted-foreground">
                          {detalle.presentacion?.peso_kg} kg • {detalle.presentacion?.tipo}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{enviados}</TableCell>
                      <TableCell className="text-center font-semibold">{recibidos}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono",
                            tieneDiferencia
                              ? "border-rose-200 bg-rose-100 text-rose-700"
                              : "border-emerald-200 bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {diferencia > 0 ? "+" : ""}
                          {diferencia}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">${detalle.precio_base.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {typeof detalle.precio_venta === "number" ? `$${detalle.precio_venta.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                        {detalle.notas_diferencia || (tieneDiferencia ? 'Sin nota capturada' : 'Sin discrepancia')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay detalles disponibles para este envío.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
