# Crea la página básica de reportes
cat > src / pages / Reportes.tsx << 'EOF'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Reportes = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">📊 Reportes JBM ERP</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Margen Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24.5%</div>
            <p className="text-xs text-muted-foreground">+2.1% vs mes anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lotes Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">12 por vencer esta semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92.3%</div>
            <p className="text-xs text-muted-foreground">Merma controlada en 3.2%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rentabilidad" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rentabilidad">💰 Rentabilidad</TabsTrigger>
          <TabsTrigger value="trazabilidad">🔍 Trazabilidad</TabsTrigger>
          <TabsTrigger value="inventarios">📦 Inventarios</TabsTrigger>
          <TabsTrigger value="ventas">📈 Ventas</TabsTrigger>
        </TabsList>

        <TabsContent value="rentabilidad">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Rentabilidad por Lote</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">Gráfico de rentabilidad por lote</p>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Top 5 Lotes Más Rentables</h3>
                <ul className="space-y-2">
                  <li className="flex justify-between p-2 bg-green-50 rounded">
                    <span>L20260117-001</span>
                    <span className="font-bold text-green-600">+34.2%</span>
                  </li>
                  <li className="flex justify-between p-2 bg-green-50 rounded">
                    <span>L20260116-015</span>
                    <span className="font-bold text-green-600">+28.7%</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trazabilidad">
          <Card>
            <CardHeader>
              <CardTitle>Expedientes Digitales de Lotes</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Consulta la trazabilidad completa de cada lote:</p>
              <div className="mt-4 space-y-2">
                <div className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
                  <a href="/lotes/L20260117-001" className="font-medium text-blue-600">
                    🔍 L20260117-001 - Juan Pérez García
                  </a>
                  <p className="text-sm text-gray-500">2,450 kg • En proceso</p>
                </div>
                <div className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
                  <a href="/lotes/L20260116-015" className="font-medium text-blue-600">
                    🔍 L20260116-015 - Cosecha Propia
                  </a>
                  <p className="text-sm text-gray-500">3,200 kg • Liquidado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reportes;