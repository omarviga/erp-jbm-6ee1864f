import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Producto {
    id: string;
    nombre: string;
    peso_kg: number;
    tipo: string;
    precio_sugerido?: number;
    inventario_id?: string;
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
            // Query CDMX inventory instead of camara_fria
            const { data, error } = await supabase
                .from("inventario_bodega_cdmx")
                .select(`
                    id,
                    cantidad_disponible,
                    precio_venta,
                    presentacion_id
                `)
                .gt("cantidad_disponible", 0);

            if (error) throw error;

            // Aggregate stock and map IDs
            const stockMap: Record<string, number> = {};
            // Also update products with their real precio_venta from CDMX inventory
            const preciosMap: Record<string, number> = {};
            
            data?.forEach((item: any) => {
                const pId = item.presentacion_id;
                if (pId) {
                    stockMap[pId] = (stockMap[pId] || 0) + (item.cantidad_disponible || 0);
                    // Use the first valid precio_venta found for this presentation
                    if (!preciosMap[pId] && item.precio_venta) {
                        preciosMap[pId] = item.precio_venta;
                    }
                }
            });

            setStock(stockMap);
            
            // Update product prices if we have them
            setProductos(prev => prev.map(p => ({
                ...p,
                precio_sugerido: preciosMap[p.id] || p.precio_sugerido,
                inventario_id: data?.find(i => i.presentacion_id === p.id)?.id // Store one valid inventory ID for the sale payload
            })));
        } catch (error) {
            console.error("Error cargando stock CDMX:", error);
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

    const getClienteFallbackId = () => {
        if (clientes.length === 0) return null;
        const publico = clientes.find((c) => {
            const n = c.nombre.trim().toLowerCase();
            return n === "público en general" || n === "publico en general";
        });
        return (clienteIdCache(publico?.id) || clienteIdCache(clientes[0]?.id));
    };

    const clienteIdCache = (id?: string | null) => id || null;

    const cobrar = async (clienteId: string | null, montoRecibido: number, metodoPago: string) => {
        if (carrito.length === 0) return;
        setLoading(true);

        try {
            const montoTotal = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0);

            // Build payload by looking up inventory IDs (FIFO) for each cart item
            const itemsPayload: { inventario_id: string; cantidad: number; precio_venta: number }[] = [];

            for (const item of carrito) {
                // Get all inventory rows with stock for this presentacion, ordered FIFO
                const { data: invRows, error: invError } = await supabase
                    .from("inventario_bodega_cdmx")
                    .select("id, cantidad_disponible, precio_base")
                    .eq("presentacion_id", item.id)
                    .gt("cantidad_disponible", 0)
                    .order("fecha_ingreso", { ascending: true });

                if (invError) throw invError;
                if (!invRows || invRows.length === 0) {
                    throw new Error(`No hay inventario disponible para ${item.nombre}`);
                }

                // Distribute the requested quantity across inventory rows (FIFO)
                let pendiente = item.cantidad;
                for (const row of invRows) {
                    if (pendiente <= 0) break;
                    const tomar = Math.min(pendiente, row.cantidad_disponible);
                    itemsPayload.push({
                        inventario_id: row.id,
                        cantidad: tomar,
                        precio_venta: item.precio_venta
                    });
                    pendiente -= tomar;
                }

                if (pendiente > 0) {
                    throw new Error(`Stock insuficiente para ${item.nombre}. Faltan ${pendiente} unidades.`);
                }
            }

            const clienteFinalId = clienteId || getClienteFallbackId();

            if (!clienteFinalId) {
                throw new Error("No existe un cliente válido para POS. Crea/configura 'Público en general'.");
            }

            let data: any = null;
            let error: any = null;

            // Prefer the newer RPC signature with cliente_id; fall back if the DB is older.
            ({ data, error } = await (supabase as any).rpc('procesar_venta_cdmx', {
                p_monto_total: montoTotal,
                p_metodo_pago: metodoPago,
                p_items: itemsPayload,
                p_cliente_id: clienteFinalId,
            }));

            if (error && (error.code === 'PGRST202' || String(error.message || '').includes('Could not find the function'))) {
                ({ data, error } = await supabase.rpc('procesar_venta_cdmx', {
                    p_monto_total: montoTotal,
                    p_metodo_pago: metodoPago,
                    p_items: itemsPayload
                }));
            }

            if (error && (error.code === 'PGRST202' || String(error.message || '').includes('Could not find the function'))) {
                throw new Error("Tu base de datos no tiene la migración POS más reciente. Aplica las migraciones para procesar ventas sin cliente_id nulo.");
            }

            if (error) throw error;

            const rpcResult = Array.isArray(data) ? data[0] : null;
            if (!rpcResult?.success || !rpcResult?.venta_id) {
                throw new Error(rpcResult?.mensaje || "No se pudo procesar la venta");
            }

            // Fetch the created sale to return it (for the ticket)
            const { data: ventaData } = await supabase
                .from('ventas')
                .select('*')
                .eq('id', rpcResult.venta_id)
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
