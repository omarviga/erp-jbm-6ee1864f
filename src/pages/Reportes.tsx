import { Suspense, lazy } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Search, QrCode, TrendingUp, Package, Scale, DollarSign } from "lucide-react";

const ReportesCharts = lazy(() =>
  import("@/components/reportes/ReportesCharts").then((module) => ({ default: module.ReportesCharts })),
);

const distribucionCalibre: Array<{ name: string; value: number; color: string }> = [];
const rentabilidadSemanal: Array<{ dia: string; ingresos: number; costos: number }> = [];

export default function Reportes() {
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
                  Trazabilidad de lote
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Busca un lote o escanea su QR para ver aquí el detalle de trazabilidad.
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
                    <p className="text-sm text-muted-foreground mt-2">Sin lote seleccionado</p>
                  </div>
                </div>
                <Button className="w-full" variant="outline" disabled>
                  Imprimir Etiqueta
                </Button>
                <Button className="w-full" variant="outline" disabled>
                  Descargar PDF
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rentabilidad */}
        <TabsContent value="rentabilidad" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 module-card">
              <CardContent className="flex h-[350px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Los gráficos de rentabilidad aparecerán aquí cuando existan datos consolidados para el periodo.
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="kpi-card border-primary/20">
                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <p className="kpi-label">Margen Promedio</p>
                    <p className="kpi-value text-primary">--</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
              </Card>
              <Card className="kpi-card">
                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <p className="kpi-label">Valor Inventario</p>
                    <p className="kpi-value">--</p>
                    <p className="text-sm text-muted-foreground">MXN</p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              </Card>
              <Card className="kpi-card border-success/20">
                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <p className="kpi-label">Utilidad Semanal</p>
                    <p className="kpi-value text-success">--</p>
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
            <Card className="module-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Resumen Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  El resumen ejecutivo se mostrará aquí cuando el módulo de reportes consuma información consolidada.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
