// src/pages/VentasLimon.tsx
import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, CreditCard, User, Search, Loader2, Printer, Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useVentasLimon } from "@/hooks/useVentasLimon";
import { useVentas } from "@/hooks/useVentas"; // Para clientes
import { FiltrosLimon } from "@/components/ventas/FiltrosLimon";
import { ProductoLimonCard } from "@/components/ventas/ProductoLimonCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function VentasLimon() {
    // Usar el hook especializado para limón
    const {
        productos,
        carrito,
        stock,
        loading,
        agregarAlCarrito,
        actualizarItem,
        eliminarDelCarrito,
        limpiarCarrito,
        cobrar,
        filtroTipoLimon,
        setFiltroTipoLimon,
        filtroCalibre,
        setFiltroCalibre,
        filtroEmpaque,
        setFiltroEmpaque
    } = useVentasLimon();

    // Usar el hook original para clientes
    const { clientes } = useVentas();

    const [clienteId, setClienteId] = useState<string>("mostrador");
    const [busqueda, setBusqueda] = useState("");
    const [modalCobroOpen, setModalCobroOpen] = useState(false);
    const [montoRecibido, setMontoRecibido] = useState("");
    const [metodoPago, setMetodoPago] = useState("efectivo");
    const [ticketOpen, setTicketOpen] = useState(false);
    const [ticketData, setTicketData] = useState<any>(null);

    // Cálculos del carrito
    const totalVenta = useMemo(() =>
        carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0),
        [carrito]);

    const totalArticulos = useMemo(() =>
        carrito.reduce((sum, item) => sum + item.cantidad, 0),
        [carrito]);

    const cambio = useMemo(() => {
        const recibido = parseFloat(montoRecibido) || 0;
        return Math.max(0, recibido - totalVenta);
    }, [montoRecibido, totalVenta]);

    // Cliente seleccionado
    const clienteActual = useMemo(() => {
        if (clienteId === "mostrador") return { nombre: "Público General", tipo: "nacional" };
        return clientes.find(c => c.id === clienteId);
    }, [clienteId, clientes]);

    // Filtrar productos por búsqueda
    const productosFiltrados = useMemo(() => {
        return productos.filter(p =>
            p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.tipo_limon.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.calibre.toLowerCase().includes(busqueda.toLowerCase())
        );
    }, [productos, busqueda]);

    const handleCobrar = async () => {
        const venta = await cobrar(
            clienteId === "mostrador" ? null : clienteId,
            parseFloat(montoRecibido) || totalVenta,
            metodoPago
        );

        if (venta) {
            setTicketData({
                ...venta,
                items: [...carrito],
                cliente: clienteActual,
                recibido: parseFloat(montoRecibido) || totalVenta,
                cambio: cambio
            });
            setModalCobroOpen(false);
            setTicketOpen(true);
            setMontoRecibido("");
        }
    };

    const handlePrint = () => {
        window.print();
        setTicketOpen(false);
    };

    return (
        <MainLayout title="Punto de Venta Limón" subtitle="JBM Limones - Central de Abastos CDMX">
            <div className="grid lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">

                {/* COLUMNA IZQUIERDA: CATÁLOGO (7 Cols) */}
                <div className="lg:col-span-7 flex flex-col gap-4 h-full">
                    {/* Filtros específicos para limón */}
                    <FiltrosLimon
                        tipoLimon={filtroTipoLimon}
                        setTipoLimon={setFiltroTipoLimon}
                        calibre={filtroCalibre}
                        setCalibre={setFiltroCalibre}
                        empaque={filtroEmpaque}
                        setEmpaque={setFiltroEmpaque}
                    />

                    {/* Barra de búsqueda */}
                    <Card className="flex-shrink-0">
                        <div className="p-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar limón por nombre, tipo o calibre..."
                                    className="pl-10 h-12 text-lg"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Grid de Productos de Limón */}
                    <div className="flex-1 overflow-y-auto pr-2 pb-2">
                        {productosFiltrados.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                                <ShoppingCart className="h-24 w-24" />
                                <p className="text-xl font-medium">No hay productos que coincidan</p>
                                <p className="text-sm">Intenta con otros filtros o términos de búsqueda</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                                {productosFiltrados.map((producto) => (
                                    <ProductoLimonCard
                                        key={producto.id}
                                        producto={producto}
                                        stockDisponible={stock[producto.id] || 0}
                                        onAgregar={agregarAlCarrito}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMNA DERECHA: CARRITO (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col h-full gap-4">
                    <Card className="flex flex-col h-full border-l-4 border-l-primary shadow-lg overflow-hidden">
                        {/* Header del Carrito */}
                        <CardHeader className="bg-slate-50 pb-4 border-b">
                            <div className="flex items-center justify-between mb-4">
                                <CardTitle className="flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5 text-primary" />
                                    Ticket de Venta Limón
                                </CardTitle>
                                <Badge variant={carrito.length > 0 ? "default" : "secondary"}>
                                    {totalArticulos} artículos
                                </Badge>
                            </div>

                            {/* Selección de Cliente */}
                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                                <User className="h-5 w-5 text-muted-foreground ml-2" />
                                <Select value={clienteId} onValueChange={setClienteId}>
                                    <SelectTrigger className="border-0 focus:ring-0 h-10 font-semibold text-lg">
                                        <SelectValue placeholder="Seleccionar Cliente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mostrador" className="font-bold">
                                            🛍️ Público General (Mostrador)
                                        </SelectItem>
                                        <Separator className="my-2" />
                                        {clientes.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>

                        {/* Lista de Items */}
                        <CardContent className="flex-1 overflow-y-auto p-0">
                            {carrito.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                                    <ShoppingCart className="h-24 w-24" />
                                    <p className="text-xl font-medium">Su carrito está vacío</p>
                                    <p className="text-sm">Agregue productos del catálogo para comenzar</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {carrito.map((item) => (
                                        <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-3 items-center group">
                                            <div className={cn(
                                                "h-12 w-12 rounded-lg border flex items-center justify-center text-2xl shadow-sm",
                                                item.tipo_limon === 'verde' ? 'bg-green-50' :
                                                    item.tipo_limon === 'alimonado' ? 'bg-yellow-50' :
                                                        item.tipo_limon === 'amarillo' ? 'bg-amber-50' : 'bg-slate-50'
                                            )}>
                                                {item.empaque === 'arpilla' ? '🧺' : '📦'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div>
                                                        <p className="font-bold text-slate-800 truncate pr-2">
                                                            {item.nombre}
                                                        </p>
                                                        <div className="flex gap-1 mt-1">
                                                            <Badge variant="outline" className="text-xs capitalize">
                                                                {item.tipo_limon}
                                                            </Badge>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {item.calibre}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <p className="font-bold text-slate-900">
                                                        ${(item.cantidad * item.precio_venta).toLocaleString()}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            className="w-16 h-8 border rounded px-2 text-center font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none"
                                                            value={item.precio_venta}
                                                            onChange={(e) => actualizarItem(item.id, { precio_venta: parseFloat(e.target.value) || 0 })}
                                                            onClick={(e) => e.currentTarget.select()}
                                                        />
                                                        <span className="text-muted-foreground">x unidad</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center gap-1 ml-2">
                                                <div className="flex items-center bg-white rounded-lg border shadow-sm">
                                                    <button
                                                        className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-600 rounded-l-lg active:bg-slate-200"
                                                        onClick={() => actualizarItem(item.id, { cantidad: Math.max(1, item.cantidad - 1) })}
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-8 text-center font-bold text-sm select-none">
                                                        {item.cantidad}
                                                    </span>
                                                    <button
                                                        className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-green-600 rounded-r-lg active:bg-green-100"
                                                        onClick={() => actualizarItem(item.id, { cantidad: item.cantidad + 1 })}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <button
                                                    className="text-xs text-rose-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => eliminarDelCarrito(item.id)}
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>

                        {/* Footer de Totales y Pago */}
                        <div className="p-6 bg-slate-50 border-t space-y-4">
                            <div className="flex justify-between items-center text-lg">
                                <span className="text-muted-foreground font-medium">Total a Pagar</span>
                                <span className="text-3xl font-bold text-primary">
                                    ${totalVenta.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className="h-14 text-base border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                    onClick={limpiarCarrito}
                                    disabled={carrito.length === 0}
                                >
                                    <Trash2 className="h-5 w-5 mr-2" />
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={() => setModalCobroOpen(true)}
                                    disabled={carrito.length === 0}
                                    className="h-14 text-lg font-bold shadow-md hover:shadow-lg transition-all"
                                >
                                    <CreditCard className="h-6 w-6 mr-2" />
                                    Cobrar
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- MODAL DE COBRO --- */}
            <Dialog open={modalCobroOpen} onOpenChange={setModalCobroOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl">
                            <Calculator className="h-6 w-6 text-primary" />
                            Procesar Pago
                        </DialogTitle>
                        <DialogDescription>
                            Resumen de la venta para {clienteActual?.nombre}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="flex justify-between items-end border-b pb-4">
                            <span className="text-lg font-medium">Total a Pagar:</span>
                            <span className="text-4xl font-bold text-slate-900">
                                ${totalVenta.toLocaleString()}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-base">Monto Recibido</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">$</span>
                                <Input
                                    type="number"
                                    className="pl-10 h-16 text-3xl font-bold font-mono"
                                    placeholder="0.00"
                                    value={montoRecibido}
                                    onChange={(e) => setMontoRecibido(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Botones rápidos de efectivo */}
                            <div className="flex gap-2 justify-center">
                                {[500, 1000, 2000, 5000].map(amt => (
                                    <Button
                                        key={amt}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMontoRecibido(amt.toString())}
                                        className="flex-1"
                                    >
                                        ${amt}
                                    </Button>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setMontoRecibido(totalVenta.toString())}
                                    className="flex-1 bg-slate-100 font-bold"
                                >
                                    Exacto
                                </Button>
                            </div>
                        </div>

                        <div className={cn(
                            "p-4 rounded-xl flex justify-between items-center transition-colors",
                            cambio >= 0 ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
                        )}>
                            <span className="font-semibold text-lg">Cambio:</span>
                            <span className="text-3xl font-bold font-mono">
                                ${cambio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Label>Método de Pago:</Label>
                            <Select value={metodoPago} onValueChange={setMetodoPago}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                                    <SelectItem value="tarjeta">💳 Tarjeta</SelectItem>
                                    <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                                    <SelectItem value="credito">📝 Crédito</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setModalCobroOpen(false)}>
                            Volver
                        </Button>
                        <Button
                            className="w-full sm:w-auto h-12 text-lg px-8"
                            onClick={handleCobrar}
                            disabled={loading || (parseFloat(montoRecibido) < totalVenta && metodoPago === "efectivo")}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                "Confirmar Pago"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- TICKET MODAL --- */}
            <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-center">¡Venta Exitosa!</DialogTitle>
                    </DialogHeader>

                    <div className="bg-white p-6 rounded shadow-sm border border-slate-100 text-center space-y-4 font-mono text-sm max-h-[60vh] overflow-y-auto">
                        <div className="border-b pb-4 mb-4 border-dashed border-slate-300">
                            <h3 className="font-bold text-lg">JBM Limones</h3>
                            <p>Central de Abastos CDMX</p>
                            <p className="text-xs text-muted-foreground">{new Date().toLocaleString()}</p>
                            <p className="text-xs mt-1">Ticket: {ticketData?.numero_venta || "PENDIENTE"}</p>
                            <p className="text-xs">Cliente: {ticketData?.cliente?.nombre || "Público General"}</p>
                        </div>

                        <div className="space-y-2 text-left">
                            {ticketData?.items.map((item: any) => (
                                <div key={item.id} className="flex justify-between items-start border-b pb-2 border-dashed">
                                    <div className="flex-1">
                                        <span className="font-medium">{item.cantidad} x {item.nombre}</span>
                                        <div className="text-xs text-muted-foreground flex gap-1">
                                            <span>{item.tipo_limon}</span>
                                            <span>•</span>
                                            <span>{item.calibre}</span>
                                        </div>
                                    </div>
                                    <span className="font-bold">${(item.cantidad * item.precio_venta).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-dashed border-slate-300 pt-4 mt-4 space-y-1">
                            <div className="flex justify-between font-bold text-base">
                                <span>TOTAL</span>
                                <span>${ticketData?.total?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Efectivo</span>
                                <span>${ticketData?.recibido?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-800 font-semibold">
                                <span>Cambio</span>
                                <span>${ticketData?.cambio?.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="pt-6 text-center text-xs text-muted-foreground">
                            <p>¡Gracias por su compra!</p>
                            <p className="mt-1">JBM Limones - Calidad garantizada</p>
                        </div>
                    </div>

                    <DialogFooter className="flex-col gap-2">
                        <Button className="w-full" size="lg" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir Ticket
                        </Button>
                        <Button variant="ghost" className="w-full" onClick={() => setTicketOpen(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}