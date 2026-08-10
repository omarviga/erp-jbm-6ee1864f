import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Boxes, Loader2, EyeOff, Scissors, AlertTriangle } from "lucide-react";
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
import { normalizarNombreMostrador } from "@/lib/presentacionNombre";

const UMBRAL_GRANEL_BAJO_KG = 10;

interface InventarioItem {
  id: string;
  presentacion_id: string;
  cantidad_disponible: number;
  precio_base?: number;
  precio_venta: number;
  fecha_ingreso: string;
  presentacion: {
    nombre: string;
    tipo: string;
    peso_kg: number;
  } | null;
}

interface InventarioGrupo {
  id: string;
  nombre: string;
  tipo: string;
  peso_kg: number;
  total_disponible: number;
  lotes: InventarioItem[];
}

interface SeccionInventario {
  id: "cajas" | "arpillas" | "granel";
  titulo: string;
  descripcion: string;
  grupos: InventarioGrupo[];
}

interface ConversionGranelAuditItem {
  cantidad: number;
  created_at: string;
  motivo: string | null;
  inventario: {
    presentacion: {
      nombre: string;
      tipo: string;
    } | null;
  } | null;
}

const esGranel = (tipo: string, nombre: string) =>
  tipo.toLowerCase().includes("granel") || nombre.toLowerCase().includes("granel");

const obtenerSeccionInventario = (grupo: InventarioGrupo): SeccionInventario["id"] => {
  if (esGranel(grupo.tipo, grupo.nombre)) return "granel";
  if (grupo.tipo.toLowerCase().includes("arpilla")) return "arpillas";
  return "cajas";
};

const esConvertibleAGranel = (grupo: InventarioGrupo) =>
  !esGranel(grupo.tipo, grupo.nombre)
  && !grupo.tipo.toLowerCase().includes("arpilla")
  && grupo.peso_kg > 0
  && grupo.total_disponible >= 1;

const formatearCantidad = (cantidad: number, esProductoGranel: boolean) =>
  esProductoGranel
    ? `${cantidad.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`
    : `${cantidad.toLocaleString("es-MX", { maximumFractionDigits: 0 })} cajas`;

export default function InventarioTab() {
  const { isAdmin } = useAuth();
  const [dialogoGranelAbierto, setDialogoGranelAbierto] = useState(false);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<InventarioGrupo | null>(null);
  const [cajasAGranel, setCajasAGranel] = useState("1");
  const [precioVentaKg, setPrecioVentaKg] = useState("");
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [dialogoMermaAbierto, setDialogoMermaAbierto] = useState(false);
  const [grupoMermaSeleccionado, setGrupoMermaSeleccionado] = useState<InventarioGrupo | null>(null);
  const [kilosMerma, setKilosMerma] = useState("1");
  const [motivoMerma, setMotivoMerma] = useState("");
  const [registrandoMerma, setRegistrandoMerma] = useState(false);

  const { data: inventario, isLoading, refetch } = useQuery({
    queryKey: ["inventario-cdmx", isAdmin ? "admin" : "operativo"],
    queryFn: async () => {
      const selectFields = isAdmin
        ? `
          id,
          presentacion_id,
          cantidad_disponible,
          precio_base,
          precio_venta,
          fecha_ingreso,
          presentacion:presentaciones(nombre, tipo, peso_kg)
        `
        : `
          id,
          presentacion_id,
          cantidad_disponible,
          precio_venta,
          fecha_ingreso,
          presentacion:presentaciones(nombre, tipo, peso_kg)
        `;

      const { data, error } = await supabase
        .from("inventario_bodega_cdmx")
        .select(selectFields)
        .gt("cantidad_disponible", 0)
        .order("fecha_ingreso", { ascending: false });

      if (error) throw error;
      return data as unknown as InventarioItem[];
    },
  });

  const { data: conversionesHoy = [] } = useQuery({
    queryKey: ["inventario-cdmx-conversiones-hoy"],
    queryFn: async () => {
      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("auditoria_inventario_cdmx")
        .select(`
          cantidad,
          created_at,
          motivo,
          inventario:inventario_bodega_cdmx (
            presentacion:presentaciones (
              nombre,
              tipo
            )
          )
        `)
        .gte("created_at", inicioHoy.toISOString())
        .in("tipo_movimiento", ["entrada", "ajuste"]);

      if (error) throw error;
      return (data || []) as unknown as ConversionGranelAuditItem[];
    },
  });

  const inventarioAgrupado = useMemo(() => {
    return inventario?.reduce((acc, item) => {
      const key = item.presentacion_id;
      if (!acc[key]) {
        acc[key] = {
          id: item.presentacion_id,
          nombre: normalizarNombreMostrador(item.presentacion?.nombre || "Sin nombre"),
          tipo: item.presentacion?.tipo || "",
          peso_kg: item.presentacion?.peso_kg || 0,
          total_disponible: 0,
          lotes: [] as InventarioItem[],
        };
      }
      acc[key].total_disponible += item.cantidad_disponible;
      acc[key].lotes.push(item);
      return acc;
    }, {} as Record<string, InventarioGrupo>);
  }, [inventario]);

  const gruposInventario = useMemo(
    () => Object.values(inventarioAgrupado || {}).sort((a, b) => b.total_disponible - a.total_disponible),
    [inventarioAgrupado],
  );

  const seccionesInventario = useMemo<SeccionInventario[]>(() => {
    const seccionesBase: SeccionInventario[] = [
      {
        id: "cajas",
        titulo: "Cajas",
        descripcion: "Producto empacado disponible para venta o apertura a granel.",
        grupos: [],
      },
      {
        id: "arpillas",
        titulo: "Arpillas",
        descripcion: "Producto recibido en arpilla. Se vende como presentación completa.",
        grupos: [],
      },
      {
        id: "granel",
        titulo: "Granel Mostrador",
        descripcion: "Kilos ya abiertos para venta fraccionada en el POS.",
        grupos: [],
      },
    ];

    for (const grupo of gruposInventario) {
      const seccionId = obtenerSeccionInventario(grupo);
      const seccion = seccionesBase.find((item) => item.id === seccionId);
      if (seccion) {
        seccion.grupos.push(grupo);
      }
    }

    return seccionesBase.filter((seccion) => seccion.grupos.length > 0);
  }, [gruposInventario]);

  const totalEmpaques = inventario?.reduce((sum, item) => {
    const nombre = item.presentacion?.nombre || "";
    const tipo = item.presentacion?.tipo || "";
    return esGranel(tipo, nombre) ? sum : sum + item.cantidad_disponible;
  }, 0) || 0;

  const totalGranelKg = inventario?.reduce((sum, item) => {
    const nombre = item.presentacion?.nombre || "";
    const tipo = item.presentacion?.tipo || "";
    return esGranel(tipo, nombre) ? sum + item.cantidad_disponible : sum;
  }, 0) || 0;

  const totalKilos = inventario?.reduce((sum, item) => sum + (item.cantidad_disponible * (item.presentacion?.peso_kg || 0)), 0) || 0;
  const sinGranelDisponible = totalGranelKg <= 0;
  const granelBajo = totalGranelKg > 0 && totalGranelKg < UMBRAL_GRANEL_BAJO_KG;

  const resumenConversionesHoy = useMemo(() => {
    return conversionesHoy.reduce((acc, item) => {
      const motivo = (item.motivo || "").toLowerCase();
      const presentacion = item.inventario?.presentacion;
      const nombre = presentacion?.nombre || "";
      const tipo = presentacion?.tipo || "";

      if (motivo.includes("apertura de cajas para venta a granel")) {
        acc.cajasAbiertas += Number(item.cantidad || 0);
      }

      if (
        motivo.includes("conversión a granel")
        || motivo.includes("conversion a granel")
        || esGranel(tipo, nombre)
      ) {
        acc.kilosGenerados += Number(item.cantidad || 0);
      }

      if (motivo.includes("merma granel:")) {
        acc.kilosMermados += Number(item.cantidad || 0);
      }

      return acc;
    }, {
      cajasAbiertas: 0,
      kilosGenerados: 0,
      kilosMermados: 0,
    });
  }, [conversionesHoy]);

  const abrirDialogoGranel = (grupo: InventarioGrupo) => {
    const avgPrecioVenta = grupo.total_disponible > 0
      ? grupo.lotes.reduce((sum, lote) => sum + (lote.precio_venta * lote.cantidad_disponible), 0) / grupo.total_disponible
      : 0;
    const sugeridoKg = grupo.peso_kg > 0 ? avgPrecioVenta / grupo.peso_kg : 0;

    setGrupoSeleccionado(grupo);
    setCajasAGranel("1");
    setPrecioVentaKg(sugeridoKg > 0 ? sugeridoKg.toFixed(2) : "");
    setDialogoGranelAbierto(true);
  };

  const cerrarDialogoGranel = () => {
    if (convirtiendo) return;
    setDialogoGranelAbierto(false);
    setGrupoSeleccionado(null);
    setCajasAGranel("1");
    setPrecioVentaKg("");
  };

  const abrirDialogoMerma = (grupo: InventarioGrupo) => {
    setGrupoMermaSeleccionado(grupo);
    setKilosMerma("1");
    setMotivoMerma("");
    setDialogoMermaAbierto(true);
  };

  const cerrarDialogoMerma = () => {
    if (registrandoMerma) return;
    setDialogoMermaAbierto(false);
    setGrupoMermaSeleccionado(null);
    setKilosMerma("1");
    setMotivoMerma("");
  };

  const convertirAGranel = async () => {
    if (!grupoSeleccionado) return;

    const cajas = Number(cajasAGranel);
    const precioKg = Number(precioVentaKg);

    if (!Number.isInteger(cajas) || cajas <= 0) {
      toast.error("Captura una cantidad válida de cajas");
      return;
    }

    if (cajas > grupoSeleccionado.total_disponible) {
      toast.error("No hay suficientes cajas disponibles para abrir");
      return;
    }

    if (!Number.isFinite(precioKg) || precioKg <= 0) {
      toast.error("Captura un precio por kilo válido");
      return;
    }

    setConvirtiendo(true);
    try {
      const { data, error } = await supabase.rpc("convertir_presentacion_a_granel_cdmx", {
        p_presentacion_id: grupoSeleccionado.id,
        p_cajas: cajas,
        p_precio_venta_kg: precioKg,
      });

      if (error) throw error;

      const resultado = Array.isArray(data) ? data[0] : null;
      if (!resultado?.success) {
        throw new Error(resultado?.mensaje || "No se pudo convertir el producto a granel");
      }

      toast.success("Conversión a granel realizada", {
        description: String(resultado.mensaje || "La caja fue abierta correctamente."),
      });

      cerrarDialogoGranel();
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la conversión.";
      toast.error("Error al abrir cajas a granel", {
        description: message,
      });
    } finally {
      setConvirtiendo(false);
    }
  };

  const registrarMermaGranel = async () => {
    if (!grupoMermaSeleccionado) return;

    const kilos = Number(kilosMerma);
    if (!Number.isFinite(kilos) || kilos <= 0) {
      toast.error("Captura una cantidad válida de kilos");
      return;
    }

    if (kilos > grupoMermaSeleccionado.total_disponible) {
      toast.error("La merma no puede ser mayor al inventario disponible");
      return;
    }

    if (!motivoMerma.trim()) {
      toast.error("Debes capturar el motivo de la merma");
      return;
    }

    setRegistrandoMerma(true);
    try {
      const { data, error } = await supabase.rpc("registrar_merma_granel_cdmx", {
        p_presentacion_id: grupoMermaSeleccionado.id,
        p_kilos: kilos,
        p_motivo: motivoMerma.trim(),
      });

      if (error) throw error;

      const resultado = Array.isArray(data) ? data[0] : null;
      if (!resultado?.success) {
        throw new Error(resultado?.mensaje || "No se pudo registrar la merma");
      }

      toast.success("Merma registrada", {
        description: String(resultado.mensaje || "La merma de granel quedó guardada."),
      });

      cerrarDialogoMerma();
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la merma.";
      toast.error("Error al registrar merma", {
        description: message,
      });
    } finally {
      setRegistrandoMerma(false);
    }
  };

  const kilosConvertidos = grupoSeleccionado
    ? Number(cajasAGranel || 0) * grupoSeleccionado.peso_kg
    : 0;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Inventario Local</h1>
        <p className="text-sm text-muted-foreground">Stock físico en Bodega CDMX y apertura de cajas para granel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Empaques</p>
                <p className="text-3xl font-black text-[#1E5128]">{totalEmpaques.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</p>
              </div>
              <Boxes className="h-8 w-8 text-[#1E5128]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Granel</p>
                <p className="text-3xl font-black text-sky-600">{totalGranelKg.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg</p>
              </div>
              <Scissors className="h-8 w-8 text-sky-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Total Kilos</p>
                <p className="text-3xl font-black text-blue-600">{totalKilos.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Productos</p>
                <p className="text-3xl font-black text-purple-600">{Object.keys(inventarioAgrupado || {}).length}</p>
              </div>
              <Package className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Cajas Abiertas Hoy</p>
                <p className="text-3xl font-black text-amber-600">
                  {resumenConversionesHoy.cajasAbiertas.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-muted-foreground">Cajas convertidas a granel durante el día</p>
              </div>
              <Boxes className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Kg Generados Hoy</p>
                <p className="text-3xl font-black text-sky-600">
                  {resumenConversionesHoy.kilosGenerados.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg
                </p>
                <p className="text-sm text-muted-foreground">Inventario nuevo disponible para mostrador</p>
              </div>
              <Scissors className="h-8 w-8 text-sky-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Merma Granel Hoy</p>
                <p className="text-3xl font-black text-rose-600">
                  {resumenConversionesHoy.kilosMermados.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg
                </p>
                <p className="text-sm text-muted-foreground">Kilos ajustados por merma o diferencia operativa</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-rose-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`rounded-lg border p-4 mb-6 ${
        sinGranelDisponible
          ? "border-rose-200 bg-rose-50"
          : granelBajo
          ? "border-amber-200 bg-amber-50"
          : "border-sky-200 bg-sky-50"
      }`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-5 w-5 mt-0.5 ${
            sinGranelDisponible ? "text-rose-600" : granelBajo ? "text-amber-600" : "text-sky-600"
          }`} />
          <div>
            <p className={`text-sm font-bold ${
              sinGranelDisponible ? "text-rose-800" : granelBajo ? "text-amber-800" : "text-sky-800"
            }`}>
              Granel disponible actual: {totalGranelKg.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg
            </p>
            <p className={`text-sm ${
              sinGranelDisponible ? "text-rose-700" : granelBajo ? "text-amber-700" : "text-sky-700"
            }`}>
              {sinGranelDisponible
                ? "Sin granel disponible. Hay que abrir cajas para mostrador."
                : granelBajo
                ? "Stock bajo de granel. Conviene abrir mas cajas para mostrador."
                : "Nivel de granel suficiente para mostrador en este momento."}
            </p>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-amber-600" />
          <p className="text-sm text-amber-700">
            Los precios base (costo) están ocultos. Solo el administrador puede verlos.
          </p>
        </div>
      )}

      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock y Conversión a Granel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gruposInventario.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos en inventario</p>
            </div>
          ) : (
            <div className="space-y-6">
              {seccionesInventario.map((seccion) => (
                <div key={seccion.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{seccion.titulo}</h3>
                      <p className="text-sm text-muted-foreground">{seccion.descripcion}</p>
                    </div>
                    <Badge variant="outline">{seccion.grupos.length} productos</Badge>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Disponible</TableHead>
                        <TableHead className="text-center">Peso Total</TableHead>
                        {isAdmin && <TableHead className="text-right">Precio Base (Costo)</TableHead>}
                        <TableHead className="text-right">Precio Venta</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seccion.grupos.map((grupo) => {
                        const productoEsGranel = esGranel(grupo.tipo, grupo.nombre);
                        const totalDisponible = grupo.total_disponible || 1;
                        const avgPrecioBase = grupo.lotes.reduce(
                          (sum, lote) => sum + ((lote.precio_base || 0) * lote.cantidad_disponible),
                          0,
                        ) / totalDisponible;
                        const avgPrecioVenta = grupo.lotes.reduce(
                          (sum, lote) => sum + (lote.precio_venta * lote.cantidad_disponible),
                          0,
                        ) / totalDisponible;

                        return (
                          <TableRow key={grupo.id}>
                            <TableCell className="font-semibold">
                              {grupo.nombre}
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                {grupo.lotes.length} lotes
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{grupo.tipo}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-lg font-bold text-[#1E5128]">
                                {formatearCantidad(grupo.total_disponible, productoEsGranel)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {(grupo.total_disponible * grupo.peso_kg).toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right font-mono text-muted-foreground">
                                ${avgPrecioBase.toFixed(2)}
                              </TableCell>
                            )}
                            <TableCell className="text-right font-mono font-bold">
                              ${avgPrecioVenta.toFixed(2)}
                              {productoEsGranel && <span className="ml-1 text-xs font-normal text-muted-foreground">/kg</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {esConvertibleAGranel(grupo) ? (
                                <Button variant="outline" size="sm" onClick={() => abrirDialogoGranel(grupo)}>
                                  Abrir a granel
                                </Button>
                              ) : productoEsGranel ? (
                                <Button variant="outline" size="sm" onClick={() => abrirDialogoMerma(grupo)}>
                                  Registrar merma
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {productoEsGranel ? "Listo para POS" : "Sin conversión"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogoGranelAbierto} onOpenChange={(open) => !open && cerrarDialogoGranel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir cajas para venta a granel</DialogTitle>
            <DialogDescription>
              Convierte cajas del inventario local a kilos disponibles para el POS de mostrador.
            </DialogDescription>
          </DialogHeader>

          {grupoSeleccionado && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">{grupoSeleccionado.nombre}</p>
                <p className="text-muted-foreground">
                  Disponible: {formatearCantidad(grupoSeleccionado.total_disponible, false)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cajas a abrir</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={cajasAGranel}
                  onChange={(event) => setCajasAGranel(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Precio de venta por kilo</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precioVentaKg}
                  onChange={(event) => setPrecioVentaKg(event.target.value)}
                />
              </div>

              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                Se generarán {Number.isFinite(kilosConvertidos) ? kilosConvertidos.toLocaleString("es-MX", { maximumFractionDigits: 2 }) : "0"} kg de inventario granel.
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cerrarDialogoGranel} disabled={convirtiendo}>
                  Cancelar
                </Button>
                <Button onClick={convertirAGranel} disabled={convirtiendo}>
                  {convirtiendo ? "Convirtiendo..." : "Confirmar conversión"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoMermaAbierto} onOpenChange={(open) => !open && cerrarDialogoMerma()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar merma de granel</DialogTitle>
            <DialogDescription>
              Usa este ajuste para descontar kilos de granel por diferencia física, daño o merma operativa.
            </DialogDescription>
          </DialogHeader>

          {grupoMermaSeleccionado && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">{grupoMermaSeleccionado.nombre}</p>
                <p className="text-muted-foreground">
                  Disponible: {formatearCantidad(grupoMermaSeleccionado.total_disponible, true)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Kilos a mermar</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={kilosMerma}
                  onChange={(event) => setKilosMerma(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo</label>
                <Input
                  value={motivoMerma}
                  onChange={(event) => setMotivoMerma(event.target.value)}
                  placeholder="Ej. merma por selección, daño, diferencia física"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cerrarDialogoMerma} disabled={registrandoMerma}>
                  Cancelar
                </Button>
                <Button onClick={registrarMermaGranel} disabled={registrandoMerma}>
                  {registrandoMerma ? "Guardando..." : "Confirmar merma"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
