import { ComponentType, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package,
  Tags,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Search,
  Plus,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TipoMovimientoInsumo, useInsumos } from "@/hooks/useInsumos";

const tipoMovimientoMeta: Record<TipoMovimientoInsumo, { label: string; icon: ComponentType<{ className?: string }> }> = {
  entrada: { label: "Entrada", icon: ArrowUp },
  salida: { label: "Salida", icon: ArrowDown },
  devolucion: { label: "Devolución", icon: RotateCcw },
};

export default function Insumos() {
  const { toast } = useToast();
  const { insumos: items, movimientos, isLoading, registrarMovimiento } = useInsumos();

  const [busqueda, setBusqueda] = useState("");
  const [insumoId, setInsumoId] = useState("");
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoInsumo>("salida");
  const [cantidad, setCantidad] = useState("");
  const [referencia, setReferencia] = useState("");

  const itemsFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      item.nombre.toLowerCase().includes(term) ||
      item.categoria.toLowerCase().includes(term),
    );
  }, [items, busqueda]);

  const valorTotalInventario = items.reduce((acc, item) => acc + (item.stock * item.costo), 0);
  const itemsBajoMinimo = items.filter((item) => item.stock <= item.minimo).length;

  const calcularCobertura = (stock: number, consumo: number) => {
    if (consumo === 0) return "∞";
    const dias = stock / consumo;
    return dias.toFixed(1);
  };

  const handleRegistrarMovimiento = async () => {
    const cantidadNum = Number(cantidad);

    if (!insumoId || !cantidadNum || cantidadNum <= 0) {
      toast({
        title: "Datos incompletos",
        description: "Selecciona un insumo e ingresa una cantidad válida.",
        variant: "destructive",
      });
      return;
    }

    try {
      await registrarMovimiento.mutateAsync({
        insumoId,
        tipo: tipoMovimiento,
        cantidad: cantidadNum,
        referencia,
      });

      toast({
        title: "Movimiento registrado",
        description: `${tipoMovimientoMeta[tipoMovimiento].label} aplicada correctamente al inventario.`,
      });

      setCantidad("");
      setReferencia("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "No se pudo registrar el movimiento";
      toast({
        title: "Error al registrar",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout title="Inventario de Insumos" subtitle="Control de Cajas, Tarimas y Materiales de Empaque">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="bg-slate-900 text-white border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Valor del Inventario</p>
                <p className="text-3xl font-bold mt-2">${valorTotalInventario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center">
                <Tags className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span>Stock valorizado en tiempo real</span>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4 shadow-sm", itemsBajoMinimo > 0 ? "border-l-red-500 bg-red-50/50" : "border-l-green-500")}>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alertas de Stock</p>
                <p className={cn("text-3xl font-bold mt-2", itemsBajoMinimo > 0 ? "text-red-600" : "text-green-600")}>
                  {itemsBajoMinimo} <span className="text-sm font-normal text-muted-foreground">Artículos Críticos</span>
                </p>
              </div>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", itemsBajoMinimo > 0 ? "bg-red-100" : "bg-green-100")}>
                <AlertTriangle className={cn("h-5 w-5", itemsBajoMinimo > 0 ? "text-red-600" : "text-green-600")} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Detecta materiales por debajo del mínimo operativo.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Movimientos recientes</p>
            </div>
            <div className="space-y-2 text-sm">
              {movimientos.slice(0, 3).map((mov) => (
                <div key={mov.id} className="flex items-center justify-between border rounded-md px-2 py-1">
                  <span className="font-medium truncate max-w-[180px]">{mov.insumoNombre}</span>
                  <Badge variant="outline">{mov.tipoMovimiento}</Badge>
                </div>
              ))}
              {movimientos.length === 0 && <p className="text-muted-foreground">Sin movimientos registrados.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="module-card h-[620px] flex flex-col">
            <CardHeader className="border-b px-6 py-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Kardex de Materiales</CardTitle>
                  <CardDescription>Inventario central de pallets, cajas y fleje</CardDescription>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar material..."
                    className="pl-9 bg-slate-50"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3">Material</th>
                    <th className="px-6 py-3">Categoría</th>
                    <th className="px-6 py-3 text-right">Existencia</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-center">Cobertura Est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsFiltrados.map((item) => {
                    const porcentajeStock = Math.min((item.stock / (item.minimo * 3)) * 100, 100);
                    const diasCobertura = parseFloat(calcularCobertura(item.stock, item.consumoDiario));
                    const esCritico = item.stock <= item.minimo;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground">{item.id}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-normal bg-slate-100 text-slate-600 border-none">
                            {item.categoria}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-mono font-bold text-base">{item.stock.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Min: {item.minimo.toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4 w-48">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span className={esCritico ? "text-red-600 font-bold" : "text-green-600 font-medium"}>
                                {esCritico ? "Crítico" : "Saludable"}
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full transition-all duration-500", esCritico ? "bg-red-500" : "bg-green-500")}
                                style={{ width: `${porcentajeStock}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className={cn(
                            "inline-flex items-center px-2 py-1 rounded text-xs font-bold",
                            diasCobertura < 3 ? "bg-red-100 text-red-700" :
                              diasCobertura < 7 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"
                          )}>
                            {diasCobertura < 999 ? `${diasCobertura} días` : "+30 días"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {itemsFiltrados.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p>No se encontraron insumos con ese nombre.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border border-slate-800 bg-[#111a31] text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ClipboardList className="h-6 w-6 text-lime-300" /> Registro de Salida de Insumos
              </CardTitle>
              <CardDescription className="text-slate-300">Conecta consumo real con Producción y descuentos automáticos de stock.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label className="text-slate-300">Insumo</Label>
                <Select value={insumoId} onValueChange={setInsumoId}>
                  <SelectTrigger className="bg-white text-slate-900 border-white/20">
                    <SelectValue placeholder="Selecciona insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre} ({item.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-300">Tipo</Label>
                  <Select value={tipoMovimiento} onValueChange={(v) => setTipoMovimiento(v as TipoMovimientoInsumo)}>
                    <SelectTrigger className="bg-white text-slate-900 border-white/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(tipoMovimientoMeta) as TipoMovimientoInsumo[]).map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>{tipoMovimientoMeta[tipo].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="bg-white text-slate-900"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Referencia</Label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="bg-white text-slate-900"
                  placeholder="Ej: PROD-LOTE-2024-001"
                />
              </div>

              <Button
                className="w-full bg-lime-400 text-slate-900 hover:bg-lime-300 font-bold"
                onClick={handleRegistrarMovimiento}
                disabled={registrarMovimiento.isPending || isLoading}
              >
                {registrarMovimiento.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando...</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" /> Confirmar movimiento</>
                )}
              </Button>

              <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-slate-300">
                Esta operación genera registro en <strong>Kardex</strong> y actualiza stock de forma inmediata.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Últimos movimientos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {movimientos.slice(0, 8).map((mov) => {
                const meta = tipoMovimientoMeta[mov.tipoMovimiento as TipoMovimientoInsumo];
                const Icono = meta?.icon || TrendingDown;
                return (
                  <div key={mov.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div>
                      <p className="font-medium">{mov.insumoNombre}</p>
                      <p className="text-xs text-muted-foreground">{mov.referencia || 'Sin referencia'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold flex items-center gap-1 justify-end"><Icono className="h-3 w-3" /> {mov.cantidad}</p>
                      <Badge variant="outline" className="text-[10px]">{mov.tipoMovimiento}</Badge>
                    </div>
                  </div>
                );
              })}
              {movimientos.length === 0 && <p className="text-sm text-muted-foreground">Sin historial todavía.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
