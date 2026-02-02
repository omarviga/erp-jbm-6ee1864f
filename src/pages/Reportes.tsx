import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Search, QrCode, TrendingUp, Package, Scale, DollarSign } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const distribucionCalibre = [
  { name: "Cal. 300", value: 35, color: "hsl(90, 80%, 45%)" },
  { name: "Cal. 400", value: 28, color: "hsl(90, 80%, 55%)" },
  { name: "Cal. 500", value: 20, color: "hsl(120, 60%, 50%)" },
  { name: "Cal. 600", value: 10, color: "hsl(45, 100%, 50%)" },
  { name: "Industria", value: 7, color: "hsl(0, 84%, 60%)" },
];

const rentabilidadSemanal = [
  { dia: "Lun", ingresos: 85000, costos: 62000 },
  { dia: "Mar", ingresos: 92000, costos: 68000 },
  { dia: "Mié", ingresos: 78000, costos: 58000 },
  { dia: "Jue", ingresos: 105000, costos: 75000 },
  { dia: "Vie", ingresos: 115000, costos: 82000 },
  { dia: "Sáb", ingresos: 65000, costos: 48000 },
];

const loteDetalle = {
  numero: "L20260117-001",
  productor: "Juan Pérez García",
  fechaRecepcion: "17/01/2026",
  pesoNeto: 2450,
  precio: 4.50,
  produccion: [
    { calibre: "300", cajas: 85, destino: "Cámara Fría" },
    { calibre: "400", cajas: 62, destino: "Cámara Fría" },
    { calibre: "500", cajas: 45, destino: "Cámara Fría" },
    { calibre: "Industria", peso: 180, destino: "Molino" },
  ],
  merma: 3.2,
  costoCompra: 11025,
  ventaEstimada: 15800,
};

export default function Reportes() {
  const margenBruto = loteDetalle.ventaEstimada - loteDetalle.costoCompra;
  const margenPorcentaje = ((margenBruto / loteDetalle.costoCompra) * 100).toFixed(1);

  return (
    <MainLayout title="Reportes" subtitle="Análisis y trazabilidad">
      <Tabs defaultValue="trazabilidad" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3 h-12">
          <TabsTrigger value="trazabilidad" className="text-base font-medium">
            <Search className="h-4 w-4 mr-2" />
            Trazabilidad
          </TabsTrigger>
          <TabsTrigger value="rentabilidad" className="text-base font-medium">
            <TrendingUp className="h-4 w-4 mr-2" />
            Rentabilidad
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-base font-medium">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        {/* Trazabilidad */}
        <TabsContent value="trazabilidad" className="space-y-6">
          {/* Buscador */}
          <Card className="module-card">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="sr-only">Buscar Lote</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por número de lote, productor o QR..."
                      className="pl-10 h-14 text-base"
                      defaultValue="L20260117-001"
                    />
                  </div>
                </div>
                <Button className="h-14 px-6">
                  <QrCode className="h-5 w-5 mr-2" />
                  Escanear QR
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Detalle del Lote */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 module-card">
              <CardHeader className="module-header">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Trazabilidad: {loteDetalle.numero}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Info General */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Productor</p>
                    <p className="font-semibold">{loteDetalle.productor}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Fecha Recepción</p>
                    <p className="font-semibold">{loteDetalle.fechaRecepcion}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Peso Neto</p>
                    <p className="font-semibold">{loteDetalle.pesoNeto.toLocaleString()} kg</p>
                  </div>
                </div>

                {/* Desglose de Producción */}
                <div>
                  <h4 className="font-semibold mb-3">Desglose de Producción</h4>
                  <div className="space-y-2">
                    {loteDetalle.produccion.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">Cal. {item.calibre}</Badge>
                          <span className="text-sm text-muted-foreground">→</span>
                          <span className="text-sm">{item.destino}</span>
                        </div>
                        <span className="font-semibold">
                          {"cajas" in item ? `${item.cajas} cajas` : `${item.peso} kg`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${loteDetalle.merma > 5 ? 'bg-destructive/10 border border-destructive/30' : 'bg-success/10 border border-success/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Scale className="h-5 w-5" />
                      <span className="font-semibold">Merma</span>
                    </div>
                    <p className={`text-2xl font-bold ${loteDetalle.merma > 5 ? 'text-destructive' : 'text-success'}`}>
                      {loteDetalle.merma}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {loteDetalle.merma > 5 ? "⚠️ Por encima del objetivo" : "✓ Dentro del objetivo (<5%)"}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5" />
                      <span className="font-semibold">Margen Bruto</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      ${margenBruto.toLocaleString()} MXN
                    </p>
                    <p className="text-sm text-muted-foreground">
                      +{margenPorcentaje}% sobre costo
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QR y Acciones */}
            <Card className="module-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Etiqueta QR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center">
                    <QrCode className="h-24 w-24 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mt-2">{loteDetalle.numero}</p>
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  Imprimir Etiqueta
                </Button>
                <Button className="w-full" variant="outline">
                  Descargar PDF
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rentabilidad */}
        <TabsContent value="rentabilidad" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Gráfico de Rentabilidad */}
            <Card className="lg:col-span-2 module-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Ingresos vs Costos (Semanal)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rentabilidadSemanal}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dia" className="text-xs fill-muted-foreground" />
                      <YAxis 
                        className="text-xs fill-muted-foreground"
                        tickFormatter={(value) => `$${(value / 1000)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                      />
                      <Legend />
                      <Bar dataKey="ingresos" fill="hsl(90, 80%, 45%)" name="Ingresos" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="costos" fill="hsl(45, 100%, 50%)" name="Costos" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* KPIs de Rentabilidad */}
            <div className="space-y-4">
              <Card className="kpi-card border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="kpi-label">Margen Promedio</p>
                    <p className="kpi-value text-primary">32.5%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
              </Card>
              <Card className="kpi-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="kpi-label">Valor Inventario</p>
                    <p className="kpi-value">$485k</p>
                    <p className="text-sm text-muted-foreground">MXN</p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              </Card>
              <Card className="kpi-card border-success/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="kpi-label">Utilidad Semanal</p>
                    <p className="kpi-value text-success">$147k</p>
                    <p className="text-sm text-muted-foreground">MXN</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-success" />
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Dashboard Ejecutivo */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Distribución por Calibre */}
            <Card className="module-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Distribución por Calibre</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribucionCalibre}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {distribucionCalibre.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${value}%`, "Participación"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Resumen Semanal */}
            <Card className="module-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Resumen Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Kilos Recibidos", value: "87,450 kg", trend: "+12%" },
                    { label: "Cajas Empacadas", value: "5,890 cajas", trend: "+8%" },
                    { label: "Embarques USA", value: "12", trend: "+4" },
                    { label: "Ventas Molino", value: "8.5 ton", trend: "-2%" },
                    { label: "Merma Promedio", value: "3.8%", trend: "-0.5%" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm font-medium">{item.label}</span>
                      <div className="text-right">
                        <p className="font-semibold">{item.value}</p>
                        <p className={`text-xs ${item.trend.startsWith('+') || item.trend.startsWith('-0') ? 'text-success' : 'text-destructive'}`}>
                          {item.trend}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
