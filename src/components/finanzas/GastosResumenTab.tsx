import { Suspense, lazy, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Receipt as ReceiptIcon, Download } from "lucide-react";
import { useGastos } from "@/hooks/useGastos";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { openPrintDocument } from "@/lib/print/openPrintDocument";
import { renderResumenFinancieroHtml } from "@/lib/print/renderResumenFinancieroHtml";

const GastosCharts = lazy(() =>
  import("@/components/finanzas/GastosCharts").then((module) => ({ default: module.GastosCharts })),
);

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
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const now = useMemo(() => new Date(), []);

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

  // Fetch pagos a productores (egresos, vía CxP)
  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ["pagos-productores-finanzas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abonos_productor")
        .select("id, monto, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingGastos || loadingVentas || loadingPagos;

  // Filter by period
  const periodoRange = useMemo(() => {
    if (periodo === "mes_actual") return { start: startOfMonth(now), end: endOfMonth(now) };
    if (periodo === "mes_anterior") {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    if (periodo === "3_meses") return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
  }, [periodo, now]);

  const inRange = (dateStr: string) => {
    const d = new Date(dateStr);
    return d >= periodoRange.start && d <= periodoRange.end;
  };

  const gastosFiltrados = gastos.filter((g) => inRange(g.fecha));
  const ventasFiltradas = ventas.filter((v) => inRange(v.fecha_venta));
  const pagosFiltrados = pagos.filter((p) => inRange(p.created_at));

  const totalIngresos = ventasFiltradas.reduce((s, v) => s + (v.total || 0), 0);
  const totalPagos = pagosFiltrados.reduce((s, p) => s + (p.monto || 0), 0);
  const totalGastos = gastosFiltrados.reduce((s, g) => s + g.monto, 0);
  const totalEgresos = totalPagos + totalGastos;
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

  // Period label for PDF
  const periodoLabel = useMemo(() => {
    const labels: Record<string, string> = {
      mes_actual: format(now, "MMMM yyyy", { locale: es }),
      mes_anterior: format(subMonths(now, 1), "MMMM yyyy", { locale: es }),
      "3_meses": `${format(subMonths(now, 2), "MMM", { locale: es })} - ${format(now, "MMM yyyy", { locale: es })}`,
      "6_meses": `${format(subMonths(now, 5), "MMM", { locale: es })} - ${format(now, "MMM yyyy", { locale: es })}`,
    };
    return labels[periodo] || periodo;
  }, [periodo, now]);

  // Formatted gastos for PDF
  const gastosPDFData = useMemo(() => {
    return gastosFiltrados.map((g) => ({
      id: g.id,
      fecha: format(new Date(g.fecha), "dd MMM yy", { locale: es }),
      concepto: g.concepto,
      categoria: g.categoria,
      proveedor: g.proveedor,
      monto: g.monto,
    }));
  }, [gastosFiltrados]);

  // Monthly bar chart data
  const barData = useMemo(() => {
    const months: Record<string, { mes: string; ingresos: number; pagos: number; gastos: number }> = {};
    const addMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      const key = format(d, "yyyy-MM");
      if (!months[key]) months[key] = { mes: format(d, "MMM yy", { locale: es }), ingresos: 0, pagos: 0, gastos: 0 };
      return months[key];
    };
    ventasFiltradas.forEach((v) => { addMonth(v.fecha_venta).ingresos += v.total || 0; });
    pagosFiltrados.forEach((p) => { addMonth(p.created_at).pagos += p.monto || 0; });
    gastosFiltrados.forEach((g) => { addMonth(g.fecha).gastos += g.monto; });
    return Object.values(months).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [ventasFiltradas, pagosFiltrados, gastosFiltrados]);

  const handleDescargarPdf = async () => {
    setGenerandoPdf(true);
    try {
      openPrintDocument(
        `resumen-financiero-${periodo}`,
        renderResumenFinancieroHtml({
          periodo: periodoLabel,
          totalIngresos,
          totalPagos,
          totalGastos,
          utilidadBruta,
          gastosPorCategoria,
          gastosFiltrados: gastosPDFData,
        }),
      );
    } finally {
      setGenerandoPdf(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Period filter + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_actual">Mes actual</SelectItem>
            <SelectItem value="mes_anterior">Mes anterior</SelectItem>
            <SelectItem value="3_meses">Últimos 3 meses</SelectItem>
            <SelectItem value="6_meses">Últimos 6 meses</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="default" disabled={generandoPdf} size="sm" onClick={() => void handleDescargarPdf()}>
            {generandoPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Exportar PDF
          </Button>
          <Button variant="outline" asChild size="sm">
            <Link to="/gastos"><ReceiptIcon className="w-4 h-4 mr-2" />Ir a Gastos</Link>
          </Button>
        </div>
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
                <p className="text-2xl font-black text-orange-600">${totalPagos.toLocaleString("es-MX", { minimumFractionDigits: 0 })}</p>
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

      <Suspense fallback={<div className="h-[320px] rounded-xl border bg-white animate-pulse" />}>
        <GastosCharts
          barData={barData}
          gastosPorCategoria={gastosPorCategoria}
          pieColors={PIE_COLORS}
        />
      </Suspense>

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
