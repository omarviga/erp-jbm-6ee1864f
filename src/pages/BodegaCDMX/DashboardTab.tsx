import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TAG_CDMX = "[CC:CDMX]";

export default function DashboardTab() {
  const { isAdmin } = useAuth();

  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }, []);
  const monthEnd = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  }, []);

  const { data: ventas, isLoading: loadingVentas } = useQuery({
    queryKey: ["dashboard-cdmx-ventas-rebuild", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas_cdmx")
        .select("id,total,created_at")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: auditoria, isLoading: loadingAuditoria } = useQuery({
    queryKey: ["dashboard-cdmx-auditoria-rebuild", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_inventario_cdmx")
        .select("cantidad,inventario:inventario_id(precio_base)")
        .eq("tipo_movimiento", "salida")
        .eq("referencia_tipo", "venta")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: gastos, isLoading: loadingGastos } = useQuery({
    queryKey: ["dashboard-cdmx-gastos-rebuild", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gastos")
        .select("monto,fecha,notas")
        .ilike("notas", `%${TAG_CDMX}%`);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold">Acceso restringido</h2>
            <p className="text-muted-foreground mt-2">Solo admin puede ver utilidad y costos.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = loadingVentas || loadingAuditoria || loadingGastos;

  const totalVentas = (ventas || []).reduce((acc, v) => acc + v.total, 0);
  const costoMercancia = (auditoria || []).reduce((acc, r: any) => acc + (r.cantidad || 0) * (r.inventario?.precio_base || 0), 0);
  const totalGastos = (gastos || []).reduce((acc, g) => acc + g.monto, 0);
  const utilidad = totalVentas - costoMercancia - totalGastos;
  const margen = totalVentas > 0 ? (utilidad / totalVentas) * 100 : 0;

  const chartData = [
    { name: "Ventas", value: totalVentas },
    { name: "Costo mercancia", value: costoMercancia },
    { name: "Gastos", value: totalGastos },
    { name: "Utilidad", value: utilidad },
  ];

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Lock className="h-5 w-5 text-amber-500" /> Dashboard CDMX</h1>
          <p className="text-sm text-muted-foreground">Utilidad = Ventas - Costo Mercancia - Gastos</p>
        </div>
        <Badge variant="outline">Solo admin</Badge>
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground font-bold">Ventas</p><p className="text-2xl font-black text-emerald-600">${totalVentas.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground font-bold">Costo mercancia</p><p className="text-2xl font-black text-blue-600">${costoMercancia.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground font-bold">Gastos CDMX</p><p className="text-2xl font-black text-red-600">${totalGastos.toFixed(2)}</p></CardContent></Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground font-bold">Utilidad</p>
                <p className={`text-2xl font-black ${utilidad >= 0 ? "text-emerald-700" : "text-red-600"}`}>${utilidad.toFixed(2)}</p>
                <div className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
                  {utilidad >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> : <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
                  Margen {margen.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Grafica de KPIs</CardTitle>
                <CardDescription>Comparativo mensual de rentabilidad CDMX</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                      <Bar dataKey="value" fill="#16a34a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Formula de utilidad</CardTitle>
                <CardDescription>Control estricto de flujo de efectivo CDMX vs Matriz.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 font-mono text-sm">
                <div className="rounded-md p-3 border">Ventas Totales: + ${totalVentas.toFixed(2)}</div>
                <div className="rounded-md p-3 border">Costo Mercancia: - ${costoMercancia.toFixed(2)}</div>
                <div className="rounded-md p-3 border">Gastos CDMX: - ${totalGastos.toFixed(2)}</div>
                <div className={`rounded-md p-3 border-2 ${utilidad >= 0 ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
                  Utilidad neta: {utilidad >= 0 ? "+" : ""}${utilidad.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
