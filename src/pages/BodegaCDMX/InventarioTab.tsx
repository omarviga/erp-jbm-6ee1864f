import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Boxes, Loader2, Eye, EyeOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InventarioItem {
  id: string;
  presentacion_id: string;
  cantidad_disponible: number;
  precio_base: number;
  precio_venta: number;
  fecha_ingreso: string;
  presentacion: {
    nombre: string;
    tipo: string;
    peso_kg: number;
  } | null;
}

export default function InventarioTab() {
  const { isAdmin } = useAuth();

  const { data: inventario, isLoading } = useQuery({
    queryKey: ['inventario-cdmx'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventario_bodega_cdmx')
        .select(`
          id,
          presentacion_id,
          cantidad_disponible,
          precio_base,
          precio_venta,
          fecha_ingreso,
          presentacion:presentaciones(nombre, tipo, peso_kg)
        `)
        .gt('cantidad_disponible', 0)
        .order('fecha_ingreso', { ascending: false });

      if (error) throw error;
      return data as unknown as InventarioItem[];
    },
  });

  // Group by presentacion for summary
  const inventarioAgrupado = inventario?.reduce((acc, item) => {
    const key = item.presentacion?.nombre || 'Sin nombre';
    if (!acc[key]) {
      acc[key] = {
        nombre: key,
        tipo: item.presentacion?.tipo || '',
        peso_kg: item.presentacion?.peso_kg || 0,
        total_cajas: 0,
        lotes: [] as InventarioItem[],
      };
    }
    acc[key].total_cajas += item.cantidad_disponible;
    acc[key].lotes.push(item);
    return acc;
  }, {} as Record<string, { nombre: string; tipo: string; peso_kg: number; total_cajas: number; lotes: InventarioItem[] }>);

  const totalCajas = inventario?.reduce((sum, item) => sum + item.cantidad_disponible, 0) || 0;
  const totalKilos = inventario?.reduce((sum, item) => sum + (item.cantidad_disponible * (item.presentacion?.peso_kg || 0)), 0) || 0;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Inventario Local</h1>
        <p className="text-sm text-muted-foreground">Stock físico en Bodega CDMX</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Total Cajas</p>
                <p className="text-3xl font-black text-[#1E5128]">{totalCajas.toLocaleString()}</p>
              </div>
              <Boxes className="h-8 w-8 text-[#1E5128]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Total Kilos</p>
                <p className="text-3xl font-black text-blue-600">{totalKilos.toLocaleString()} kg</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Productos</p>
                <p className="text-3xl font-black text-purple-600">{Object.keys(inventarioAgrupado || {}).length}</p>
              </div>
              <Package className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security notice for non-admin */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-amber-600" />
          <p className="text-sm text-amber-700">
            Los precios base (costo) están ocultos. Solo el administrador puede verlos.
          </p>
        </div>
      )}

      {/* Inventory Table */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock por Calibre
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!inventarioAgrupado || Object.keys(inventarioAgrupado).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos en inventario</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto / Calibre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Cajas Disponibles</TableHead>
                  <TableHead className="text-center">Peso Total</TableHead>
                  {/* precio_base HIDDEN for operator, visible for admin */}
                  {isAdmin && <TableHead className="text-right">Precio Base (Costo)</TableHead>}
                  <TableHead className="text-right">Precio Venta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(inventarioAgrupado).map((grupo) => {
                  // Get average prices from lotes
                  const avgPrecioBase = grupo.lotes.reduce((sum, l) => sum + l.precio_base, 0) / grupo.lotes.length;
                  const avgPrecioVenta = grupo.lotes.reduce((sum, l) => sum + l.precio_venta, 0) / grupo.lotes.length;

                  return (
                    <TableRow key={grupo.nombre}>
                      <TableCell className="font-semibold">
                        {grupo.nombre}
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {grupo.lotes.length} lotes
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{grupo.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-lg font-bold text-[#1E5128]">
                          {grupo.total_cajas.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {(grupo.total_cajas * grupo.peso_kg).toLocaleString()} kg
                      </TableCell>
                      {/* SECURITY: precio_base HIDDEN for cdmx_operator */}
                      {isAdmin && (
                        <TableCell className="text-right font-mono text-muted-foreground">
                          ${avgPrecioBase.toFixed(2)}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono font-bold">
                        ${avgPrecioVenta.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
