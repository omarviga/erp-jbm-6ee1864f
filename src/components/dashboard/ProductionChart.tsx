import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const data = [
  { name: "Ene", production: 4000 },
  { name: "Feb", production: 3000 },
  { name: "Mar", production: 5000 },
  { name: "Abr", production: 4500 },
  { name: "May", production: 6000 },
  { name: "Jun", production: 5500 },
  { name: "Jul", production: 7000 },
  { name: "Ago", production: 6500 },
  { name: "Sep", production: 8000 },
  { name: "Oct", production: 7500 },
  { name: "Nov", production: 9000 },
  { name: "Dic", production: 8500 },
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