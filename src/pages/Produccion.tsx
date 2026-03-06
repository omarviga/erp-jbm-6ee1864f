import { useState, useMemo, useId, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { EtiquetaCaja } from "@/components/produccion/EtiquetaCaja";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Package, Factory,
  AlertTriangle, Info, CheckCircle, Printer, Scale, AlertCircle, Search, Filter, Plus, Bell, TrendingUp, Download
} from "lucide-react";

// --- TIPOS ---
interface LoteDisponible {
  id: string;
  numero_lote: string;
  peso_neto: number;
  kilos_merma: number;
  peso_pagable: number;
  productores?: { nombre: string };
  huertos?: { nombre: string };
  estado: string;
  kilos_disponibles?: number;
  kilos_procesados?: number;
}

interface Presentacion {
  id: string;
  nombre: string;
  peso_kg: number;
}

interface Clasificacion {
  id: string;
  nombre_producto: string;
  calibre: string;
  codigo_interno: string;
  nombre_completo?: string;
  orden_visual: number;
  created_at?: string;
}

interface RegistroProduccion {
  calibre: string;
  color: string;
  qty: number;
}

interface KPIData {
  eficiencia: number;
  merma: number;
  produccion_hoy: number;
}

// --- CONSTANTES ---
const colores = [
  { value: "verde", label: "Verde", color: "bg-green-500" },
  { value: "alimonado", label: "Alimonado", color: "bg-lime-400" },
  { value: "amarillo", label: "Amarillo", color: "bg-yellow-400" },
];

interface EtiquetaData {
  numeroLote: string;
  calibre: string;
  color: string;
  presentacion: string;
  pesoKg: number;
  fecha: Date;
  productor?: string;
}

export default function Produccion() {
  const queryClient = useQueryClient();

  // Generar IDs únicos para accesibilidad
  const idLote = useId();
  const idCalibre = useId();
  const idColor = useId();
  const idPresentacion = useId();
  const idCantidad = useId();
  const idPesoBascula = useId();

  // --- ESTADOS ---
  const [loteId, setLoteId] = useState("");
  const [calibre, setCalibre] = useState("");
  const [color, setColor] = useState("");
  const [presentacionId, setPresentacionId] = useState("");
  const [cantidadCajas, setCantidadCajas] = useState("");
  const [pesoIndustria, setPesoIndustria] = useState("");
  const [busquedaLote, setBusquedaLote] = useState("");

  // Cargar lotes activos
  const { data: lotesDisponibles = [], isLoading: loadingLotes } = useQuery({
    queryKey: ['lotes-activos'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('lotes')
          .select(`
            *,
            productores (nombre),
            huertos (nombre)
          `)
          .in('estado', ['pendiente', 'en_proceso'])
          .order('fecha_recepcion', { ascending: false });

        if (error) throw error;

        return data || [];
      } catch (err) {
        console.error('Error cargando lotes:', err);
        return [];
      }
    }
  });

  // Cargar producción para calcular kilos procesados
  const { data: produccionPorLote = {} } = useQuery({
    queryKey: ['produccion-por-lote'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('produccion')
          .select('lote_id, peso_total_kg')
          .not('lote_id', 'is', null);

        if (error) throw error;

        // Agrupar por lote_id
        const agrupado: Record<string, number> = {};
        data?.forEach(item => {
          if (item.lote_id) {
            if (!agrupado[item.lote_id]) {
              agrupado[item.lote_id] = 0;
            }
            agrupado[item.lote_id] += item.peso_total_kg || 0;
          }
        });

        return agrupado;
      } catch (err) {
        console.error('Error cargando producción:', err);
        return {};
      }
    }
  });

  const { data: presentaciones = [], isLoading: loadingPresentaciones } = useQuery({
    queryKey: ['presentaciones'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('presentaciones')
          .select('*')
          .order('nombre');

        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error cargando presentaciones:', err);
        return [];
      }
    }
  });

  // Clasificaciones estáticas (calibres de limón)
  const clasificacionesDB: Clasificacion[] = useMemo(() => [
    { id: '1', nombre_producto: 'Limón', calibre: 'SUPER', codigo_interno: 'SUPER', orden_visual: 1 },
    { id: '2', nombre_producto: 'Limón', calibre: 'EXTRA', codigo_interno: 'EXTRA', orden_visual: 2 },
    { id: '3', nombre_producto: 'Limón', calibre: 'XXX', codigo_interno: 'XXX', orden_visual: 3 },
    { id: '4', nombre_producto: 'Limón', calibre: 'XX', codigo_interno: 'XX', orden_visual: 4 },
    { id: '5', nombre_producto: 'Limón', calibre: 'X', codigo_interno: 'X', orden_visual: 5 },
    { id: '6', nombre_producto: 'Limón', calibre: '4', codigo_interno: '4', orden_visual: 6 },
  ], []);

  // Cargar KPI data
  const { data: kpiData = { eficiencia: 87.5, merma: 3.2, produccion_hoy: 0 } } = useQuery<KPIData>({
    queryKey: ['kpi-data'],
    queryFn: async () => {
      try {
        // Aquí puedes hacer una consulta real a Supabase
        // Por ahora retornamos datos estáticos
        return {
          eficiencia: 87.5,
          merma: 3.2,
          produccion_hoy: 1250
        };
      } catch (err) {
        console.error('Error cargando KPI:', err);
        return {
          eficiencia: 0,
          merma: 0,
          produccion_hoy: 0
        };
      }
    }
  });

  // --- DERIVADOS Y CÁLCULOS ---
  const lotesProduccionDisponibles = useMemo(() => {
    return lotesDisponibles.filter((l: LoteDisponible) => {
      const kilosProd = produccionPorLote[l.id] || 0;
      const kilosDisp = Math.max(0, (l.peso_pagable || 0) - kilosProd);
      return kilosDisp > 0;
    });
  }, [lotesDisponibles, produccionPorLote]);

  const lotesFiltrados = useMemo(() => {
    const term = busquedaLote.trim().toLowerCase();
    if (!term) return lotesProduccionDisponibles;

    return lotesProduccionDisponibles.filter((l: LoteDisponible) =>
      l.numero_lote?.toLowerCase().includes(term) ||
      l.productores?.nombre?.toLowerCase().includes(term) ||
      l.huertos?.nombre?.toLowerCase().includes(term)
    );
  }, [lotesProduccionDisponibles, busquedaLote]);

  const loteSeleccionado = lotesProduccionDisponibles.find((l: LoteDisponible) => l.id === loteId);
  const presentacionSeleccionada = presentaciones.find((p: Presentacion) => p.id === presentacionId);

  // Calcular kilos procesados del lote seleccionado
  const kilosProcesados = useMemo(() => {
    if (!loteId) return 0;
    return produccionPorLote[loteId] || 0;
  }, [loteId, produccionPorLote]);

  useEffect(() => {
    if (!loteId) return;
    const sigueDisponible = lotesProduccionDisponibles.some((l) => l.id === loteId);
    if (!sigueDisponible) {
      setLoteId("");
    }
  }, [loteId, lotesProduccionDisponibles]);

  // Calcular kilos disponibles (peso_pagable - kilos procesados - kilos merma)
  const kilosDisponibles = useMemo(() => {
    if (!loteSeleccionado) return 0;

    const pesoPagable = loteSeleccionado.peso_pagable || 0;
    // Inconsistencia corregida: peso_pagable ya considera mermas de recepción
    return Math.max(0, pesoPagable - kilosProcesados);
  }, [loteSeleccionado, kilosProcesados]);

  // Calcular porcentaje utilizado
  const porcentajeUtilizado = useMemo(() => {
    if (!loteSeleccionado || !loteSeleccionado.peso_pagable || loteSeleccionado.peso_pagable <= 0) {
      return 0;
    }
    return (kilosProcesados / loteSeleccionado.peso_pagable) * 100;
  }, [loteSeleccionado, kilosProcesados]);

  // Lógica automática de clasificación
  const getDestinoAutomatico = (colorValue: string) => {
    if (colorValue === "amarillo") {
      return { destino: "molino", calidad: "industria", mensaje: "🏭 Enviado a Molino (Industria)", tipo: 'warning' };
    }
    if (colorValue === "alimonado") {
      return { destino: "piso_empaque", calidad: "segunda", mensaje: "⚠️ Calidad Segunda (Mercado Nacional)", tipo: 'info' };
    }
    return { destino: "piso_empaque", calidad: "primera", mensaje: "✅ Calidad Primera (Exportación/Premium)", tipo: 'success' };
  };

  const destinoInfo = color ? getDestinoAutomatico(color) : null;
  const esIndustria = destinoInfo?.destino === "molino";

  // Calcular kilos solicitados para empaque normal
  const kilosSolicitados = useMemo(() => {
    if (esIndustria) {
      return parseFloat(pesoIndustria) || 0;
    }
    if (presentacionSeleccionada && cantidadCajas) {
      return presentacionSeleccionada.peso_kg * parseInt(cantidadCajas);
    }
    return 0;
  }, [presentacionSeleccionada, cantidadCajas, pesoIndustria, esIndustria]);

  // Validar si sobrepasa los kilos disponibles
  const sobrepasaKilosDisponibles = kilosSolicitados > kilosDisponibles;
  const tieneKilosSuficientes = kilosDisponibles > 0 && !sobrepasaKilosDisponibles;
  const diferenciaKilos = kilosSolicitados - kilosDisponibles;

  // Filtrar calibres para limón
  const calibresLimon = useMemo(() => {
    if (!clasificacionesDB || clasificacionesDB.length === 0) return [];

    return clasificacionesDB.filter(c => {
      const nombre = c.nombre_producto?.toLowerCase() || '';
      return nombre.includes('limón') || nombre.includes('limon');
    });
  }, [clasificacionesDB]);

  // Función para calcular el peso total
  const pesoTotal = useMemo(() => {
    return kilosSolicitados.toFixed(2);
  }, [kilosSolicitados]);

  // Datos de KPI
  const { eficiencia, merma, produccion_hoy } = kpiData;

  // Datos de últimos registros
  const ultimosRegistros: RegistroProduccion[] = [
    { calibre: 'SUPER', color: 'bg-green-700', qty: 10 },
    { calibre: 'EXTRA', color: 'bg-green-500', qty: 25 },
    { calibre: 'XXX', color: 'bg-green-400', qty: 40 },
  ];

  // Función para registrar producción
  const registrarProduccion = useCallback(async () => {
    if (!loteSeleccionado) return;

    try {
      // Validar kilos disponibles
      if (sobrepasaKilosDisponibles) {
        toast.error("Kilos insuficientes para registrar", {
          description: `Disponible: ${kilosDisponibles.toFixed(2)} kg | Solicitado: ${kilosSolicitados.toFixed(2)} kg`
        });
        return;
      }

      const datosProduccion = {
        lote_id: loteId,
        calibre: calibre,
        color: color,
        calidad: destinoInfo?.calidad || 'primera',
        presentacion_id: esIndustria ? null : presentacionId,
        cantidad_cajas: esIndustria ? 0 : parseInt(cantidadCajas, 10),
        peso_total_kg: kilosSolicitados,
        destino: destinoInfo?.destino || 'piso_empaque'
      };

      const { error } = await supabase
        .from('produccion')
        .insert([datosProduccion]);

      if (error) throw error;

      toast.success("Producción registrada exitosamente", {
        description: `Lote: ${loteSeleccionado.numero_lote} | Kilos: ${kilosSolicitados.toFixed(2)} kg`
      });

      // Limpiar formulario
      setCantidadCajas("");
      setPesoIndustria("");
      setCalibre("");
      setColor("");
      setPresentacionId("");

      await queryClient.invalidateQueries({ queryKey: ['produccion-por-lote'] });
      await queryClient.invalidateQueries({ queryKey: ['lotes-activos'] });

    } catch (error: unknown) {
      console.error('Error registrando producción:', error);
      toast.error("Error al registrar producción", {
        description: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  }, [loteSeleccionado, loteId, calibre, color, destinoInfo, esIndustria, presentacionId, cantidadCajas, kilosSolicitados, sobrepasaKilosDisponibles, kilosDisponibles, queryClient]);

  return (
    <MainLayout title="Clasificación de Producción" subtitle="Módulo de control de calidad e industrialización">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Panel operativo</p>
            <h2 className="text-2xl font-bold text-slate-900">Clasificación de Producción</h2>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><span className="mr-2 h-2 w-2 rounded-full bg-emerald-500" />En línea</Badge>
            <Bell className="h-5 w-5 text-slate-500" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-600">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Lotes activos</p>
              <p className="mt-2 text-4xl font-bold">{lotesProduccionDisponibles.length}</p>
              <p className="mt-1 text-sm text-emerald-700"><TrendingUp className="mr-1 inline h-4 w-4" />Operación estable</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-lime-400">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Rendimiento actual</p>
              <p className="mt-2 text-4xl font-bold">{eficiencia.toFixed(1)}%</p>
              <Progress value={eficiencia} className="mt-3 h-2 [&>div]:bg-lime-400" />
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-slate-800">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Procesado (hoy)</p>
              <p className="mt-2 text-4xl font-bold">{(produccion_hoy / 1000).toFixed(1)} Tn</p>
              <p className="mt-1 text-xs text-muted-foreground">Objetivo diario: 50.0 Tn</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-950 text-white">
            <CardContent className="flex h-full items-center justify-between pt-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-emerald-200">Estado planta</p>
                <p className="mt-2 text-3xl font-bold">Operativo</p>
              </div>
              <Factory className="h-8 w-8 text-lime-300" />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busquedaLote}
              onChange={(e) => setBusquedaLote(e.target.value)}
              placeholder="Buscar por lote, productor o variedad..."
              className="h-12 rounded-xl bg-white pl-10"
            />
          </div>
          <Button variant="outline" className="h-12 rounded-xl">
            <Filter className="mr-2 h-4 w-4" /> Filtrar
          </Button>
          <Button className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-2 h-4 w-4" /> Nuevo lote
          </Button>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">

        {/* --- COLUMNA IZQUIERDA: FORMULARIO (8/12) --- */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="shadow-lg border-t-4 border-t-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" /> Clasificación JBM
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* 1. SELECCIÓN DE LOTE */}
              <div className="space-y-2">
                <Label htmlFor={idLote} className="text-xs font-bold text-slate-500 uppercase">
                  Lote en Línea
                </Label>
                <Select value={loteId} onValueChange={setLoteId}>
                  <SelectTrigger id={idLote} name="lote" className="h-14 bg-slate-50 text-lg">
                    <SelectValue placeholder="Seleccione Lote..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesFiltrados.length > 0 ? (
                      lotesFiltrados.map((lote: LoteDisponible) => {
                        const kilosProd = produccionPorLote[lote.id] || 0;
                        const kilosDisp = Math.max(0, (lote.peso_pagable || 0) - kilosProd);

                        return (
                          <SelectItem key={lote.id} value={lote.id} className="py-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-bold">{lote.numero_lote}</span>
                                <span className="text-xs text-slate-500 ml-2">
                                  {lote.productores?.nombre || 'Sin productor'}
                                </span>
                              </div>
                              <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                                {kilosDisp.toFixed(0)} kg disp.
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground italic">
                        No hay lotes de limón pendientes de producción
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. INFORMACIÓN DE KILOS DEL LOTE */}
              {loteSeleccionado && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Scale className="h-5 w-5 text-slate-600" />
                    <h4 className="font-semibold text-slate-700">Control de Kilos del Lote</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Peso Pagable</p>
                      <p className="text-xl font-bold text-slate-800">
                        {(loteSeleccionado.peso_pagable || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Merma Estimada</p>
                      <p className="text-xl font-bold text-amber-600">
                        {(loteSeleccionado.kilos_merma || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Ya Procesado</p>
                      <p className="text-xl font-bold text-blue-600">
                        {kilosProcesados.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase">
                        {sobrepasaKilosDisponibles ? 'FALTANTE' : 'DISPONIBLE'}
                      </p>
                      <p className={cn(
                        "text-xl font-bold",
                        sobrepasaKilosDisponibles ? "text-red-600" :
                          kilosDisponibles < 500 ? "text-amber-600" : "text-green-600"
                      )}>
                        {kilosDisponibles.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg
                      </p>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Progreso: {porcentajeUtilizado.toFixed(1)}%</span>
                      <span>{kilosProcesados.toFixed(0)} / {(loteSeleccionado.peso_pagable || 0).toFixed(0)} kg</span>
                    </div>
                    <Progress
                      value={porcentajeUtilizado}
                      className="h-2"
                    />
                  </div>

                  {/* Alerta si sobrepasa */}
                  {sobrepasaKilosDisponibles && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">
                          ¡Advertencia! Sobrepasa los kilos disponibles
                        </p>
                        <p className="text-xs text-red-600">
                          Solicitas: <span className="font-bold">{kilosSolicitados.toFixed(2)} kg</span> |
                          Disponible: <span className="font-bold">{kilosDisponibles.toFixed(2)} kg</span> |
                          Exceso: <span className="font-bold">{diferenciaKilos.toFixed(2)} kg</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Confirmación si está bien */}
                  {tieneKilosSuficientes && kilosSolicitados > 0 && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">
                          ✅ Kilos disponibles suficientes
                        </p>
                        <p className="text-xs text-green-600">
                          Solicitud: {kilosSolicitados.toFixed(2)} kg |
                          Restante después: {(kilosDisponibles - kilosSolicitados).toFixed(2)} kg
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 3. SELECCIÓN DE CALIBRE */}
                <div className="space-y-2">
                  <Label htmlFor={idCalibre} className="text-xs font-bold text-slate-500 uppercase">
                    Calibre
                  </Label>
                  <Select
                    value={calibre}
                    onValueChange={setCalibre}
                    disabled={!loteId}
                  >
                    <SelectTrigger id={idCalibre} name="calibre" className="h-14">
                      <SelectValue placeholder={
                        !loteId ? "Seleccione un lote primero" :
                            "Seleccione calibre"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {calibresLimon.length > 0 ? (
                        calibresLimon.map((item) => (
                          <SelectItem key={item.id} value={item.calibre} className="py-3">
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2",
                                item.calibre === 'SUPER' ? "bg-green-800 text-white border-green-900" :
                                  item.calibre === 'EXTRA' ? "bg-green-600 text-white border-green-700" :
                                    item.calibre.includes('X') ? "bg-green-100 text-green-800 border-green-300" :
                                      "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {item.calibre.substring(0, 2)}
                              </span>
                              <div className="flex flex-col">
                                <span className="font-bold text-lg">{item.calibre}</span>
                                <span className="text-xs text-slate-500">
                                  {item.nombre_producto}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No se encontraron calibres
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. SELECCIÓN DE COLOR */}
                <div className="space-y-2">
                  <Label htmlFor={idColor} className="text-xs font-bold text-slate-500 uppercase">
                    Color
                  </Label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger id={idColor} name="color" className="h-14">
                      <SelectValue placeholder="Madurez..." />
                    </SelectTrigger>
                    <SelectContent>
                      {colores.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-6 w-6 rounded-full border border-slate-200 shadow-sm", c.color)} />
                            <span className="text-base">{c.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 5. ALERTA DE DESTINO */}
              {destinoInfo?.mensaje && (
                <div className={cn(
                  "p-4 rounded-lg border flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200",
                  destinoInfo.tipo === 'info' ? "bg-blue-50 border-blue-200 text-blue-800" :
                    destinoInfo.tipo === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" :
                      "bg-green-50 border-green-200 text-green-800"
                )}>
                  {destinoInfo.tipo === 'info' && <Info className="h-6 w-6" />}
                  {destinoInfo.tipo === 'warning' && <AlertTriangle className="h-6 w-6" />}
                  {destinoInfo.tipo === 'success' && <CheckCircle className="h-6 w-6" />}
                  <div>
                    <p className="font-bold">{destinoInfo.mensaje}</p>
                    <p className="text-xs opacity-80 uppercase tracking-wider font-bold mt-1">
                      Destino: {esIndustria ? "Molino / Desecho" : "Cámara Fría"}
                    </p>
                  </div>
                </div>
              )}

              {/* 6. INPUTS FINALES */}
              {!esIndustria ? (
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor={idPresentacion} className="text-xs font-bold text-slate-500 uppercase">
                      Presentación
                    </Label>
                    <Select
                      value={presentacionId}
                      onValueChange={setPresentacionId}
                      disabled={sobrepasaKilosDisponibles && kilosDisponibles <= 0}
                    >
                      <SelectTrigger id={idPresentacion} name="presentacion" className="h-16 bg-slate-50">
                        <SelectValue placeholder="Tipo de Envase..." />
                      </SelectTrigger>
                      <SelectContent>
                        {presentaciones.map((p: Presentacion) => (
                          <SelectItem key={p.id} value={p.id} className="py-3 text-base">
                            {p.nombre} ({p.peso_kg} kg)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={idCantidad} className="text-xs font-bold text-slate-500 uppercase">
                      Cantidad de Cajas
                    </Label>
                    <Input
                      id={idCantidad}
                      name="cantidad"
                      type="number"
                      value={cantidadCajas}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCantidadCajas(value);
                      }}
                      placeholder="0"
                      className={cn(
                        "h-16 text-3xl font-mono text-center font-bold tracking-tighter",
                        sobrepasaKilosDisponibles && "border-red-300 focus-visible:ring-red-500"
                      )}
                      min="0"
                      step="1"
                      disabled={sobrepasaKilosDisponibles && kilosDisponibles <= 0}
                    />
                    {presentacionSeleccionada && cantidadCajas && (
                      <p className="text-sm text-slate-600 text-center">
                        {cantidadCajas} cajas × {presentacionSeleccionada.peso_kg} kg =
                        <span className="font-bold ml-1">
                          {(parseInt(cantidadCajas) * presentacionSeleccionada.peso_kg).toFixed(2)} kg
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-amber-50 p-6 rounded-xl border border-amber-100">
                  <Label htmlFor={idPesoBascula} className="text-amber-800 font-bold uppercase text-sm">
                    Peso Báscula de Piso (Kg)
                  </Label>
                  <Input
                    id={idPesoBascula}
                    name="peso_bascula"
                    type="number"
                    value={pesoIndustria}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPesoIndustria(value);
                    }}
                    placeholder="0.00"
                    className={cn(
                      "h-16 text-4xl font-mono text-center border-amber-300 focus-visible:ring-amber-500 bg-white",
                      sobrepasaKilosDisponibles && "border-red-300 focus-visible:ring-red-500"
                    )}
                    min="0"
                    step="0.01"
                    disabled={sobrepasaKilosDisponibles && kilosDisponibles <= 0}
                  />
                  {pesoIndustria && (
                    <div className="text-center">
                      <p className="text-sm text-slate-600">
                        <span className="font-bold">{parseFloat(pesoIndustria).toFixed(2)} kg</span> a molino
                      </p>
                      {sobrepasaKilosDisponibles && (
                        <p className="text-sm text-red-600 font-semibold mt-1">
                          ¡Excede por {diferenciaKilos.toFixed(2)} kg!
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 7. RESUMEN Y BOTONES */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Resumen de producción</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-100 p-2 rounded">
                      <span className="text-slate-500">Peso total:</span>
                      <span className="font-bold ml-1">{pesoTotal} kg</span>
                    </div>
                    <div className={cn(
                      "p-2 rounded",
                      sobrepasaKilosDisponibles ? "bg-red-100" : "bg-green-100"
                    )}>
                      <span className={sobrepasaKilosDisponibles ? "text-red-600" : "text-green-600"}>
                        {sobrepasaKilosDisponibles ? "Exceso:" : "Disponible:"}
                      </span>
                      <span className={cn(
                        "font-bold ml-1",
                        sobrepasaKilosDisponibles ? "text-red-700" : "text-green-700"
                      )}>
                        {sobrepasaKilosDisponibles ?
                          `+${diferenciaKilos.toFixed(2)} kg` :
                          `${(kilosDisponibles - kilosSolicitados).toFixed(2)} kg`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="flex-1 h-14 text-lg bg-blue-700 hover:bg-blue-800 shadow-md transition-all active:scale-95"
                    disabled={
                      !loteId ||
                      !calibre ||
                      !color ||
                      (!esIndustria && (!presentacionId || !cantidadCajas)) ||
                      (esIndustria && !pesoIndustria) ||
                      sobrepasaKilosDisponibles ||
                      kilosSolicitados <= 0
                    }
                    type="button"
                    onClick={registrarProduccion}
                  >
                    <Package className="h-5 w-5 mr-2" />
                    Registrar {esIndustria ? "Peso" : "Cajas"}
                  </Button>

                  <EtiquetaCaja
                    disabled={
                      !loteId ||
                      !calibre ||
                      !color ||
                      (!esIndustria && (!presentacionId || !cantidadCajas)) ||
                      sobrepasaKilosDisponibles
                    }
                    etiquetaInfo={{
                      numeroLote: loteSeleccionado?.numero_lote || "Pendiente",
                      calibre: calibre || "S/N",
                      color: color || "S/N",
                      presentacion: presentacionSeleccionada?.nombre || "Granel",
                      pesoKg: kilosSolicitados,
                      fecha: new Date(),
                      productor: loteSeleccionado?.productores?.nombre || "Desconocido"
                    }}
                  />
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* --- COLUMNA DERECHA: KPI --- */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader className="pb-2 bg-slate-50 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Eficiencia Turno
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-slate-600">Global</span>
                  <span className="font-bold text-blue-600">{eficiencia}%</span>
                </div>
                <Progress value={eficiencia} className="h-3" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-slate-600">Merma</span>
                  <span className="font-bold text-green-600">{merma}%</span>
                </div>
                <Progress value={merma * 10} className="h-3 [&>div]:bg-green-500" />
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-600">Producción Hoy</p>
                    <p className="text-xs text-slate-500">Kilos procesados</p>
                  </div>
                  <span className="text-2xl font-bold text-slate-800">{produccion_hoy.toLocaleString()} kg</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ULTIMAS CAJAS */}
          <Card>
            <CardHeader className="pb-2 bg-slate-50 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Últimos Registros
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {ultimosRegistros.map((registro, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${registro.color}`}></div>
                    <span className="font-bold text-sm">Limon Verde {registro.calibre}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-600">{registro.qty} cjs</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>



        <Card className="rounded-2xl border border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Reporte de Calidad y Descarte (Acumulado)</CardTitle>
            <Button variant="link" className="text-emerald-700"><Download className="mr-2 h-4 w-4" />Descargar CSV</Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b">
                    <th className="pb-3">Tipo de descarte</th>
                    <th className="pb-3">Frecuencia</th>
                    <th className="pb-3">Impacto</th>
                    <th className="pb-3">Tendencia</th>
                    <th className="pb-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tipo: "Oleocelosis (Mancha de Aceite)", kg: 245, impacto: 3.4, tendencia: "Alza" },
                    { tipo: "Daño por Frío", kg: 112, impacto: 1.1, tendencia: "Baja" },
                    { tipo: "Fruta Sobre-madura", kg: 48, impacto: 0.4, tendencia: "Estable" }
                  ].map((row) => (
                    <tr key={row.tipo} className="border-b last:border-0">
                      <td className="py-4 font-medium">{row.tipo}</td>
                      <td className="py-4">{row.kg} kg</td>
                      <td className="py-4">{row.impacto}%</td>
                      <td className="py-4">{row.tendencia}</td>
                      <td className="py-4 text-right">
                        <Button size="sm" variant="outline">Detalle</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
      </div>
    </MainLayout>
  );
}