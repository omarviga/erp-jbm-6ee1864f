import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMaquila } from "@/hooks/useMaquila";
import { Factory, Plus, Users, FileText, DollarSign, Package, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Maquila() {
  const { clientes, ordenes, loadingClientes, loadingOrdenes, crearCliente, crearOrden, actualizarOrden } = useMaquila();

  // --- New Client State ---
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "", rfc: "", contacto: "", telefono: "", tarifa_kg: 0, tarifa_caja: 0,
  });

  // --- New Order State ---
  const [showNuevaOrden, setShowNuevaOrden] = useState(false);
  const [nuevaOrden, setNuevaOrden] = useState({
    cliente_maquila_id: "", kilos_recibidos: 0,
  });

  // --- Update Order State ---
  const [editandoOrden, setEditandoOrden] = useState<string | null>(null);
  const [updateData, setUpdateData] = useState({ kilos_procesados: 0, cajas_empacadas: 0 });

  const handleCrearCliente = () => {
    if (!nuevoCliente.nombre || nuevoCliente.tarifa_kg <= 0) return;
    crearCliente.mutate(nuevoCliente, {
      onSuccess: () => {
        setShowNuevoCliente(false);
        setNuevoCliente({ nombre: "", rfc: "", contacto: "", telefono: "", tarifa_kg: 0, tarifa_caja: 0 });
      },
    });
  };

  const handleCrearOrden = () => {
    if (!nuevaOrden.cliente_maquila_id) return;
    const folio = `MQ-${format(new Date(), "yyMMdd")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
    crearOrden.mutate({ ...nuevaOrden, folio }, {
      onSuccess: () => {
        setShowNuevaOrden(false);
        setNuevaOrden({ cliente_maquila_id: "", kilos_recibidos: 0 });
      },
    });
  };

  const handleFinalizarOrden = (orden: any) => {
    const cliente = clientes.find((c) => c.id === orden.cliente_maquila_id);
    const costoKg = (orden.kilos_procesados || 0) * (cliente?.tarifa_kg || 0);
    const costoCaja = (orden.cajas_empacadas || 0) * (cliente?.tarifa_caja || 0);
    const costoTotal = costoKg + costoCaja;

    actualizarOrden.mutate({
      id: orden.id,
      status: "completada",
      fecha_fin: new Date().toISOString().split("T")[0],
      costo_total: costoTotal,
    });
  };

  const handleRegistrarProceso = (ordenId: string) => {
    actualizarOrden.mutate({
      id: ordenId,
      kilos_procesados: updateData.kilos_procesados,
      cajas_empacadas: updateData.cajas_empacadas,
    }, {
      onSuccess: () => {
        setEditandoOrden(null);
        setUpdateData({ kilos_procesados: 0, cajas_empacadas: 0 });
      },
    });
  };

  const handleMarcarFacturado = (ordenId: string) => {
    actualizarOrden.mutate({ id: ordenId, facturado: true });
  };

  const statusBadge = (status: string | null, facturado: boolean | null) => {
    if (facturado) return <Badge className="bg-blue-600 text-white">Facturada</Badge>;
    if (status === "completada") return <Badge className="bg-emerald-600 text-white">Completada</Badge>;
    return <Badge className="bg-amber-500 text-white">En Proceso</Badge>;
  };

  // KPIs
  const ordenesActivas = ordenes.filter((o) => o.status === "en_proceso").length;
  const kilosProcesadosTotal = ordenes.reduce((s, o) => s + (o.kilos_procesados || 0), 0);
  const ingresoTotal = ordenes.reduce((s, o) => s + (o.costo_total || 0), 0);
  const pendientesFacturar = ordenes.filter((o) => o.status === "completada" && !o.facturado).length;

  return (
    <MainLayout title="Maquila" subtitle="Servicio de procesamiento para clientes externos">
      <div className="space-y-6">
        <PageHeader title="Maquila" description="Servicio de procesamiento de fruta para clientes externos" icon={Factory} />

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Órdenes Activas</p>
                  <p className="text-2xl font-bold">{ordenesActivas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Kg Procesados</p>
                  <p className="text-2xl font-bold">{kilosProcesadosTotal.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Ingreso Total</p>
                  <p className="text-2xl font-bold">${ingresoTotal.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes Facturar</p>
                  <p className="text-2xl font-bold">{pendientesFacturar}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ordenes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ordenes">
              <FileText className="h-4 w-4 mr-2" /> Órdenes
            </TabsTrigger>
            <TabsTrigger value="clientes">
              <Users className="h-4 w-4 mr-2" /> Clientes
            </TabsTrigger>
          </TabsList>

          {/* --- ÓRDENES TAB --- */}
          <TabsContent value="ordenes" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showNuevaOrden} onOpenChange={setShowNuevaOrden}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> Nueva Orden</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nueva Orden de Maquila</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Cliente</Label>
                      <Select value={nuevaOrden.cliente_maquila_id} onValueChange={(v) => setNuevaOrden((p) => ({ ...p, cliente_maquila_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                        <SelectContent>
                          {clientes.filter((c) => c.activo).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Kilos Recibidos</Label>
                      <Input type="number" value={nuevaOrden.kilos_recibidos || ""} onChange={(e) => setNuevaOrden((p) => ({ ...p, kilos_recibidos: Number(e.target.value) }))} placeholder="0" />
                    </div>
                    <Button onClick={handleCrearOrden} className="w-full" disabled={crearOrden.isPending}>
                      Crear Orden
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Kg Recibidos</TableHead>
                      <TableHead className="text-right">Kg Procesados</TableHead>
                      <TableHead className="text-right">Cajas</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                      <TableHead>Estatus</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOrdenes ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                    ) : ordenes.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay órdenes registradas</TableCell></TableRow>
                    ) : ordenes.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono font-medium">{o.folio}</TableCell>
                        <TableCell>{(o as any).clientes_maquila?.nombre || "—"}</TableCell>
                        <TableCell className="text-right">{(o.kilos_recibidos || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(o.kilos_procesados || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(o.cajas_empacadas || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">${(o.costo_total || 0).toLocaleString()}</TableCell>
                        <TableCell>{statusBadge(o.status, o.facturado)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {o.status === "en_proceso" && (
                              <>
                                {editandoOrden === o.id ? (
                                  <div className="flex gap-2 items-end">
                                    <div>
                                      <Label className="text-xs">Kg</Label>
                                      <Input type="number" className="w-20 h-8" value={updateData.kilos_procesados || ""} onChange={(e) => setUpdateData((p) => ({ ...p, kilos_procesados: Number(e.target.value) }))} />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Cajas</Label>
                                      <Input type="number" className="w-20 h-8" value={updateData.cajas_empacadas || ""} onChange={(e) => setUpdateData((p) => ({ ...p, cajas_empacadas: Number(e.target.value) }))} />
                                    </div>
                                    <Button size="sm" onClick={() => handleRegistrarProceso(o.id)}>Guardar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditandoOrden(null)}>✕</Button>
                                  </div>
                                ) : (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => { setEditandoOrden(o.id); setUpdateData({ kilos_procesados: o.kilos_procesados || 0, cajas_empacadas: o.cajas_empacadas || 0 }); }}>
                                      Registrar
                                    </Button>
                                    <Button size="sm" variant="default" onClick={() => handleFinalizarOrden(o)}>
                                      <CheckCircle className="h-3 w-3 mr-1" /> Finalizar
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                            {o.status === "completada" && !o.facturado && (
                              <Button size="sm" variant="outline" onClick={() => handleMarcarFacturado(o.id)}>
                                <DollarSign className="h-3 w-3 mr-1" /> Facturar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- CLIENTES TAB --- */}
          <TabsContent value="clientes" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showNuevoCliente} onOpenChange={setShowNuevoCliente}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Cliente</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuevo Cliente de Maquila</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nombre *</Label>
                      <Input value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente((p) => ({ ...p, nombre: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>RFC</Label>
                        <Input value={nuevoCliente.rfc} onChange={(e) => setNuevoCliente((p) => ({ ...p, rfc: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Teléfono</Label>
                        <Input value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente((p) => ({ ...p, telefono: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Contacto</Label>
                      <Input value={nuevoCliente.contacto} onChange={(e) => setNuevoCliente((p) => ({ ...p, contacto: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tarifa por Kg *</Label>
                        <Input type="number" step="0.01" value={nuevoCliente.tarifa_kg || ""} onChange={(e) => setNuevoCliente((p) => ({ ...p, tarifa_kg: Number(e.target.value) }))} placeholder="$0.00" />
                      </div>
                      <div>
                        <Label>Tarifa por Caja</Label>
                        <Input type="number" step="0.01" value={nuevoCliente.tarifa_caja || ""} onChange={(e) => setNuevoCliente((p) => ({ ...p, tarifa_caja: Number(e.target.value) }))} placeholder="$0.00" />
                      </div>
                    </div>
                    <Button onClick={handleCrearCliente} className="w-full" disabled={crearCliente.isPending}>
                      Registrar Cliente
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>RFC</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead className="text-right">Tarifa/Kg</TableHead>
                      <TableHead className="text-right">Tarifa/Caja</TableHead>
                      <TableHead>Estatus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingClientes ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                    ) : clientes.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay clientes registrados</TableCell></TableRow>
                    ) : clientes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nombre}</TableCell>
                        <TableCell>{c.rfc || "—"}</TableCell>
                        <TableCell>{c.contacto || "—"}</TableCell>
                        <TableCell>{c.telefono || "—"}</TableCell>
                        <TableCell className="text-right">${c.tarifa_kg.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${c.tarifa_caja.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={c.activo ? "default" : "secondary"}>
                            {c.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
