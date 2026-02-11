import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client"; // CORREGIDO: agregar barra después del @
import { useToast } from "@/hooks/use-toast";

interface Producto {
    id: string;
    nombre: string;
    tipo: string;
    peso_kg: number;
    precio_sugerido: number; // Nota: también necesitas agregar este campo
}

interface Cliente {
    id: string;
    nombre: string;
    tipo: string;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
    dias_credito?: number | null;
    limite_credito?: number | null;
    saldo_deudor?: number | null;
}

interface ItemCarrito extends Producto {
    cantidad: number;
    precio_venta: number;
}

export function useVentas() {
    const { toast } = useToast();
    const [productos, setProductos] = useState<Producto[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
    const [stock, setStock] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);

    // Cargar presentaciones como productos
    useEffect(() => {
        const cargarProductos = async () => {
            const { data, error } = await supabase
                .from("presentaciones")
                .select("*")
                .eq("activa", true);

            if (error) {
                console.error("Error cargando productos:", error);
                return;
            }

            if (data) {
                setProductos(
                    data.map((p) => ({
                        id: p.id,
                        nombre: p.nombre,
                        tipo: p.tipo,
                        peso_kg: p.peso_kg,
                        precio_sugerido: p.peso_kg * 15, // Precio base por kg
                    }))
                );
            }
        };

        cargarProductos();
    }, []);

    // Cargar clientes
    useEffect(() => {
        const cargarClientes = async () => {
            const { data, error } = await supabase
                .from("clientes")
                .select("*")
                .order("nombre");

            if (error) {
                console.error("Error cargando clientes:", error);
                return;
            }

            if (data) {
                setClientes(data);
            }
        };

        cargarClientes();
    }, []);

    // Cargar stock disponible de cámara fría
    useEffect(() => {
        const cargarStock = async () => {
            const { data, error } = await supabase
                .from("camara_fria")
                .select(`
          cantidad_disponible,
          produccion:produccion_id (
            presentacion_id
          )
        `);

            if (error) {
                console.error("Error cargando stock:", error);
                return;
            }

            if (data) {
                const stockPorPresentacion: Record<string, number> = {};
                data.forEach((item: any) => {
                    if (item.produccion?.presentacion_id) {
                        const presId = item.produccion.presentacion_id;
                        stockPorPresentacion[presId] = (stockPorPresentacion[presId] || 0) + item.cantidad_disponible;
                    }
                });
                setStock(stockPorPresentacion);
            }
        };

        cargarStock();
    }, []);

    const agregarAlCarrito = useCallback((producto: Producto) => {
        setCarrito((prev) => {
            const existente = prev.find((item) => item.id === producto.id);
            if (existente) {
                return prev.map((item) =>
                    item.id === producto.id
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item
                );
            }
            return [
                ...prev,
                {
                    ...producto,
                    cantidad: 1,
                    precio_venta: producto.precio_sugerido,
                },
            ];
        });
    }, []);

    const actualizarItem = useCallback(
        (id: string, updates: Partial<ItemCarrito>) => {
            setCarrito((prev) =>
                prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
            );
        },
        []
    );

    const eliminarDelCarrito = useCallback((id: string) => {
        setCarrito((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const limpiarCarrito = useCallback(() => {
        setCarrito([]);
    }, []);

    const cobrar = useCallback(
        async (
            clienteId: string | null,
            montoRecibido: number,
            metodoPago: string
        ) => {
            if (carrito.length === 0) {
                toast({
                    title: "Error",
                    description: "El carrito está vacío",
                    variant: "destructive",
                });
                return null;
            }

            setLoading(true);

            try {
                // Generar número de venta
                const fecha = new Date();
                const numeroVenta = `V${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, "0")}${String(fecha.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

                const total = carrito.reduce(
                    (sum, item) => sum + item.cantidad * item.precio_venta,
                    0
                );

                // Crear venta
                const { data: venta, error: ventaError } = await supabase
                    .from("ventas")
                    .insert({
                        numero_venta: numeroVenta,
                        cliente_id: clienteId,
                        tipo: "mostrador",
                        total,
                        pagado: metodoPago !== "credito",
                    })
                    .select()
                    .single();

                if (ventaError) throw ventaError;

                // Crear detalles de venta
                const detalles = carrito.map((item) => ({
                    venta_id: venta.id,
                    descripcion: `${item.nombre} (${item.peso_kg}kg)`,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_venta,
                }));

                const { error: detallesError } = await supabase
                    .from("venta_detalles")
                    .insert(detalles);

                if (detallesError) throw detallesError;

                // Si hay pago, registrarlo
                if (clienteId && metodoPago !== "credito") {
                    await supabase.from("pagos_clientes").insert({
                        cliente_id: clienteId,
                        venta_id: venta.id,
                        monto: total,
                        forma_pago: metodoPago === "tarjeta" ? "transferencia" : metodoPago as "efectivo" | "cheque" | "transferencia",
                    });
                }

                toast({
                    title: "Venta completada",
                    description: `Venta ${numeroVenta} registrada correctamente`,
                });

                limpiarCarrito();
                return venta;
            } catch (error) {
                console.error("Error procesando venta:", error);
                toast({
                    title: "Error",
                    description: "No se pudo procesar la venta",
                    variant: "destructive",
                });
                return null;
            } finally {
                setLoading(false);
            }
        },
        [carrito, toast, limpiarCarrito]
    );

    return {
        productos,
        clientes,
        carrito,
        stock,
        loading,
        agregarAlCarrito,
        actualizarItem,
        eliminarDelCarrito,
        limpiarCarrito,
        cobrar,
    };
}