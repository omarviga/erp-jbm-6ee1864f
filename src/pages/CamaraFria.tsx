import { useMemo, useState } from "react";
import { differenceInDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCamaraFria } from "@/hooks/useCamaraFria";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CrearTransferenciaCDMXDialog } from "@/components/transferencias/CrearTransferenciaCDMXDialog";
import { CalibreBadge } from "@/components/ui/calibre-badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  ArrowRightLeft,
  Clock,
  Droplets,
  Loader2,
  Search,
  Snowflake,
  Thermometer,
  Truck,
  Warehouse,
} from "lucide-react";

const pasillos = ["A", "B", "C"];
const posiciones = ["01", "02", "03", "04"];

type InventarioItem = {
  id: string;
  lote_id: string;
  lote: string;
  calibre: string;
  calidad: string;
  fechaIngreso: string;
  dias: number;
  estado: 1 | 2 | 3;
  origen: string;
  productor: string;
  cajas: number;
  kgs: number;
  ubicacion: string | null;
};

const getSemaforo = (dias: number): 1 | 2 | 3 => {
  if (dias > 7) return 3;
  if (dias >= 4) return 2;
  return 1;
};

export default function CamaraFria() {
  const {
    inventario,
    pisoEmpaque,
    transporteDirecto,
    temperaturas,
    trasladoInterno,
    isTrasladandoInterno,
    registrarMerma,
    isRegistrandoMerma,
    enviarTransporteDirectoACdmx,
    isEnviandoTransporteDirecto,
    isLoading,
  } = useCamaraFria();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [tabValue, setTabValue] = useState("camara");
  const [isMermaDialogOpen, setIsMermaDialogOpen] = useState(false);
  const [mermaCantidad, setMermaCantidad] = useState("1");
  const [mermaMotivo, setMermaMotivo] = useState("");
  const [loteMermaSeleccionado, setLoteMermaSeleccionado] = useState<InventarioItem | null>(null);

  const capacidadTotal = pasillos.length * posiciones.length;

  const inventarioCamara = useMemo<InventarioItem[]>(() => {
    return [...inventario]
      .sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime())
      .map((item, index) => {
        const dias = differenceInDays(new Date(), new Date(item.fecha_ingreso));
        const pasilloIndex = Math.floor(index / posiciones.length);
        const posicionIndex = index % posiciones.length;
        const ubicacion = pasilloIndex < pasillos.length
          ? `${pasillos[pasilloIndex]}-${posiciones[posicionIndex]}`
          : null;

        return {
          id: item.id,
          lote_id: item.produccion?.lote_id || "",
          lote: item.produccion?.lotes?.numero_lote || item.id.slice(0, 8),
          calibre: item.produccion?.calibre || "S/C",
          calidad: item.produccion?.calidad || "Sin calidad",
          fechaIngreso: item.fecha_ingreso,
          dias,
          estado: getSemaforo(dias),
          origen: item.produccion?.lotes?.origen || "Sin origen capturado",
          productor: item.produccion?.lotes?.productor_id || "Sin productor",
          cajas: item.cantidad_disponible,
          kgs: (item.cantidad_disponible * (item.produccion?.peso_total_kg || 0) / (item.produccion?.cantidad_cajas || 1)) || 0,
          ubicacion,
        };
      });
  }, [inventario]);

  const pisoEmpaqueItems = useMemo(() => {
    return pisoEmpaque.map((item) => ({
      id: item.id,
      lote_id: item.lote_id,
      lote: item.lotes?.numero_lote || item.id.slice(0, 8),
      calibre: item.calibre,
      calidad: item.calidad,
      cajas: item.cantidad_cajas,
      created_at: item.created_at,
      origen: item.lotes?.origen || "Sin origen capturado",
    }));
  }, [pisoEmpaque]);

  const transporteItems = useMemo(() => {
    return transporteDirecto.map((item) => ({
      id: item.id,
      lote_id: item.lote_id,
      lote: item.lotes?.numero_lote || item.id.slice(0, 8),
      calibre: item.calibre,
      calidad: item.calidad,
      cajas: item.cantidad_cajas,
      peso_total_kg: item.peso_total_kg || 0,
      created_at: item.created_at,
      origen: item.lotes?.origen || "Sin origen capturado",
    }));
  }, [transporteDirecto]);

  const filteredCamara = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return inventarioCamara.filter((item) => {
      if (!term) return true;
      return item.lote.toLowerCase().includes(term) || item.calibre.toLowerCase().includes(term);
    });
  }, [inventarioCamara, searchTerm]);

  const ubicacionesCamara = useMemo(() => {
    const map = new Map<string, InventarioItem>();
    filteredCamara.forEach((item) => {
      if (item.ubicacion && !map.has(item.ubicacion)) map.set(item.ubicacion, item);
    });
    return map;
  }, [filteredCamara]);

  const lotesRojos = inventarioCamara.filter((i) => i.estado === 3).length;
  const ocupacion = Math.min(inventarioCamara.length, capacidadTotal);

  const statusClass = (estado: 1 | 2 | 3) => {
    switch (estado) {
      case 1:
        return "bg-emerald-100 border-emerald-200 text-emerald-800";
      case 2:
        return "bg-amber-100 border-amber-200 text-amber-800";
      case 3:
        return "bg-rose-100 border-rose-200 text-rose-800 animate-pulse";
      default:
        return "bg-slate-50 border-slate-200 text-slate-500";
    }
  };

  const onTrasladoInterno = async () => {
    if (!user?.id) {
      toast.error("No se pudo identificar al usuario actual.");
      return;
    }

    if (pisoEmpaqueItems.length === 0) {
      toast.info("No hay inventario pendiente en Piso Empaque.");
      return;
    }

    try {
      await Promise.all(
        pisoEmpaqueItems.map((item) =>
          trasladoInterno({
            produccionId: item.id,
            loteId: item.lote_id,
            cantidad: item.cajas,
            usuarioId: user.id,
          })
        )
      );

      toast.success("Traslado interno completado", {
        description: `Se trasladaron ${pisoEmpaqueItems.length} registros de Piso Empaque a Cámara Fría.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : (typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message) : "Error desconocido");
      toast.error("No se pudo completar el traslado interno", { description: message });
    }
  };

  const abrirMermaDialog = (item: InventarioItem) => {
    setLoteMermaSeleccionado(item);
    setMermaCantidad("1");
    setMermaMotivo("");
    setIsMermaDialogOpen(true);
  };

  const handleConfirmarMerma = async () => {
    if (!user?.id) {
      toast.error("No se pudo identificar al usuario actual.");
      return;
    }

    if (!loteMermaSeleccionado) {
      toast.error("Selecciona un lote para registrar la merma.");
      return;
    }

    const cantidad = Number(mermaCantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("La cantidad de merma debe ser mayor a 0.");
      return;
    }

    if (cantidad > loteMermaSeleccionado.cajas) {
      toast.error("La merma no puede ser mayor al stock disponible.");
      return;
    }

    if (!mermaMotivo.trim()) {
      toast.error("Debes capturar el motivo de la merma.");
      return;
    }

    try {
      await registrarMerma({
        idCamara: loteMermaSeleccionado.id,
        idLote: loteMermaSeleccionado.lote_id,
        cantidad,
        motivo: mermaMotivo.trim(),
        idUsuario: user.id,
      });

      toast.success("Merma registrada correctamente");
      setIsMermaDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : (typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message) : "Error desconocido");
      toast.error("No se pudo registrar la merma", { description: message });
    }
  };

  const onEnviarDirectoACdmx = async (item: { id: string; lote_id: string; lote: string; cajas: number; peso_total_kg: number }) => {
    if (!user?.id) {
      toast.error("No se pudo identificar al usuario actual.");
      return;
    }

    if (!item.lote_id) {
      toast.error("El lote no tiene referencia de origen para enviar a CDMX.");
      return;
    }

    const referenciaViaje = `Directo a transporte · Lote ${item.lote}`;
    const precioBaseCongelado = item.cajas > 0 ? Math.round((item.peso_total_kg / item.cajas) * item.cajas * 100) / 100 : 0;

    try {
      await enviarTransporteDirectoACdmx({
        produccionId: item.id,
        loteId: item.lote_id,
        cantidad: item.cajas,
        precioBaseCongelado,
        referenciaViaje,
        usuarioId: user.id,
      });

      toast.success("Lote enviado a CDMX", {
        description: `${item.lote} se vinculó correctamente a una transferencia en tránsito.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : (typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message) : "Error desconocido");
      toast.error("No se pudo enviar el lote a CDMX", { description: message });
    }
  };

  return (
    <>
      <MainLayout title="Inventarios" subtitle="Cámara Fría, Piso Empaque y Directo a Transporte">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-bold uppercase">Temperatura Actual</p>
              <div className="text-2xl font-mono font-bold text-blue-900 flex items-center gap-1">
                {temperaturas[0]?.temperatura?.toFixed(1) || "4.2"} <span className="text-sm">°C</span>
              </div>
            </div>
            <Thermometer className="h-5 w-5 text-blue-600" />
          </CardContent>
        </Card>

        <Card className="bg-cyan-50/50 border-cyan-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-cyan-600 font-bold uppercase">Humedad Relativa</p>
              <div className="text-2xl font-mono font-bold text-cyan-900 flex items-center gap-1">
                88 <span className="text-sm">%</span>
              </div>
            </div>
            <Droplets className="h-5 w-5 text-cyan-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground font-bold">Capacidad Cámara Fría</p>
            <p className="text-xl font-bold mt-1">{ocupacion} / {capacidadTotal}</p>
            <p className="text-xs text-muted-foreground">{Math.round((ocupacion / capacidadTotal) * 100)}% ocupación</p>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4", lotesRojos > 0 ? "border-l-rose-500" : "border-l-emerald-500")}>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground font-bold">Semáforo FIFO</p>
            <p className={cn("text-lg font-bold", lotesRojos > 0 ? "text-rose-700" : "text-emerald-700")}>
              {lotesRojos > 0 ? `${lotesRojos} lotes en rojo` : "Rotación saludable"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tabValue} onValueChange={setTabValue}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="camara">❄️ Cámara Fría</TabsTrigger>
          <TabsTrigger value="piso">🏭 Piso Empaque</TabsTrigger>
          <TabsTrigger value="transporte">🚚 Directo a Transporte</TabsTrigger>
        </TabsList>

        <TabsContent value="camara" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Snowflake className="h-4 w-4 text-blue-500" />
                    Cuadrícula FIFO (Cámara Fría)
                  </CardTitle>
                  <CardDescription>
                    Orden automático por primera entrada/primera salida. Si hay lotes viejos de la misma calidad, deben salir primero.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 bg-slate-50/50">
                  <div className="space-y-8">
                    {pasillos.map((letraPasillo) => (
                      <div key={letraPasillo} className="grid grid-cols-4 gap-4">
                        {posiciones.map((numPos) => {
                          const codigo = `${letraPasillo}-${numPos}`;
                          const lote = ubicacionesCamara.get(codigo);
                          return (
                            <div key={codigo} className={cn("rounded-lg border-2 p-3 min-h-28", lote ? statusClass(lote.estado) : "border-dashed border-slate-200 bg-white/60")}>
                              <p className="text-[10px] opacity-60 mb-2">{codigo}</p>
                              {lote ? (
                                <>
                                  <CalibreBadge calibre={lote.calibre} size="sm" />
                                  <p className="text-xs mt-1">{lote.calidad}</p>
                                  <p className="text-xs font-semibold mt-1">{lote.lote}</p>
                                  <p className="text-[11px]">{lote.dias} días en frío</p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400">Vacío</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Acciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label className="text-xs uppercase text-muted-foreground">Buscar lote</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" placeholder="Lote o calibre" />
                  </div>

                  <CrearTransferenciaCDMXDialog
                    trigger={
                      <Button className="w-full justify-start" variant="outline">
                        <Truck className="mr-2 h-4 w-4" /> Envío a CDMX
                      </Button>
                    }
                  />

                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => {
                      if (filteredCamara.length === 0) {
                        toast.info("No hay lotes disponibles en Cámara Fría para mermar.");
                        return;
                      }
                      abrirMermaDialog(filteredCamara[0]);
                    }}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" /> Dar de baja por merma
                  </Button>

                  <Button className="w-full justify-start" variant="outline">
                    <ArrowRightLeft className="mr-2 h-4 w-4" /> Reubicar tarima
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-rose-600 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Prioridad de salida
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[...filteredCamara].sort((a, b) => b.dias - a.dias).slice(0, 5).map((item) => (
                    <div key={item.id} className="border rounded-md p-2 text-xs">
                      <p className="font-semibold">{item.lote}</p>
                      <p>{item.dias} días • {item.cajas} cajas</p>
                      <p className="text-muted-foreground">Origen: {item.origen}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="piso" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Warehouse className="h-4 w-4" /> Inventario temporal en Piso Empaque</CardTitle>
              <CardDescription>
                Fruta ya empacada que aún no entra a frío. Puede salir a venta local sin simulaciones de entrada/salida.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button onClick={onTrasladoInterno} disabled={isTrasladandoInterno || pisoEmpaqueItems.length === 0}>
                  {isTrasladandoInterno ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                  Traslado interno a Cámara Fría
                </Button>
              </div>
              <div className="space-y-2">
                {pisoEmpaqueItems.slice(0, 25).map((item) => (
                  <div key={item.id} className="border rounded-md p-3 text-sm flex justify-between">
                    <div>
                      <p className="font-semibold">{item.lote}</p>
                      <p className="text-xs text-muted-foreground">{item.calidad} · Origen: {item.origen}</p>
                    </div>
                    <div className="text-right">
                      <CalibreBadge calibre={item.calibre} size="sm" />
                      <p className="text-xs mt-1">{item.cajas} cajas</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(item.created_at), "dd MMM HH:mm", { locale: es })}</p>
                    </div>
                  </div>
                ))}
                {pisoEmpaqueItems.length === 0 && <p className="text-sm text-muted-foreground">Sin inventario pendiente en Piso Empaque.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transporte" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cross-Docking: Directo a Transporte</CardTitle>
              <CardDescription>
                Flujo urgente: registra existencia para cuadrar producción y vincular rápido a Carta Porte/Transferencia CDMX.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <CrearTransferenciaCDMXDialog
                  trigger={
                    <Button>
                      <Truck className="mr-2 h-4 w-4" /> Vincular envío a CDMX
                    </Button>
                  }
                />
              </div>
              <div className="space-y-2">
                {transporteItems.slice(0, 25).map((item) => (
                  <div key={item.id} className="border rounded-md p-3 text-sm flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{item.lote}</p>
                      <p className="text-xs text-muted-foreground">{item.calidad} · Origen: {item.origen}</p>
                    </div>
                    <div className="text-right space-y-2">
                      <Badge variant="secondary">{item.cajas} cajas</Badge>
                      <p className="text-xs text-muted-foreground">{format(new Date(item.created_at), "dd MMM HH:mm", { locale: es })}</p>
                      <Button
                        size="sm"
                        onClick={() => onEnviarDirectoACdmx(item)}
                        disabled={isEnviandoTransporteDirecto}
                      >
                        {isEnviandoTransporteDirecto ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Truck className="mr-2 h-3 w-3" />}
                        Enviar a CDMX
                      </Button>
                    </div>
                  </div>
                ))}
                {transporteItems.length === 0 && <p className="text-sm text-muted-foreground">Sin lotes en flujo de cross-docking.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Actualizando inventarios...
        </div>
      )}

      <Card className="mt-6 border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Reglas de trazabilidad y kardex (operación obligatoria)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Cada caja mantiene origen de lote/recepción para trazabilidad de calidad.</p>
          <p>• No se editan números manualmente: toda variación se registra como movimiento de inventario.</p>
          <p>• Salidas por venta, traslado CDMX y mermas deben dejar responsable y motivo.</p>
        </CardContent>
      </Card>
    </MainLayout>

      <Dialog open={isMermaDialogOpen} onOpenChange={setIsMermaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar baja por merma</DialogTitle>
            <DialogDescription>
              Descuenta inventario de Cámara Fría con trazabilidad de lote, usuario y motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Lote en Cámara Fría</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={loteMermaSeleccionado?.id || ""}
                onChange={(e) => {
                  const selected = filteredCamara.find((item) => item.id === e.target.value) || null;
                  setLoteMermaSeleccionado(selected);
                }}
              >
                {filteredCamara.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.lote} · {item.cajas} cajas · {item.dias} días
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merma-cantidad">Cantidad de cajas a mermar</Label>
              <Input
                id="merma-cantidad"
                type="number"
                min={1}
                max={loteMermaSeleccionado?.cajas || 1}
                value={mermaCantidad}
                onChange={(e) => setMermaCantidad(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="merma-motivo">Motivo</Label>
              <Textarea
                id="merma-motivo"
                placeholder="Ej. Cajas aplastadas en estiba"
                value={mermaMotivo}
                onChange={(e) => setMermaMotivo(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMermaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarMerma} disabled={isRegistrandoMerma}>
              {isRegistrandoMerma ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              Confirmar merma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
