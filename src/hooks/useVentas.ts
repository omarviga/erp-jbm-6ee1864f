import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

export interface Producto {
    id: string;
    nombre: string;
    peso_kg: number;
    tipo: string;
    precio_sugerido?: number;
    precio_base?: number;
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

const POS_PUBLIC_CLIENT_NAMES = ["publico en general", "público en general"];

type InventarioCDMXRow = Pick<
    Database["public"]["Tables"]["inventario_bodega_cdmx"]["Row"],
    "id" | "cantidad_disponible" | "precio_base" | "precio_venta" | "presentacion_id"
>;

type ProcesarVentaResult = Database["public"]["Functions"]["procesar_venta_cdmx"]["Returns"][number];
type ProcesarVentaArgs = Database["public"]["Functions"]["procesar_venta_cdmx"]["Args"];

const extractSupabaseErrorText = (error: { message?: string; details?: string; hint?: string }) =>
    `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

export function useVentas() {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [carrito, setCarrito] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);

    const [stock, setStock] = useState<Record<string, number>>({});

    const procesarVentaCDMX = async (args: ProcesarVentaArgs) => {
        const { data, error } = await supabase.rpc("procesar_venta_cdmx", args);

        if (!error) {
            return { data, error: null };
        }

        const errorMessage = extractSupabaseErrorText(error);
        const canRetryWithoutCliente =
            "p_cliente_id" in args &&
            (
                errorMessage.includes("p_cliente_id") ||
                errorMessage.includes("schema cache") ||
                errorMessage.includes("function public.procesar_venta_cdmx") ||
                errorMessage.includes("could not find the function")
            );

        if (!canRetryWithoutCliente) {
            return { data: null, error };
        }

        const { p_cliente_id: _ignored, ...legacyArgs } = args;
        const legacyResponse = await supabase.rpc("procesar_venta_cdmx", legacyArgs);

        if (!legacyResponse.error) {
            return legacyResponse;
        }

        const legacyErrorText = extractSupabaseErrorText(legacyResponse.error);
        const requiresPosMigration =
            legacyErrorText.includes("pagos_clientes") &&
            legacyErrorText.includes("cliente_id") &&
            (
                legacyErrorText.includes("null value") ||
                legacyErrorText.includes("not-null") ||
                legacyErrorText.includes("violates not-null constraint")
            );

        if (!requiresPosMigration) {
            return legacyResponse;
        }

        return {
            data: null,
            error: {
                ...legacyResponse.error,
                message: "La base de datos del POS CDMX esta desactualizada. Falta aplicar la migracion que corrige cliente_id en pagos_clientes.",
            },
        };
    };

    // Cargar datos iniciales
    useEffect(() => {
        const inicializar = async () => {
            const productosBase = await cargarProductos();
            await Promise.all([
                cargarClientes(),
                cargarStock(productosBase)
            ]);
        };

        void inicializar();
    }, []);

    const cargarProductos = async () => {
        try {
            const { data, error } = await supabase
                .from("presentaciones")
                .select("*")
                .eq("activa", true)
                .order("nombre");

            if (error) throw error;

            const productosConPrecio = data?.map(p => ({
                ...p,
                precio_sugerido: 0,
                precio_base: 0,
            })) || [];

            setProductos(productosConPrecio);
            return productosConPrecio;
        } catch (error) {
            console.error("Error cargando productos:", error);
            toast.error("Error al cargar productos");
            return [];
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

    const resolveClienteIdForPos = async (clienteId: string | null) => {
        if (clienteId) return clienteId;

        const clientePublico = clientes.find((cliente) =>
            POS_PUBLIC_CLIENT_NAMES.includes(cliente.nombre.trim().toLowerCase())
        );

        if (clientePublico?.id) {
            return clientePublico.id;
        }

        const { data, error } = await supabase
            .from("clientes")
            .select("id, nombre")
            .in("nombre", ["Público en general", "Publico en general"])
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data?.id) {
            throw new Error('No existe el cliente "Público en general" para registrar la venta');
        }

        return data.id;
    };

    const cargarStock = async (productosBase: Producto[] = []) => {
        try {
            // Query CDMX inventory instead of camara_fria
            const { data, error } = await supabase
                .from("inventario_bodega_cdmx")
                .select(`
                    id,
                    cantidad_disponible,
                    precio_base,
                    precio_venta,
                    presentacion_id
                `)
                .gt("cantidad_disponible", 0);

            if (error) throw error;

            // Aggregate stock and map IDs
            const stockMap: Record<string, number> = {};
            const preciosVentaMap: Record<string, number> = {};
            const preciosBaseMap: Record<string, number> = {};
            const inventarioIdMap: Record<string, string> = {};
            
            data?.forEach((item: InventarioCDMXRow) => {
                const pId = item.presentacion_id;
                if (pId) {
                    stockMap[pId] = (stockMap[pId] || 0) + (item.cantidad_disponible || 0);
                    preciosBaseMap[pId] = Math.max(preciosBaseMap[pId] || 0, item.precio_base || 0);
                    preciosVentaMap[pId] = Math.max(
                        preciosVentaMap[pId] || 0,
                        item.precio_venta || item.precio_base || 0
                    );
                    if (!inventarioIdMap[pId]) {
                        inventarioIdMap[pId] = item.id;
                    }
                }
            });

            setStock(stockMap);
             
            const productosOrigen = productosBase.length > 0 ? productosBase : productos;
            setProductos(productosOrigen.map(p => ({
                ...p,
                precio_base: preciosBaseMap[p.id] || p.precio_base || 0,
                precio_sugerido: preciosVentaMap[p.id] || preciosBaseMap[p.id] || p.precio_sugerido || 0,
                inventario_id: inventarioIdMap[p.id] || p.inventario_id
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
                precio_venta: Math.max(producto.precio_sugerido || 0, producto.precio_base || 0)
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

    const cobrar = async (_clienteId: string | null, _montoRecibido: number, metodoPago: string) => {
        if (carrito.length === 0) return;
        setLoading(true);

        try {
            const clienteIdForPos = await resolveClienteIdForPos(_clienteId);
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

            const { data, error } = await procesarVentaCDMX({
                p_cliente_id: clienteIdForPos,
                p_monto_total: montoTotal,
                p_metodo_pago: metodoPago,
                p_items: itemsPayload
            });

            if (error) throw error;

            const rpcResult: ProcesarVentaResult | null = Array.isArray(data) ? data[0] ?? null : data;
            if (!rpcResult?.success || !rpcResult?.venta_id) {
                throw new Error(rpcResult?.mensaje || "No se pudo procesar la venta");
            }

            // Fetch the created sale to return it (for the ticket)
            const { data: ventaData } = await supabase
                .from('ventas_cdmx')
                .select('*')
                .eq('id', rpcResult.venta_id)
                .single();

            toast.success("Venta registrada correctamente", {
                description: `Ticket #${ventaData?.numero_venta}`
            });

            limpiarCarrito();
            cargarStock(); // Refresh stock
            return ventaData;

        } catch (error) {
            console.error("Error al cobrar:", error);
            const description = error instanceof Error
                ? error.message
                : "No se pudo procesar la venta";
            toast.error("Error al procesar la venta", {
                description
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
