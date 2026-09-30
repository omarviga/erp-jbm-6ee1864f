import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

interface DistribucionCalibre {
  name: string;
  value: number;
  color: string;
}

interface RentabilidadSemanal {
  dia: string;
  ingresos: number;
  costos: number;
}

interface ReportesChartsProps {
  rentabilidadSemanal: RentabilidadSemanal[];
  distribucionCalibre: DistribucionCalibre[];
}

export function ReportesCharts({ rentabilidadSemanal, distribucionCalibre }: ReportesChartsProps) {
  return (
    <>
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
                <YAxis className="text-xs fill-muted-foreground" tickFormatter={(value) => `$${(value / 1000)}k`} />
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
    </>
  );
}
