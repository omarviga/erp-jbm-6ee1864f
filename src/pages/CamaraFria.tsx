import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Thermometer,
  Droplets,
  Clock,
  AlertTriangle,
  Package,
  ArrowRightLeft,
  Search,
  Filter,
  Snowflake
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- DATOS SIMULADOS (MOCK DATA) ---
// Estado: 1=Fresco (Verde), 2=Atención (Amarillo), 3=Urgente (Rojo)
const inventarioInicial = [
  { id: "L-2024001", producto: "Limón Persa 175", ubicacion: "A-01", dias: 2, estado: 1, kgs: 1600 },
  { id: "L-2024002", producto: "Limón Persa 200", ubicacion: "A-02", dias: 3, estado: 1, kgs: 1200 },
  { id: "L-2024003", producto: "Limón Persa 230", ubicacion: "A-03", dias: 8, estado: 2, kgs: 1100 },
  { id: "L-2024005", producto: "Aguacate Hass", ubicacion: "B-01", dias: 1, estado: 1, kgs: 800 },
  { id: "L-2024006", producto: "Aguacate Hass", ubicacion: "B-02", dias: 12, estado: 3, kgs: 850 }, // Urgente
  { id: "L-2024010", producto: "Toronja Ruby", ubicacion: "C-01", dias: 5, estado: 1, kgs: 700 },
];

const pasillos = ["A", "B", "C"];
const posiciones = ["01", "02", "03", "04"];

export default function CamaraFria() {
  const [items, setItems] = useState(inventarioInicial);
  const [filtroEstado, setFiltroEstado] = useState<number | null>(null); // null = ver todos

  // Estadísticas Rápidas
  const capacidadTotal = pasillos.length * posiciones.length;
  const ocupacion = items.length;
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
                4.2 <span className="text-sm">°C</span>
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
              {lotesUrgentes > 0 ? (
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
                        const loteEnPosicion = items.find(i => i.ubicacion === codigoUbicacion);

                        // Si hay filtro activo y este item no coincide, lo mostramos "apagado"
                        const isDimmed = filtroEstado !== null && loteEnPosicion?.estado !== filtroEstado;

                        return (
                          <div
                            key={codigoUbicacion}
                            className={cn(
                              "relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer group",
                              loteEnPosicion
                                ? getStatusColor(loteEnPosicion.estado)
                                : "border-dashed border-slate-200 bg-white/50 hover:border-blue-300",
                              isDimmed && "opacity-20 grayscale"
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
                                  <span>{loteEnPosicion.kgs} kg</span>
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
              <Button className="w-full justify-start" variant="outline">
                <Search className="mr-2 h-4 w-4" /> Buscar Lote Específico
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Reubicar Tarima
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Filter className="mr-2 h-4 w-4" /> Auditoría de Inventario
              </Button>
            </CardContent>
          </Card>

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
                {items
                  .sort((a, b) => b.dias - a.dias) // Ordenar por días descendente
                  .slice(0, 4) // Solo top 4
                  .map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-sm">
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