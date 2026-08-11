import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

interface BarDatum {
  mes: string;
  ingresos: number;
  pagos: number;
  gastos: number;
}

interface PieDatum {
  name: string;
  value: number;
}

interface GastosChartsProps {
  barData: BarDatum[];
  gastosPorCategoria: PieDatum[];
  pieColors: string[];
}

export function GastosCharts({ barData, gastosPorCategoria, pieColors }: GastosChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <Bar dataKey="pagos" name="Pagos a Productores" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-muted-foreground">Sin datos para el periodo seleccionado</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Gastos por Categoría</CardTitle></CardHeader>
        <CardContent>
          {gastosPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={gastosPorCategoria}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {gastosPorCategoria.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString("es-MX")}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-muted-foreground">Sin gastos registrados</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
