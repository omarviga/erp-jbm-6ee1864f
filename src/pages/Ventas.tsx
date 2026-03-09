import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Plus, Minus, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useVentas } from "@/hooks/useVentas";
import { toast } from "sonner";

export default function Ventas() {
  const { productos, carrito, stock, loading, agregarAlCarrito, actualizarItem, eliminarDelCarrito, cobrar } = useVentas();
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "cheque">("efectivo");

  const total = useMemo(
    () => carrito.reduce((acc, item) => acc + item.cantidad * item.precio_venta, 0),
    [carrito]
  );

  const onCobrar = async () => {
    if (carrito.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    const venta = await cobrar(null, total, metodoPago);
    if (venta) {
      toast.success("Venta registrada correctamente");
    }
  };

  return (
    <MainLayout title="Punto de Venta CDMX" subtitle="Precio de venta validado contra precio base">
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventario disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {productos.map((p) => {
                  const existencia = stock[p.id] || 0;
                  return (
                    <Card key={p.id} className="border border-border">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <p className="font-semibold text-foreground">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">{p.tipo} • {p.peso_kg} kg</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">Stock: {existencia}</Badge>
                          <p className="font-mono text-sm text-foreground">${(p.precio_sugerido || 0).toFixed(2)}</p>
                        </div>
                        <Button className="w-full" onClick={() => agregarAlCarrito(p)} disabled={existencia <= 0}>
                          <Plus className="w-4 h-4 mr-2" /> Agregar
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Carrito
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {carrito.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin productos en carrito</p>
              ) : (
                carrito.map((item) => (
                  <div key={item.id} className="border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm leading-tight">{item.nombre}</p>
                      <Button variant="ghost" size="icon" onClick={() => eliminarDelCarrito(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Cantidad</p>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" onClick={() => actualizarItem(item.id, { cantidad: Math.max(1, item.cantidad - 1) })}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-10 text-center text-sm font-semibold">{item.cantidad}</span>
                          <Button variant="outline" size="icon" onClick={() => actualizarItem(item.id, { cantidad: item.cantidad + 1 })}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Precio venta</p>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.precio_venta}
                          onChange={(e) => actualizarItem(item.id, { precio_venta: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    {item.precio_venta < (item.precio_sugerido || 0) && (
                      <div className="flex items-center gap-2 text-xs text-destructive">
                        <AlertTriangle className="w-3 h-3" />
                        Precio por debajo del precio base
                      </div>
                    )}
                  </div>
                ))
              )}

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground">Método de pago</p>
                <div className="flex gap-2 mt-2">
                  {(["efectivo", "transferencia", "cheque"] as const).map((m) => (
                    <Button
                      key={m}
                      variant={metodoPago === m ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMetodoPago(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="font-mono">${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>

              <Button className="w-full" onClick={onCobrar} disabled={loading || carrito.length === 0}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Cobrar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
