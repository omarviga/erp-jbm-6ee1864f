import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Package, Receipt,
  Loader2, ShieldAlert, Lock
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/**
 * DASHBOARD DE RENTABILIDAD
 * 
 * ACCESO ESTRICTAMENTE RESTRINGIDO: Solo admin_owner
 * 
 * Fórmula de Utilidad:
 * Utilidad Neta CDMX = (Suma de Ventas CDMX) - (Costo de Cajas Vendidas según precio_base) - (Gastos Centro de Costo CDMX)
 */

export default function DashboardTab() {
  const { isAdmin } = useAuth();

  const now = new Date();
  const mesInicio = startOfMonth(now).toISOString();
  const mesFin = endOfMonth(now).toISOString();

  // Fetch ventas CDMX del mes
  const { data: ventasData, isLoading: loadingVentas } = useQuery({
    queryKey: ['dashboard-ventas-cdmx', mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          id,
          total,
          created_at,
          venta_detalles(cantidad, precio_unitario)
        `)
        .eq('tipo', 'pos_cdmx')
        .gte('created_at', mesInicio)
        .lte('created_at', mesFin);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch gastos CDMX del mes
  const { data: gastosData, isLoading: loadingGastos } = useQuery({
    queryKey: ['dashboard-gastos-cdmx', mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .ilike('notas', '%BODEGA CDMX%')
        .gte('fecha', format(new Date(mesInicio), 'yyyy-MM-dd'))
        .lte('fecha', format(new Date(mesFin), 'yyyy-MM-dd'));

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch auditoría de inventario para calcular costo de ventas
  const { data: auditoriaData, isLoading: loadingAuditoria } = useQuery({
    queryKey: ['dashboard-auditoria-cdmx', mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auditoria_inventario_cdmx')
        .select(`
          cantidad,
          inventario:inventario_bodega_cdmx(precio_base)
        `)
        .eq('tipo_movimiento', 'salida')
        .eq('referencia_tipo', 'venta')
        .gte('created_at', mesInicio)
        .lte('created_at', mesFin);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Calculate metrics
  // SECURITY: Double-check admin access (after hooks)
  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground">
              Esta sección solo está disponible para administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalVentas = ventasData?.reduce((sum, v) => sum + v.total, 0) || 0;
  const totalGastos = gastosData?.reduce((sum, g) => sum + g.monto, 0) || 0;
  
  // Cost of goods sold (COGS) based on precio_base
  const costoMercancia = auditoriaData?.reduce((sum, a) => {
    const precioBase = (a.inventario as any)?.precio_base || 0;
    return sum + (a.cantidad * precioBase);
  }, 0) || 0;

  // NET PROFIT CALCULATION
  const utilidadBruta = totalVentas - costoMercancia;
  const utilidadNeta = utilidadBruta - totalGastos;
  const margenBruto = totalVentas > 0 ? (utilidadBruta / totalVentas) * 100 : 0;
  const margenNeto = totalVentas > 0 ? (utilidadNeta / totalVentas) * 100 : 0;

  const isLoading = loadingVentas || loadingGastos || loadingAuditoria;

  // Data for chart
  const chartData = [
    { name: 'Ventas', value: totalVentas, fill: '#2ECC71' },
    { name: 'Costo Mercancía', value: costoMercancia, fill: '#3498DB' },
    { name: 'Gastos Operativos', value: totalGastos, fill: '#E74C3C' },
    { name: 'Utilidad Neta', value: Math.max(0, utilidadNeta), fill: utilidadNeta >= 0 ? '#27AE60' : '#C0392B' },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            Dashboard de Rentabilidad
          </h1>
          <p className="text-sm text-muted-foreground">
            Análisis financiero de Bodega CDMX — {format(now, 'MMMM yyyy', { locale: es })}
          </p>
        </div>
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          Solo Administrador
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Ventas Totales</p>
                <p className="text-2xl font-black text-green-600">
                  ${totalVentas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Costo Mercancía</p>
                <p className="text-2xl font-black text-blue-600">
                  ${costoMercancia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Gastos Operativos</p>
                <p className="text-2xl font-black text-red-600">
                  ${totalGastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Receipt className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${utilidadNeta >= 0 ? 'border-l-emerald-500' : 'border-l-red-600'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Utilidad Neta</p>
                <p className={`text-2xl font-black ${utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${utilidadNeta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Margen: {margenNeto.toFixed(1)}%
                </p>
              </div>
              {utilidadNeta >= 0 ? (
                <TrendingUp className="h-8 w-8 text-emerald-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 flex-1">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Desglose Financiero
            </CardTitle>
            <CardDescription>
              Comparativa de ventas, costos y utilidad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, '']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Formula breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cálculo de Rentabilidad</CardTitle>
            <CardDescription>
              Fórmula: Ventas - Costo de Mercancía - Gastos = Utilidad Neta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-green-700">Ventas CDMX</span>
                <span className="font-bold text-green-700">+ ${totalVentas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-blue-700">Costo de mercancía vendida</span>
                <span className="font-bold text-blue-700">- ${costoMercancia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div className="flex justify-between p-3 bg-muted rounded-lg">
                <span className="font-semibold">= Utilidad Bruta</span>
                <span className="font-bold">${utilidadBruta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div className="flex justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="text-red-700">Gastos operativos CDMX</span>
                <span className="font-bold text-red-700">- ${totalGastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div className={`flex justify-between p-4 rounded-lg border-2 ${
                utilidadNeta >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'
              }`}>
                <span className={`font-bold text-lg ${utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  = UTILIDAD NETA
                </span>
                <span className={`font-black text-xl ${utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  ${utilidadNeta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-2">Indicadores</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Margen Bruto</p>
                  <p className="text-xl font-bold">{margenBruto.toFixed(1)}%</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${utilidadNeta >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-muted-foreground">Margen Neto</p>
                  <p className={`text-xl font-bold ${utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {margenNeto.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
