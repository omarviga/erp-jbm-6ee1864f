import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck,
  ShoppingCart,
  Package,
  Camera,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- DATOS INICIALES ---

const embarquesPendientes = [
  {
    id: "EMB-2501",
    origen: "Michoacán",
    tarimas: 24,
    estado: "llegado",
    hora: "11:45 AM",
  },
];

const productosRecibirInicial = [
  { producto: "Limón Verde Super", enviado: 8, recibido: 8 },
  { producto: "Limón Verde Extra", enviado: 6, recibido: 6 },
  { producto: "Limón Verde XXX", enviado: 5, recibido: 4 },
  { producto: "Limón Alimonado", enviado: 5, recibido: 5 },
];

const inventarioCDMX = [
  { producto: "Limón Verde Super", cantidad: 45, precio: 850 },
  { producto: "Limón Verde Extra", cantidad: 32, precio: 750 },
  { producto: "Limón Verde XXX", cantidad: 28, precio: 680 },
  { producto: "Limón Alimonado", cantidad: 18, precio: 620 },
];

interface CartItem {
  producto: string;
  cantidad: number;
  precio: number;
}

export default function CDMXPage() {
  // --- ESTADO ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recepcionList, setRecepcionList] = useState(productosRecibirInicial);

  // --- LÓGICA DE CARRITO ---
  const addToCart = (producto: any) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.producto === producto.producto);
      if (existingItem) {
        toast.success(`Incrementada cantidad de ${producto.producto}`);
        return prevCart.map((item) =>
          item.producto === producto.producto
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      toast.success(`${producto.producto} agregado al carrito`);
      return [...prevCart, { producto: producto.producto, cantidad: 1, precio: producto.precio }];
    });
  };

  const removeFromCart = (productName: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.producto !== productName));
    toast.error("Producto eliminado del carrito");
  };

  const updateQuantity = (productName: string, delta: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.producto === productName) {
          const newQty = Math.max(1, item.cantidad + delta);
          return { ...item, cantidad: newQty };
        }
        return item;
      })
    );
  };

  const updatePrice = (productName: string, newPrice: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.producto === productName ? { ...item, precio: newPrice } : item
      )
    );
  };

  const totalVenta = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
  }, [cart]);

  // --- LÓGICA DE RECEPCIÓN ---
  const handleRecepcionChange = (index: number, value: string) => {
    const newVal = parseInt(value) || 0;
    const newList = [...recepcionList];
    newList[index].recibido = newVal;
    setRecepcionList(newList);
  };

  const handleConfirmarRecepcion = () => {
    const tieneDiscrepancias = recepcionList.some((p) => p.enviado !== p.recibido);
    if (tieneDiscrepancias) {
      toast.warning("Se ha confirmado con discrepancias", {
        description: "Se notificará al equipo de Michoacán.",
      });
    } else {
      toast.success("Materia prima recibida correctamente");
    }
  };

  const handleProcesarVenta = () => {
    toast.success("Venta procesada con éxito", {
      description: `Total: $${totalVenta.toLocaleString()}`,
    });
    setCart([]);
  };

  return (
    <MainLayout title="Operación CDMX" subtitle="Recepción y Punto de Venta">
      <Tabs defaultValue="recepcion" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-12 mb-6">
          <TabsTrigger value="recepcion" className="text-base gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Recepción
          </TabsTrigger>
          <TabsTrigger value="ventas" className="text-base gap-2">
            <ShoppingCart className="w-4 h-4" />
            Punto de Venta
          </TabsTrigger>
        </TabsList>

        {/* --- PESTAÑA RECEPCIÓN --- */}
        <TabsContent value="recepcion" className="space-y-6 animate-fade-in">
          <Card className="border-2 border-warning/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-warning" />
                Embarque Pendiente de Revisión
              </CardTitle>
            </CardHeader>
            <CardContent>
              {embarquesPendientes.map((embarque) => (
                <div key={embarque.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <h3 className="font-bold text-lg">{embarque.id}</h3>
                    <p className="text-sm text-muted-foreground">
                      {embarque.tarimas} tarimas • Origen: {embarque.origen} • Llegó {embarque.hora}
                    </p>
                  </div>
                  <Badge className="bg-warning/10 text-warning border-warning/20 px-3 py-1">
                    Esperando Revisión
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Checklist de Recepción - {embarquesPendientes[0]?.id}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Enviado</TableHead>
                    <TableHead className="text-center">Recibido</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Evidencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recepcionList.map((producto, index) => {
                    const isDiscrepancia = producto.enviado !== producto.recibido;
                    return (
                      <TableRow key={index} className={cn(isDiscrepancia && "bg-destructive/5")}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {producto.producto}
                            {isDiscrepancia && <AlertCircle className="w-4 h-4 text-destructive animate-pulse" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">{producto.enviado}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={producto.recibido}
                            onChange={(e) => handleRecepcionChange(index, e.target.value)}
                            className={cn(
                              "w-20 mx-auto text-center font-bold",
                              isDiscrepancia && "border-destructive text-destructive"
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {!isDiscrepancia ? (
                            <CheckCircle className="w-5 h-5 text-success mx-auto" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-destructive mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toast.info("Próximamente: Capturar evidencia")}
                          >
                            <Camera className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-4">
                <Button className="gap-2 px-6" onClick={handleConfirmarRecepcion}>
                  <CheckCircle className="w-4 h-4" />
                  Confirmar Recepción
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- PESTAÑA PUNTO DE VENTA --- */}
        <TabsContent value="ventas" className="space-y-6 animate-fade-in">
          <div className="grid lg:grid-cols-12 gap-6">
            {/* GRID DE PRODUCTOS */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {inventarioCDMX.map((producto, index) => (
                  <Card
                    key={index}
                    className="border-2 hover:border-primary transition-all group overflow-hidden"
                  >
                    <CardContent className="pt-6 relative">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                        <Package className="w-6 h-6 text-primary group-hover:text-white" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-base mb-1">{producto.producto}</p>
                        <Badge variant="secondary" className="mb-2">
                          {producto.cantidad} tarimas disp.
                        </Badge>
                        <p className="text-2xl font-bold text-primary">
                          ${producto.precio.toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-4 gap-2 opacity-90 group-hover:opacity-100"
                        onClick={() => addToCart(producto)}
                      >
                        <Plus className="w-4 h-4" />
                        Agregar al Carrito
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* CARRITO */}
            <div className="lg:col-span-4 h-full">
              <Card className="border-2 sticky top-4 h-[calc(100vh-220px)] flex flex-col">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ShoppingCart className="w-6 h-6 text-primary" />
                    Carrito de Venta
                    {cart.length > 0 && (
                      <Badge className="ml-auto bg-primary text-white">
                        {cart.reduce((s, i) => s + i.cantidad, 0)} items
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-0">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
                      <p className="font-medium">Tu carrito está vacío</p>
                      <p className="text-sm">Agrega productos para comenzar</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {cart.map((item, idx) => (
                        <div key={idx} className="p-4 space-y-3 group bg-white hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-800">{item.producto}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeFromCart(item.producto)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center border rounded-md h-9 bg-white shadow-sm">
                              <button
                                className="px-2 h-full hover:bg-muted transition-colors rounded-l-md"
                                onClick={() => updateQuantity(item.producto, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-10 text-center font-bold font-mono text-sm leading-none bg-slate-50 h-full flex items-center justify-center border-x">
                                {item.cantidad}
                              </span>
                              <button
                                className="px-2 h-full hover:bg-muted transition-colors rounded-r-md"
                                onClick={() => updateQuantity(item.producto, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="text-right">
                              <Input
                                type="number"
                                className="w-24 h-9 text-right font-bold text-primary border-none shadow-none focus-visible:ring-0 p-0 text-lg"
                                value={item.precio}
                                onChange={(e) => updatePrice(item.producto, parseFloat(e.target.value) || 0)}
                                contentEditable
                              />
                              <p className="text-[10px] uppercase text-muted-foreground font-medium -mt-1 tracking-wider">P. Unitario</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>

                <div className="p-6 bg-muted/30 border-t space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-muted-foreground text-sm">
                      <span>Subtotal</span>
                      <span className="font-mono">${totalVenta.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-2xl font-black text-slate-900 pt-2 border-t border-slate-200">
                      <span>TOTAL</span>
                      <span className="text-primary">${totalVenta.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full h-14 text-lg font-bold gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                    disabled={cart.length === 0}
                    onClick={handleProcesarVenta}
                  >
                    <DollarSign className="w-5 h-5" />
                    Procesar Venta
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}