import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Receipt as ReceiptIcon } from "lucide-react";
import { useGastos } from "@/hooks/useGastos";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Link } from "react-router-dom";

const CATEGORIAS_LABEL: Record<string, string> = {
  mantenimiento: "Mantenimiento",
  viaticos: "Viáticos",
  combustible: "Combustible",
  papeleria: "Papelería",
  limpieza: "Limpieza",
  refacciones: "Refacciones",
  servicios: "Servicios",
  otros: "Otros",
};

const PIE_COLORS = ["#f97316", "#3b82f6", "#ef4444", "#6b7280", "#14b8a6", "#eab308", "#a855f7", "#64748b"];

export function GastosResumenTab() {
  const { gastos, isLoading: loadingGastos } = useGastos();
  const [periodo, setPeriodo] = useState("mes_actual");

  // Fetch ventas (ingresos)
  const { data: ventas = [], isLoading: loadingVentas } = useQuery({
    queryKey: ["ventas-finanzas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("id, total, fecha_venta, tipo, pagado")
        .order("fecha_venta", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch liquidaciones (egresos a productores)
  const { data: liquidaciones = [], isLoading: loadingLiq } = useQuery({
    queryKey: ["liquidaciones-finanzas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liquidaciones")
        .select("id, total_pagar, fecha_liquidacion, estado_liq")
        .order("fecha_liquidacion", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingGastos || loadingVentas || loadingLiq;

  // Filter by period
  const now = new Date();
  const periodoRange = useMemo(() => {
    if (periodo === "mes_actual") return { start: startOfMonth(now), end: endOfMonth(now) };
    if (periodo === "mes_anterior") {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    if (periodo === "3_meses") return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
  }, [periodo]);

  const inRange = (dateStr: string) => {
    const d = new Date(dateStr);
    return d >= periodoRange.start && d <= periodoRange.end;
  };

  const gastosFiltrados = gastos.filter((g) => inRange(g.fecha));
  const ventasFiltradas = ventas.filter((v) => inRange(v.fecha_venta));
  const liquidacionesFiltradas = liquidaciones.filter((l) => inRange(l.fecha_liquidacion));

  const totalIngresos = ventasFiltradas.reduce((s, v) => s + (v.total || 0), 0);
  const totalLiquidaciones = liquidacionesFiltradas.reduce((s, l) => s + (l.total_pagar || 0), 0);
  const totalGastos = gastosFiltrados.reduce((s, g) => s + g.monto, 0);
  const totalEgresos = totalLiquidaciones + totalGastos;
  const utilidadBruta = totalIngresos - totalEgresos;

  // Gastos por categoría for pie chart
  const gastosPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    gastosFiltrados.forEach((g) => {
      map[g.categoria] = (map[g.categoria] || 0) + g.monto;
    });
    return Object.entries(map).map(([key, value]) => ({
      name: CATEGORIAS_LABEL[key] || key,
      value,
    }));
  }, [gastosFiltrados]);

  // Monthly bar chart data
  const barData = useMemo(() => {
    const months: Record<string, { mes: string; ingresos: number; liquidaciones: number; gastos: number }> = {};
    const addMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      const key = format(d, "yyyy-MM");
      if (!months[key]) months[key] = { mes: format(d, "MMM yy", { locale: es }), ingresos: 0, liquidaciones: 0, gastos: 0 };
      return months[key];
    };
    ventasFiltradas.forEach((v) => { addMonth(v.fecha_venta).ingresos += v.total || 0; });
    liquidacionesFiltradas.forEach((l) => { addMonth(l.fecha_liquidacion).liquidaciones += l.total_pagar || 0; });
    gastosFiltrados.forEach((g) => { addMonth(g.fecha).gastos += g.monto; });
    return Object.values(months).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [ventasFiltradas, liquidacionesFiltradas, gastosFiltrados]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center justify-between">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_actual">Mes actual</SelectItem>
            <SelectItem value="mes_anterior">Mes anterior</SelectItem>
            <SelectItem value="3_meses">Últimos 3 meses</SelectItem>
            <SelectItem value="6_meses">Últimos 6 meses</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" asChild>
          <Link to="/gastos"><ReceiptIcon className="w-4 h-4 mr-2" />Ir a Gastos</Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Ingresos</p>
                <p className="text-2xl font-black text-green-600">${totalIngresos.toLocaleString("es-MX", { minimumFractionDigits: 0 })}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Pago Productores</p>
                <p className="text-2xl font-black text-orange-600">${totalLiquidaciones.toLocaleString("es-MX", { minimumFractionDigits: 0 })}</p>
              </div>
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Gastos Operativos</p>
                <p className="text-2xl font-black text-red-600">${totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 0 })}</p>
              </div>
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card className={utilidadBruta >= 0 ? "border-green-200" : "border-red-200"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Utilidad Bruta</p>
                <p className={`text-2xl font-black ${utilidadBruta >= 0 ? "text-green-700" : "text-red-700"}`}>
                  ${utilidadBruta.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                </p>
              </div>
              {utilidadBruta >= 0 ? <TrendingUp className="h-6 w-6 text-green-700" /> : <TrendingDown className="h-6 w-6 text-red-700" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Ingresos vs Egresos</CardTitle></CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString("es-MX")}`} />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="liquidaciones" name="Liquidaciones" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-12 text-muted-foreground">Sin datos para el periodo seleccionado</p>
            )}
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Gastos por Categoría</CardTitle></CardHeader>
          <CardContent>
            {gastosPorCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={gastosPorCategoria} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {gastosPorCategoria.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString("es-MX")}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-12 text-muted-foreground">Sin gastos en este periodo</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent gastos table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimos Gastos Registrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gastosFiltrados.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin gastos en este periodo</TableCell></TableRow>
              ) : (
                gastosFiltrados.slice(0, 10).map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{format(new Date(g.fecha), "dd MMM", { locale: es })}</TableCell>
                    <TableCell className="font-medium truncate max-w-[200px]">{g.concepto}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{CATEGORIAS_LABEL[g.categoria] || g.categoria}</Badge>
                    </TableCell>
                    <TableCell>{g.proveedor || "—"}</TableCell>
                    <TableCell className="text-right font-mono">${g.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
