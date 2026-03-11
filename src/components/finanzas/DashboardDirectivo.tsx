import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Scale, AlertCircle } from "lucide-react";
import { useDashboardFinanciero } from "@/hooks/useDashboardFinanciero";
import { startOfMonth, endOfMonth } from "date-fns";

export function DashboardDirectivo() {
  // Por defecto, vemos el mes actual
  const [fechaInicio] = useState(startOfMonth(new Date()));
  const [fechaFin] = useState(endOfMonth(new Date()));

  const { data, isLoading, error } = useDashboardFinanciero(fechaInicio, fechaFin);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md">
        Ocurrió un error al cargar los datos financieros.
      </div>
    );
  }

  // Formateador de moneda
  const formatDinero = (monto: number) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);

  const costoTotal = data.costo_fruta + data.gastos_generales + data.provision_operativa;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Visión Directiva</h2>
        <p className="text-muted-foreground">Resultados del mes en curso</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:max-w-4xl">
        
        {/* TARJETA 1: UTILIDAD NETA (La más importante) */}
        <Card className="bg-slate-900 text-white shadow-lg md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-medium">Utilidad Neta Real</CardTitle>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div 
              className="text-3xl md:text-4xl font-bold text-emerald-400 truncate tracking-tight"
              title={formatDinero(data.utilidad_neta)}
            >
              {formatDinero(data.utilidad_neta)}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Margen de negocio: {data.margen_porcentaje.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* TARJETA 2: INGRESOS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Ingresos (Ventas)</CardTitle>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div 
              className="text-xl md:text-2xl font-bold text-slate-800 truncate tracking-tight"
              title={formatDinero(data.ingresos)}
            >
              {formatDinero(data.ingresos)}
            </div>
          </CardContent>
        </Card>

        {/* TARJETA 3: COSTOS TOTALES (Corregida para números grandes) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Egresos Totales</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div 
              className="text-xl md:text-2xl font-bold text-red-600 truncate tracking-tight"
              title={formatDinero(costoTotal)}
            >
              {formatDinero(costoTotal)}
            </div>
            <p 
              className="text-xs text-slate-500 mt-1 truncate"
              title={`Fruta: ${formatDinero(data.costo_fruta)} | Gastos: ${formatDinero(data.gastos_generales)}`}
            >
              Fruta: {formatDinero(data.costo_fruta)} | Gastos: {formatDinero(data.gastos_generales)}
            </p>
          </CardContent>
        </Card>

        {/* TARJETA 4: PROVISIÓN OPERATIVA */}
        <Card className="bg-amber-50 border-amber-200 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-amber-800">Fondo Operativo Generado ($0.04/kg)</CardTitle>
            <Scale className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div 
              className="text-xl md:text-2xl font-bold text-amber-700 truncate tracking-tight"
              title={formatDinero(data.provision_operativa)}
            >
              {formatDinero(data.provision_operativa)}
            </div>
            <p className="text-sm text-amber-600/80 mt-1">
              Basado en {data.kilos_comprados.toLocaleString()} kg procesados
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}