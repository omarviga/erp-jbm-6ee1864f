import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useTransferenciasCDMX } from "@/hooks/useTransferenciasCDMX";
import { Truck, PackageCheck, AlertTriangle, CheckCircle, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  DialogTrigger,
} from "@/components/ui/dialog";

interface DetalleRecepcion {
  presentacion_id: string;
  presentacion_nombre: string;
  cantidad_enviada: number;
  cantidad_recibida: number;
  precio_base: number;
  precio_venta: number;
  notas_diferencia: string;
}

export default function RecepcionTransferencia() {
  const { transferencias, isLoading, useDetallesTransferencia, procesarRecepcion } = useTransferenciasCDMX();
  const [transferenciaSeleccionada, setTransferenciaSeleccionada] = useState<string | null>(null);
  const [detallesRecepcion, setDetallesRecepcion] = useState<Record<string, DetalleRecepcion>>({});
  const [mostrarDialog, setMostrarDialog] = useState(false);

  const { data: detalles, isLoading: loadingDetalles } = useDetallesTransferencia(transferenciaSeleccionada || undefined);

  const transferenciasEnTransito = transferencias?.filter(t => t.estado === 'en_transito') || [];

  const seleccionarTransferencia = (id: string) => {
    setTransferenciaSeleccionada(id);
    setDetallesRecepcion({});
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

  const inicializarDetalles = () => {
    if (!detalles) return;
    
    const nuevosDetalles: Record<string, DetalleRecepcion> = {};
    detalles.forEach(d => {
      nuevosDetalles[d.presentacion_id] = {
        presentacion_id: d.presentacion_id,
        presentacion_nombre: d.presentacion?.nombre || 'Producto',
        cantidad_enviada: d.cantidad_enviada,
        cantidad_recibida: d.cantidad_enviada, // Por defecto, asumir que se recibe todo
        precio_base: d.precio_base,
        precio_venta: d.precio_base, // Por defecto, mismo que precio base
        notas_diferencia: '',
      };
    });
    setDetallesRecepcion(nuevosDetalles);
  };

  const procesarRecepcionClick = async () => {
    if (!transferenciaSeleccionada) return;

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

    setMostrarDialog(false);
    setTransferenciaSeleccionada(null);
    setDetallesRecepcion({});
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

      {/* Lista de transferencias en tránsito */}
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
                      <Button
                        size="sm"
                        onClick={() => seleccionarTransferencia(t.id)}
                      >
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

      {/* Dialog de Recepción */}
      <Dialog open={mostrarDialog} onOpenChange={setMostrarDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Cotejo de Transferencia
            </DialogTitle>
            <DialogDescription>
              Verifica la mercancía recibida vs. enviada. Los precios de venta deben ser iguales o mayores al precio base.
            </DialogDescription>
          </DialogHeader>

          {loadingDetalles ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : detalles && detalles.length > 0 ? (
            <div className="space-y-4">
              {/* Inicializar detalles si aún no están cargados */}
              {Object.keys(detallesRecepcion).length === 0 && inicializarDetalles()}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Enviado</TableHead>
                    <TableHead className="text-center">Recibido</TableHead>
                    <TableHead className="text-center">Diferencia</TableHead>
                    <TableHead className="text-right">Precio Base</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.map((d) => {
                    const diferencia = calcularDiferencia(d.presentacion_id);
                    const precioVentaValido = (detallesRecepcion[d.presentacion_id]?.precio_venta || d.precio_base) >= d.precio_base;

                    return (
                      <TableRow 
                        key={d.id}
                        className={cn(
                          diferencia !== 0 && "bg-red-50 dark:bg-red-950/20",
                          !precioVentaValido && "bg-yellow-50 dark:bg-yellow-950/20"
                        )}
                      >
                        <TableCell className="font-medium">
                          {d.presentacion?.nombre}
                          <div className="text-xs text-muted-foreground">
                            {d.presentacion?.peso_kg} kg • {d.presentacion?.tipo}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold">{d.cantidad_enviada}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            className="w-20 text-center"
                            value={detallesRecepcion[d.presentacion_id]?.cantidad_recibida || d.cantidad_enviada}
                            onChange={(e) => actualizarDetalle(d.presentacion_id, 'cantidad_recibida', parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {diferencia !== 0 && (
                            <Badge variant={diferencia > 0 ? "default" : "destructive"}>
                              {diferencia > 0 ? '+' : ''}{diferencia}
                            </Badge>
                          )}
                          {diferencia === 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          )}
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
                              !precioVentaValido && "border-yellow-500 focus:border-yellow-600"
                            )}
                            value={detallesRecepcion[d.presentacion_id]?.precio_venta || d.precio_base}
                            onChange={(e) => actualizarDetalle(d.presentacion_id, 'precio_venta', parseFloat(e.target.value) || d.precio_base)}
                          />
                          {!precioVentaValido && (
                            <p className="text-xs text-yellow-600 mt-1">Debe ser ≥ precio base</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {diferencia !== 0 && (
                            <Textarea
                              placeholder="Explicar diferencia..."
                              className="min-h-[60px] text-sm"
                              value={detallesRecepcion[d.presentacion_id]?.notas_diferencia || ''}
                              onChange={(e) => actualizarDetalle(d.presentacion_id, 'notas_diferencia', e.target.value)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Separator />

              {tieneDiferencias() && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">Discrepancias Detectadas</h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        Se detectaron diferencias entre lo enviado y recibido. La transferencia se marcará como "Con Discrepancia" y se notificará al administrador.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMostrarDialog(false);
                    setTransferenciaSeleccionada(null);
                    setDetallesRecepcion({});
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={procesarRecepcionClick}
                  disabled={!validarPrecios() || procesarRecepcion.isPending}
                >
                  {procesarRecepcion.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {tieneDiferencias() ? 'Recepcionar con Discrepancia' : 'Confirmar Recepción'}
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
