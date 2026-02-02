import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { loteService } from "@/services/loteService";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Package, Factory, ArrowRight,
  AlertTriangle, Info, CheckCircle, Printer
} from "lucide-react";

// --- TIPOS ---
interface LoteDisponible {
  id: string;
  numero: string;
  productor: string;
  variedad: string;
}

interface Presentacion {
  id: string;
  nombre: string;
  peso_kg: number;
}

// --- CONSTANTES ---
const colores = [
  { value: "verde_oscuro", label: "Verde Oscuro", color: "bg-green-700" },
  { value: "verde", label: "Verde", color: "bg-green-500" },
  { value: "alimonado", label: "Alimonado", color: "bg-lime-400" },
  { value: "amarillo", label: "Amarillo", color: "bg-yellow-400" },
];

// CATALOGO DE CLASIFICACIONES (ESCALA AGUIRRE)
const clasificacionesDB = [
  // LIMON VERDE
  { id: 1, nombre_producto: "Limon Verde", calibre: "4", orden: 1 },
  { id: 2, nombre_producto: "Limon Verde", calibre: "X", orden: 2 },
  { id: 3, nombre_producto: "Limon Verde", calibre: "XX", orden: 3 },
  { id: 4, nombre_producto: "Limon Verde", calibre: "XXX", orden: 4 },
  { id: 5, nombre_producto: "Limon Verde", calibre: "EXTRA", orden: 5 },
  { id: 6, nombre_producto: "Limon Verde", calibre: "SUPER", orden: 6 },
  // LIMON ALIMONADO
  { id: 7, nombre_producto: "Limon Alimonado", calibre: "X", orden: 2 },
  { id: 8, nombre_producto: "Limon Alimonado", calibre: "XX", orden: 3 },
  { id: 9, nombre_producto: "Limon Alimonado", calibre: "XXX", orden: 4 },
  { id: 10, nombre_producto: "Limon Alimonado", calibre: "EXTRA", orden: 5 },
];

// Componente Placeholder para Etiqueta
// 1. Definimos la estructura exacta de los datos de la etiqueta
interface EtiquetaData {
  numeroLote: string;
  calibre: string;
  color: string;
  presentacion: string;
  pesoKg: number;
  fecha: Date;
  productor?: string; // El signo ? significa que es opcional
}

// 2. Usamos 'EtiquetaData' en lugar de 'any'
const EtiquetaCaja = ({ disabled, etiquetaInfo }: { disabled: boolean, etiquetaInfo: EtiquetaData }) => (
  <Button variant="outline" disabled={disabled} className="border-dashed border-2 w-full sm:w-auto">
    <Printer className="mr-2 h-4 w-4" /> Imprimir
  </Button>
);

export default function Produccion() {
  // --- ESTADOS ---
  const [loteId, setLoteId] = useState("");
  const [calibre, setCalibre] = useState("");
  const [color, setColor] = useState("");
  const [presentacionId, setPresentacionId] = useState("");
  const [cantidadCajas, setCantidadCajas] = useState("");

  const { data: lotesDisponibles = [], isLoading: loadingLotes } = useQuery({
    queryKey: ['lotes-activos'],
    queryFn: () => loteService.getLotesActivos()
  });

  const { data: presentaciones = [], isLoading: loadingPresentaciones } = useQuery({
    queryKey: ['presentaciones'],
    queryFn: () => loteService.getPresentaciones()
  });

  // --- DERIVADOS ---
  const loteSeleccionado = lotesDisponibles.find((l: LoteDisponible) => l.id === loteId);
  const productoSeleccionado = loteSeleccionado?.variedad || "Limon Verde";
  const presentacionSeleccionada = presentaciones.find((p: Presentacion) => p.id === presentacionId);

  const pesoTotal = useMemo(() => {
    if (presentacionSeleccionada && cantidadCajas) {
      return (presentacionSeleccionada.peso_kg * parseInt(cantidadCajas)).toFixed(2);
    }
    return "0.00";
  }, [presentacionSeleccionada, cantidadCajas]);

  // Lógica automática de clasificación (Reglas de Negocio)
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

  // Eficiencia proyectada
  const eficiencia = 87.5;
  const mermaActual = 3.2;

  return (
    <MainLayout title="Producción" subtitle="Mesa de Clasificación y Empaque">
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
                <Label className="text-xs font-bold text-slate-500 uppercase">Lote en Línea</Label>
                <Select value={loteId} onValueChange={setLoteId}>
                  <SelectTrigger className="h-14 bg-slate-50 text-lg">
                    <SelectValue placeholder="Seleccione Lote..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesDisponibles.length > 0 ? (
                      lotesDisponibles.map((l: LoteDisponible) => (
                        <SelectItem key={l.id} value={l.id} className="py-3">
                          <span className="font-bold">{l.numero}</span> - {l.productor} ({l.variedad})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground italic">
                        No hay lotes pendientes de producción
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 2. SELECCIÓN DE CALIBRE (Escala Aguirre: X, XX, EXTRA) */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Calibre</Label>
                  <Select value={calibre} onValueChange={setCalibre} disabled={!loteId}>
                    <SelectTrigger className="h-14">
                      <SelectValue placeholder="Tamaño..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clasificacionesDB
                        .filter(c => c.nombre_producto === productoSeleccionado)
                        .map((item) => (
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
                              <span className="font-bold text-lg">{item.calibre}</span>
                            </div>
                          </SelectItem>
                        ))}
                      {clasificacionesDB.length === 0 && <SelectItem value="0">Sin datos</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. SELECCIÓN DE COLOR */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Color</Label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger className="h-14">
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

              {/* 4. ALERTA DE DESTINO */}
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

              {/* 5. INPUTS FINALES */}
              {!esIndustria && (
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Presentación</Label>
                    <Select value={presentacionId} onValueChange={setPresentacionId}>
                      <SelectTrigger className="h-16 bg-slate-50">
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
                    <Label className="text-xs font-bold text-slate-500 uppercase">Cantidad</Label>
                    <Input
                      type="number"
                      value={cantidadCajas}
                      onChange={(e) => setCantidadCajas(e.target.value)}
                      placeholder="0"
                      className="h-16 text-3xl font-mono text-center font-bold tracking-tighter"
                    />
                  </div>
                </div>
              )}

              {esIndustria && (
                <div className="space-y-2 bg-amber-50 p-6 rounded-xl border border-amber-100 text-center">
                  <Label className="text-amber-800 font-bold uppercase text-sm">Peso Báscula de Piso (Kg)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="h-16 text-4xl font-mono text-center border-amber-300 focus-visible:ring-amber-500 bg-white"
                  />
                </div>
              )}

              {/* 6. BOTONES */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                  className="flex-1 h-14 text-lg bg-blue-700 hover:bg-blue-800 shadow-md transition-all active:scale-95"
                  disabled={!loteId || (!esIndustria && !cantidadCajas)}
                >
                  <Package className="h-5 w-5 mr-2" />
                  Registrar {esIndustria ? "Peso" : "Cajas"}
                </Button>

                <EtiquetaCaja
                  // La lógica de disabled está bien, la dejamos igual
                  disabled={!loteId || !calibre || !color || (!esIndustria && (!presentacionId || !cantidadCajas))}

                  // AQUÍ ESTÁ EL CAMBIO: Llenamos los datos reales
                  etiquetaInfo={{
                    numeroLote: loteSeleccionado?.numero || "Pendiente",
                    calibre: calibre || "S/N",
                    color: color || "S/N",
                    presentacion: presentacionSeleccionada?.nombre || "Granel",
                    pesoKg: presentacionSeleccionada?.peso || 0,
                    fecha: new Date(),
                    productor: loteSeleccionado?.productor || "Desconocido"
                  }}
                />
              </div>

            </CardContent>
          </Card>
        </div>

        {/* --- COLUMNA DERECHA: KPI --- */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader className="pb-2 bg-slate-50 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Eficiencia Turno</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <div className="flex justify-between mb-2"><span className="font-bold text-slate-600">Global</span> <span className="font-bold text-blue-600">{eficiencia}%</span></div>
                <Progress value={eficiencia} className="h-3" />
              </div>
              <div>
                <div className="flex justify-between mb-2"><span className="font-bold text-slate-600">Merma</span> <span className="font-bold text-green-600">{mermaActual}%</span></div>
                <Progress value={mermaActual * 10} className="h-3 [&>div]:bg-green-500" />
              </div>
            </CardContent>
          </Card>

          {/* ULTIMAS CAJAS */}
          <Card>
            <CardHeader className="pb-2 bg-slate-50 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Últimos Registros</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {[
                { calibre: 'SUPER', color: 'bg-green-700', qty: 10 },
                { calibre: 'EXTRA', color: 'bg-green-500', qty: 25 },
                { calibre: 'XXX', color: 'bg-green-400', qty: 40 },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                    <span className="font-bold text-sm">Limon Verde {item.calibre}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-600">{item.qty} cjs</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

      </div>
    </MainLayout>
  );
}