import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EyeOff, Loader2, Package, Boxes } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InventarioRow {
  id: string;
  cantidad_disponible: number;
  precio_base: number;
  precio_venta: number;
  presentacion: { nombre: string; tipo: string; peso_kg: number } | null;
}

const detectCalibre = (nombre: string) => {
  const hit = nombre.match(/(V-4|V-5|V-X|V-XX|V-XXX|V-EXT|AL-4|AL-5|AL-X|AL-XX|AL-XXX|AL-EXT|AM-X|AM-XX|AM-XXX|AM-EXT)/i);
  return hit ? hit[1].toUpperCase() : "SIN-CALIBRE";
};

export default function InventarioTab() {
  const { isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["inventario-cdmx-rebuild", isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventario_bodega_cdmx")
        .select("id,cantidad_disponible,precio_base,precio_venta,presentacion:presentacion_id(nombre,tipo,peso_kg)")
        .gt("cantidad_disponible", 0);

      if (error) throw error;
      return (data || []) as unknown as InventarioRow[];
    },
  });

  const resumen = useMemo(() => {
    const grouped = new Map<string, {
      calibre: string;
      tipo: string;
      cajas: number;
      kilos: number;
      lotes: number;
      totalBase: number;
      totalVenta: number;
    }>();

    for (const row of data || []) {
      const nombre = row.presentacion?.nombre || "Sin nombre";
      const calibre = detectCalibre(nombre);
      const tipo = row.presentacion?.tipo || "N/A";
      const peso = row.presentacion?.peso_kg || 0;

      const prev = grouped.get(calibre) || {
        calibre,
        tipo,
        cajas: 0,
        kilos: 0,
        lotes: 0,
        totalBase: 0,
        totalVenta: 0,
      };

      prev.cajas += row.cantidad_disponible;
      prev.kilos += row.cantidad_disponible * peso;
      prev.lotes += 1;
      prev.totalBase += row.precio_base;
      prev.totalVenta += row.precio_venta;

      grouped.set(calibre, prev);
    }

    return Array.from(grouped.values()).sort((a, b) => b.cajas - a.cajas);
  }, [data]);

  const totalCajas = useMemo(() => resumen.reduce((acc, r) => acc + r.cajas, 0), [resumen]);
  const totalKilos = useMemo(() => resumen.reduce((acc, r) => acc + r.kilos, 0), [resumen]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Inventario por calibre</h1>
        <p className="text-sm text-muted-foreground">Stock fisico de CDMX separado de matriz.</p>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-amber-600" />
          <p className="text-sm text-amber-700">Precio base oculto para operadores.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground font-bold">Cajas disponibles</p>
              <p className="text-3xl font-black text-[#1E5128]">{totalCajas.toLocaleString()}</p>
            </div>
            <Boxes className="h-8 w-8 text-[#1E5128]" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground font-bold">Kilos disponibles</p>
              <p className="text-3xl font-black text-blue-600">{totalKilos.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Tabla agrupada por calibre</CardTitle>
        </CardHeader>
        <CardContent>
          {!resumen.length ? (
            <p className="text-sm text-muted-foreground">Sin inventario disponible.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Calibre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Cajas</TableHead>
                  <TableHead className="text-center">Kilos</TableHead>
                  {isAdmin && <TableHead className="text-right">Precio base prom.</TableHead>}
                  <TableHead className="text-right">Precio venta prom.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumen.map((r) => {
                  const avgBase = r.totalBase / Math.max(r.lotes, 1);
                  const avgVenta = r.totalVenta / Math.max(r.lotes, 1);

                  return (
                    <TableRow key={r.calibre}>
                      <TableCell className="font-semibold">{r.calibre} <Badge variant="outline" className="ml-2">{r.lotes} lotes</Badge></TableCell>
                      <TableCell>{r.tipo}</TableCell>
                      <TableCell className="text-center font-bold">{r.cajas}</TableCell>
                      <TableCell className="text-center">{r.kilos.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                      {isAdmin && <TableCell className="text-right">${avgBase.toFixed(2)}</TableCell>}
                      <TableCell className="text-right font-semibold">${avgVenta.toFixed(2)}</TableCell>
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
