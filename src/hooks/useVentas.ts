import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface Producto {
    id: string;
    nombre: string;
    peso_kg: number;
    tipo: string;
    precio_sugerido?: number; // In memory or from a future column
}

export interface CartItem extends Producto {
    cantidad: number;
    precio_venta: number;
}

export interface Cliente {
    id: string;
    nombre: string;
    tipo: string;
}

export function useVentas() {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [carrito, setCarrito] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);

    const [stock, setStock] = useState<Record<string, number>>({});

    // Cargar datos iniciales
    useEffect(() => {
        cargarProductos();
        cargarClientes();
        cargarStock();
    }, []);

    const cargarProductos = async () => {
        try {
            const { data, error } = await supabase
                .from("presentaciones")
                .select("*")
                .eq("activa", true)
                .order("nombre");

            if (error) throw error;

            // Mock precios sugeridos por ahora ya que no existen en DB
            const productosConPrecio = data?.map(p => ({
                ...p,
                precio_sugerido: p.tipo === "arpilla" ? 150 : 200 // Default prices
            })) || [];

            setProductos(productosConPrecio);
        } catch (error) {
            console.error("Error cargando productos:", error);
            toast.error("Error al cargar productos");
        }
    };

    const cargarClientes = async () => {
        try {
            const { data, error } = await supabase
                .from("clientes")
                .select("id, nombre, tipo")
                .order("nombre");

            if (error) throw error;
            setClientes(data || []);
        } catch (error) {
            console.error("Error cargando clientes:", error);
        }
    };

    const cargarStock = async () => {
        try {
            // Query to sum available quantity per presentation from camara_fria
            const { data, error } = await supabase
                .from("camara_fria")
                .select(`
          cantidad_disponible,
          produccion:produccion_id (
            presentacion_id
          )
        `);

            if (error) throw error;

            // Aggregate stock by presentacion_id
            const stockMap: Record<string, number> = {};
            data?.forEach((item: any) => {
                const pId = item.produccion?.presentacion_id;
                if (pId) {
                    stockMap[pId] = (stockMap[pId] || 0) + (item.cantidad_disponible || 0);
                }
            });

            setStock(stockMap);
        } catch (error) {
            console.error("Error cargando stock:", error);
        }
    };

    const agregarAlCarrito = (producto: Producto) => {
        const stockDisponible = stock[producto.id] || 0;
        const itemEnCarrito = carrito.find(item => item.id === producto.id);
        const cantidadActual = itemEnCarrito?.cantidad || 0;

        if (cantidadActual + 1 > stockDisponible) {
            toast.error("Stock insuficiente", {
                description: `Solo hay ${stockDisponible} unidades disponibles.`
            });
            return;
        }

        if (itemEnCarrito) {
            setCarrito(carrito.map(item =>
                item.id === producto.id
                    ? { ...item, cantidad: item.cantidad + 1 }
                    : item
            ));
        } else {
            setCarrito([...carrito, {
                ...producto,
                cantidad: 1,
                precio_venta: producto.precio_sugerido || 0
            }]);
        }
    };

    const actualizarItem = (id: string, cambios: Partial<CartItem>) => {
        // Validate stock if quantity is changing
        if (cambios.cantidad) {
            const stockDisponible = stock[id] || 0;
            if (cambios.cantidad > stockDisponible) {
                toast.error("No hay suficiente stock");
                return;
            }
        }

        setCarrito(carrito.map(item =>
            item.id === id ? { ...item, ...cambios } : item
        ));
    };

    const eliminarDelCarrito = (id: string) => {
        setCarrito(carrito.filter(item => item.id !== id));
    };

    const limpiarCarrito = () => setCarrito([]);

    const cobrar = async (clienteId: string | null, montoRecibido: number, metodoPago: string) => {
        if (carrito.length === 0) return;
        setLoading(true);

        try {
            const montoTotal = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0);

            const itemsPayload = carrito.map(item => ({
                presentacion_id: item.id,
                cantidad: item.cantidad,
                precio: item.precio_venta
            }));

            // Call RPC function
            const { data: ventaId, error } = await supabase.rpc('process_sale_with_inventory', {
                p_cliente_id: clienteId,
                p_monto_total: montoTotal,
                p_metodo_pago: metodoPago,
                p_items: itemsPayload
            });

            if (error) throw error;

            // Fetch the created sale to return it (for the ticket)
            const { data: ventaData } = await supabase
                .from('ventas')
                .select('*')
                .eq('id', ventaId)
                .single();

            toast.success("Venta registrada correctamente", {
                description: `Ticket #${ventaData?.numero_venta}`
            });

            limpiarCarrito();
            cargarStock(); // Refresh stock
            return ventaData;

        } catch (error: any) {
            console.error("Error al cobrar:", error);
            toast.error("Error al procesar la venta", {
                description: error.data?.message || error.message
            });
        } finally {
            setLoading(false);
        }
    };

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
        cobrar
    };
}
