import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Tags, 
  ShoppingCart, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Search,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useInsumos } from "@/hooks/useInsumos";

export default function Insumos() {
  const { toast } = useToast();
  const { insumos: items, isLoading } = useInsumos();
  const [busqueda, setBusqueda] = useState("");

  // Lógica de Filtrado
  const itemsFiltrados = items.filter(item =>
    item.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Cálculos de KPI
  const valorTotalInventario = items.reduce((acc, item) => acc + (item.stock * item.costo), 0);
  const itemsBajoMinimo = items.filter(item => item.stock <= item.minimo).length;

  // Función para calcular días de cobertura
  const calcularCobertura = (stock: number, consumo: number) => {
    if (consumo === 0) return "∞";
    const dias = stock / consumo;
    return dias.toFixed(1);
  };

  const handleMovimiento = (tipo: 'entrada' | 'salida') => {
    toast({
      title: tipo === 'entrada' ? "Entrada Registrada" : "Salida Registrada",
      description: "El movimiento se ha guardado en el Kardex.",
      className: tipo === 'entrada' ? "bg-blue-600 text-white border-none" : "bg-orange-600 text-white border-none"
    });
  };

  return (
    <MainLayout title="Inventario de Insumos" subtitle="Control de Cajas, Tarimas y Materiales de Empaque">

      {/* --- KPIS SUPERIORES --- */}
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
              <span>+12% vs mes anterior</span>
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
            <p className="text-xs text-muted-foreground mt-4">Requieren re-orden inmediata.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Acciones Rápidas</p>
            </div>
            <div className="space-y-2">
              <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700" size="sm" onClick={() => handleMovimiento('entrada')}>
                <Plus className="mr-2 h-4 w-4" /> Registrar Compra (Entrada)
              </Button>
              <Button className="w-full justify-start bg-white text-slate-900 border hover:bg-slate-50" size="sm" onClick={() => handleMovimiento('salida')}>
                <TrendingDown className="mr-2 h-4 w-4" /> Registrar Consumo (Salida)
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* --- TABLA PRINCIPAL --- */}
      <Card className="module-card h-[600px] flex flex-col">
        <CardHeader className="border-b px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Kardex de Materiales</CardTitle>
              <CardDescription>Gestión de existencias en tiempo real</CardDescription>
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
                <th className="px-6 py-3 text-right">Acción</th>
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
                        {/* Barra de Progreso Personalizada para evitar errores de tipo */}
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
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ShoppingCart className="h-4 w-4 text-slate-400 hover:text-blue-600" />
                      </Button>
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

    </MainLayout>
  );
}