import { useState, useMemo } from "react";
import { useCamaraFria } from "@/hooks/useCamaraFria";
import { differenceInDays } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Thermometer,
  Droplets,
  AlertTriangle,
  Clock,
  Loader2,
  Snowflake,
  Package,
  Search,
  ArrowRightLeft,
  Filter,
  Truck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CrearTransferenciaCDMXDialog } from "@/components/transferencias/CrearTransferenciaCDMXDialog";

const pasillos = ["A", "B", "C"];
const posiciones = ["01", "02", "03", "04"];

export default function CamaraFria() {
  const { inventario, temperaturas, isLoading } = useCamaraFria();
  const [filtroEstado, setFiltroEstado] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const capacidadTotal = pasillos.length * posiciones.length;

  const items = useMemo(() => {
    const base = [...inventario]
      .sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime())
      .map((item, index) => {
        const dias = differenceInDays(new Date(), new Date(item.fecha_ingreso));
        let estado = 1;
        if (dias >= 10) estado = 3;
        else if (dias >= 5) estado = 2;

        const pasilloIndex = Math.floor(index / posiciones.length);
        const posicionIndex = index % posiciones.length;
        const ubicacion = pasilloIndex < pasillos.length
          ? `${pasillos[pasilloIndex]}-${posiciones[posicionIndex]}`
          : null;

        return {
          id: item.produccion?.lotes?.numero_lote || item.id.slice(0, 8),
          producto: `${item.produccion?.calidad || "Sin calidad"} ${item.produccion?.calibre || "S/C"}`.trim(),
          ubicacion,
          dias,
          estado,
          kgs: (item.cantidad_disponible * (item.produccion?.peso_total_kg || 0) / (item.produccion?.cantidad_cajas || 1)) || 0
        };
      });

    return base;
  }, [inventario]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const estadoOk = filtroEstado === null || item.estado === filtroEstado;
      const searchOk = !term || item.id.toLowerCase().includes(term) || item.producto.toLowerCase().includes(term);
      return estadoOk && searchOk;
    });
  }, [items, filtroEstado, searchTerm]);

  const gridItemsByLocation = useMemo(() => {
    const map = new Map<string, (typeof filteredItems)[number]>();
    filteredItems.forEach((item) => {
      if (item.ubicacion && !map.has(item.ubicacion)) {
        map.set(item.ubicacion, item);
      }
    });
    return map;
  }, [filteredItems]);

  const overflowItems = filteredItems.filter((item) => !item.ubicacion);

  // Estadísticas Rápidas
  const ocupacion = Math.min(items.length, capacidadTotal);
  const porcentajeOcupacion = (ocupacion / capacidadTotal) * 100;
  const lotesUrgentes = items.filter(i => i.estado === 3).length;

  // Función para obtener el color según el estado FIFO
  const getStatusColor = (estado: number) => {
    switch (estado) {
      case 1: return "bg-emerald-100 border-emerald-200 text-emerald-800 hover:bg-emerald-200"; // Fresco
      case 2: return "bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200"; // Advertencia
      case 3: return "bg-rose-100 border-rose-200 text-rose-800 hover:bg-rose-200 animate-pulse"; // Crítico
      default: return "bg-slate-50 border-slate-200 text-slate-500";
    }
  };

  return (
    <MainLayout title="Cámara Fría 01" subtitle="Control de Inventario y Cadena de Frío">

      {/* --- KPI DASHBOARD SUPERIOR --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Sensor Temperatura */}
        <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-bold uppercase">Temperatura Actual</p>
              <div className="text-2xl font-mono font-bold text-blue-900 flex items-center gap-1">
                {temperaturas[0]?.temperatura?.toFixed(1) || "4.2"} <span className="text-sm">°C</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Thermometer className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Sensor Humedad */}
        <Card className="bg-cyan-50/50 border-cyan-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-cyan-600 font-bold uppercase">Humedad Relativa</p>
              <div className="text-2xl font-mono font-bold text-cyan-900 flex items-center gap-1">
                88 <span className="text-sm">%</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-cyan-100 flex items-center justify-center">
              <Droplets className="h-5 w-5 text-cyan-600" />
            </div>
          </CardContent>
        </Card>

        {/* Ocupación */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-muted-foreground font-bold uppercase">Ocupación</p>
              <span className="text-xs font-bold">{ocupacion}/{capacidadTotal} Posiciones</span>
            </div>
            <Progress value={porcentajeOcupacion} className="h-2" />
            <p className="text-xs text-right mt-1 text-muted-foreground">{Math.round(porcentajeOcupacion)}% Lleno</p>
          </CardContent>
        </Card>

        {/* Alertas FIFO */}
        <Card className={cn("shadow-sm border-l-4", lotesUrgentes > 0 ? "border-l-rose-500 bg-rose-50/30" : "border-l-emerald-500")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", lotesUrgentes > 0 ? "bg-rose-100" : "bg-emerald-100")}>
              {lotesUrgentes > 0 ? <AlertTriangle className="h-5 w-5 text-rose-600" /> : <Clock className="h-5 w-5 text-emerald-600" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">Estado FIFO</p>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : lotesUrgentes > 0 ? (
                <p className="text-sm font-bold text-rose-700">{lotesUrgentes} Lotes Críticos (&gt;10 días)</p>
              ) : (
                <p className="text-sm font-bold text-emerald-700">Rotación Saludable</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- VISTA PRINCIPAL --- */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* LADO IZQUIERDO: MAPA VISUAL (2 Col) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="module-card">
            <CardHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Snowflake className="h-5 w-5 text-blue-500" />
                  Mapa de Almacén (Vista Superior)
                </CardTitle>
                <div className="flex gap-2">
                  {/* Filtros rápidos visuales */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiltroEstado(null)}
                    className={cn("text-xs h-7", filtroEstado === null && "bg-slate-100 font-bold")}
                  >
                    Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiltroEstado(3)}
                    className={cn("text-xs h-7 text-rose-600", filtroEstado === 3 && "bg-rose-100 font-bold")}
                  >
                    Críticos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-slate-50/50">

              {/* RENDERIZADO DE PASILLOS */}
              <div className="space-y-8">
                {pasillos.map((letraPasillo) => (
                  <div key={letraPasillo} className="relative">
                    {/* Etiqueta del Pasillo */}
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col items-center">
                      <span className="text-xs font-bold text-muted-foreground rotate-[-90deg] whitespace-nowrap">PASILLO</span>
                      <span className="text-2xl font-black text-slate-300">{letraPasillo}</span>
                    </div>

                    {/* Grid de Posiciones */}
                    <div className="grid grid-cols-4 gap-4 pl-4">
                      {posiciones.map((numPos) => {
                        const codigoUbicacion = `${letraPasillo}-${numPos}`;
                        const loteEnPosicion = gridItemsByLocation.get(codigoUbicacion);

                        return (
                          <div
                            key={codigoUbicacion}
                            className={cn(
                              "relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer group",
                              loteEnPosicion
                                ? getStatusColor(loteEnPosicion.estado)
                                : "border-dashed border-slate-200 bg-white/50 hover:border-blue-300"
                            )}
                          >
                            <span className="absolute top-1 left-2 text-[10px] font-bold opacity-40">
                              {codigoUbicacion}
                            </span>

                            {loteEnPosicion ? (
                              <>
                                <Package className="h-6 w-6 mb-1 opacity-80" />
                                <span className="text-xs font-bold leading-tight line-clamp-2">
                                  {loteEnPosicion.producto}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="mt-1 text-[9px] h-4 px-1 bg-white/50 backdrop-blur-sm"
                                >
                                  {loteEnPosicion.dias} días
                                </Badge>
                                {/* Tooltip simulado al hover */}
                                <div className="absolute inset-0 bg-black/80 text-white p-2 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center z-10 pointer-events-none">
                                  <span className="font-bold">{loteEnPosicion.id}</span>
                                  <span>{loteEnPosicion?.kgs?.toLocaleString()} kg</span>
                                  <span className="text-amber-300 mt-1">Ver Detalle</span>
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-slate-300 font-medium">Vacío</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Leyenda */}
              <div className="flex justify-center gap-4 mt-8 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></div>
                  <span>Fresco (0-4 días)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></div>
                  <span>Medio (5-9 días)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-rose-100 border border-rose-300 rounded"></div>
                  <span>Crítico (10+ días)</span>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* LADO DERECHO: ACCIONES Y LISTA (1 Col) */}
        <div className="space-y-6">

          {/* Panel de Control */}
          <Card className="module-card">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Buscar lote</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Folio o producto..."
                    className="pl-9"
                  />
                </div>
              </div>
              <CrearTransferenciaCDMXDialog
                trigger={
                  <Button className="w-full justify-start" variant="outline">
                    <Truck className="mr-2 h-4 w-4" /> Enviar a Bodega CDMX
                  </Button>
                }
              />
              <Button className="w-full justify-start" variant="outline">
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Reubicar Tarima
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Filter className="mr-2 h-4 w-4" /> Auditoría de Inventario
              </Button>
            </CardContent>
          </Card>

          {overflowItems.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-700">Capacidad excedida</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-amber-800">
                  {overflowItems.length} lotes están fuera del mapa visual (sin posición física asignada).
                </p>
              </CardContent>
            </Card>
          )}

          {/* Lista de Próximos a Caducar */}
          <Card className="module-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Prioridad de Salida (FIFO)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...filteredItems]
                  .sort((a, b) => b.dias - a.dias)
                  .slice(0, 4)
                  .map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-sm">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-6 w-6 rounded flex items-center justify-center font-bold text-xs text-white",
                          item.dias > 9 ? "bg-rose-500" : "bg-amber-500"
                        )}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">{item.producto}</p>
                          <p className="text-xs text-muted-foreground">{item.id} • {item.ubicacion}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600">{item.dias} días</span>
                      </div>
                    </div>
                  ))}
                {filteredItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay lotes para el filtro actual.</p>
                )}
              </div>
              <Button variant="link" className="w-full mt-2 h-auto p-0 text-xs text-muted-foreground">
                Ver reporte completo
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </MainLayout>
  );
}