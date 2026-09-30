import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const data = [
  { name: "Ene", production: 0 },
  { name: "Feb", production: 0 },
  { name: "Mar", production: 0 },
  { name: "Abr", production: 0 },
  { name: "May", production: 0 },
  { name: "Jun", production: 0 },
  { name: "Jul", production: 0 },
  { name: "Ago", production: 0 },
  { name: "Sep", production: 0 },
  { name: "Oct", production: 0 },
  { name: "Nov", production: 0 },
  { name: "Dic", production: 0 },
];

const chartConfig = {
  production: {
    label: "Producción (kg)",
    color: "hsl(var(--chart-1))",
  },
};

export function ProductionChart() {
  return (
    <Card className="module-card">
      <CardHeader>
        <CardTitle>Producción Mensual</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="production"
              stroke="var(--color-production)"
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
