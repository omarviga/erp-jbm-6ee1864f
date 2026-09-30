import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { normalizarNombreMostrador } from "@/lib/presentacionNombre";

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

type InventarioBodegaCDMXRow = Database["public"]["Tables"]["inventario_bodega_cdmx"]["Row"];
type ProcesarVentaCDMXResult = Database["public"]["Functions"]["procesar_venta_cdmx"]["Returns"][number];
type VentaRow = Database["public"]["Tables"]["ventas"]["Row"];
type PresentacionResumen = Pick<Producto, "id" | "nombre" | "peso_kg" | "tipo"> & {
    activa?: boolean | null;
};
type RpcErrorLike = {
    code?: string;
    message?: string;
    data?: {
        message?: string;
    };
};

const esProductoAGranel = (producto: Pick<Producto, "tipo" | "nombre">) =>
    producto.tipo?.toLowerCase().includes("granel")
    || producto.nombre?.toLowerCase().includes("granel");

const redondearCantidad = (cantidad: number) => Math.round(cantidad * 100) / 100;

export function useVentas() {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [carrito, setCarrito] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);

    const [stock, setStock] = useState<Record<string, number>>({});

    // Mantiene siempre la referencia a la última versión de refrescarCatalogoPOS
    // para que el effect de montaje no dependa de su identidad (cambia en cada render).
    const refrescarCatalogoPOSRef = useRef<() => Promise<void>>(async () => {});

    useEffect(() => {
        refrescarCatalogoPOSRef.current = refrescarCatalogoPOS;
    });

    useEffect(() => {
        void refrescarCatalogoPOSRef.current();

        const onFocus = () => {
            void refrescarCatalogoPOSRef.current();
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);

        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onFocus);
        };
    }, []);

    const mergeProductosConInventario = (
        productosBase: Producto[],
        stockData: {
            stockMap: Record<string, number>;
            preciosMap: Record<string, number>;
            inventarioIdMap: Record<string, string>;
            productosInventarioMap: Record<string, PresentacionResumen>;
        }
    ) => {
        const productosMap = new Map<string, Producto>();

        productosBase.forEach((producto) => {
            productosMap.set(producto.id, {
                ...producto,
                nombre: normalizarNombreMostrador(producto.nombre),
                precio_sugerido: stockData.preciosMap[producto.id] ?? producto.precio_sugerido,
                inventario_id: stockData.inventarioIdMap[producto.id] ?? producto.inventario_id,
            });
        });

        Object.entries(stockData.productosInventarioMap).forEach(([productoId, productoInventario]) => {
            if (productosMap.has(productoId)) return;

            productosMap.set(productoId, {
                id: productoInventario.id,
                nombre: normalizarNombreMostrador(productoInventario.nombre),
                peso_kg: Number(productoInventario.peso_kg || 0),
                tipo: productoInventario.tipo || "",
                precio_sugerido: stockData.preciosMap[productoId] ?? 0,
                inventario_id: stockData.inventarioIdMap[productoId],
            });
        });

        return Array.from(productosMap.values())
            .filter((producto) => (stockData.stockMap[producto.id] || 0) > 0)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-MX"))
            .map((producto) => ({
            ...producto,
            precio_sugerido: stockData.preciosMap[producto.id] ?? producto.precio_sugerido,
            inventario_id: stockData.inventarioIdMap[producto.id] ?? producto.inventario_id,
        }));
    };

    const refrescarCatalogoPOS = async () => {
        try {
            const [productosBase, stockData] = await Promise.all([
                cargarProductos(),
                cargarStock()
            ]);

            setStock(stockData.stockMap);
            setProductos(mergeProductosConInventario(productosBase, stockData));
        } catch (error) {
            console.error("Error cargando datos iniciales POS:", error);
        } finally {
            await cargarClientes();
        }
    };

    const cargarProductos = async (): Promise<Producto[]> => {
        try {
            const { data, error } = await supabase
                .from("presentaciones")
                .select("*")
                .eq("activa", true)
                .order("nombre");

            if (error) throw error;

            // Mock precios sugeridos por ahora ya que no existen en DB
            return data?.map(p => ({
                ...p,
                precio_sugerido: p.tipo === "arpilla" ? 150 : 200 // Default prices
            })) || [];
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

    const cargarStock = async () => {
        try {
            // Query CDMX inventory instead of camara_fria
            const { data, error } = await supabase
                .from("inventario_bodega_cdmx")
                .select(`
                    id,
                    cantidad_disponible,
                    precio_venta,
                    presentacion_id,
                    presentacion:presentaciones (
                        id,
                        nombre,
                        peso_kg,
                        tipo,
                        activa
                    )
                `)
                .gt("cantidad_disponible", 0);

            if (error) throw error;

            // Aggregate stock and map IDs
            const stockMap: Record<string, number> = {};
            const preciosAcumulados: Record<string, number> = {};
            const inventarioIdMap: Record<string, string> = {};
            const productosInventarioMap: Record<string, PresentacionResumen> = {};
            
            data?.forEach((item: Pick<InventarioBodegaCDMXRow, "id" | "cantidad_disponible" | "precio_venta" | "presentacion_id"> & {
                presentacion?: PresentacionResumen | null;
            }) => {
                const pId = item.presentacion_id;
                if (pId) {
                    const cantidad = Number(item.cantidad_disponible || 0);
                    const precioVenta = Number(item.precio_venta || 0);

                    stockMap[pId] = redondearCantidad((stockMap[pId] || 0) + cantidad);
                    preciosAcumulados[pId] = (preciosAcumulados[pId] || 0) + (precioVenta * cantidad);
                    if (!inventarioIdMap[pId] && item.id) {
                        inventarioIdMap[pId] = item.id;
                    }
                    if (!productosInventarioMap[pId] && item.presentacion) {
                        productosInventarioMap[pId] = {
                            id: item.presentacion.id,
                            nombre: item.presentacion.nombre,
                            peso_kg: Number(item.presentacion.peso_kg || 0),
                            tipo: item.presentacion.tipo || "",
                            activa: item.presentacion.activa,
                        };
                    }
                }
            });

            const preciosMap = Object.entries(stockMap).reduce((acc, [presentacionId, cantidad]) => {
                if (cantidad > 0) {
                    acc[presentacionId] = preciosAcumulados[presentacionId] / cantidad;
                }
                return acc;
            }, {} as Record<string, number>);

            return {
                stockMap,
                preciosMap,
                inventarioIdMap,
                productosInventarioMap,
            };
        } catch (error) {
            console.error("Error cargando stock CDMX:", error);
            return {
                stockMap: {},
                preciosMap: {},
                inventarioIdMap: {},
                productosInventarioMap: {},
            };
        }
    };

    const refrescarStock = async () => {
        const stockData = await cargarStock();
        setStock(stockData.stockMap);
        const productosBase = await cargarProductos();
        setProductos(mergeProductosConInventario(productosBase, stockData));
    };

    const agregarAlCarrito = (producto: Producto) => {
        const stockDisponible = stock[producto.id] || 0;
        const itemEnCarrito = carrito.find(item => item.id === producto.id);
        const cantidadActual = itemEnCarrito?.cantidad || 0;
        const incremento = esProductoAGranel(producto) ? 1 : 1;

        if (redondearCantidad(cantidadActual + incremento) > stockDisponible) {
            toast.error("Stock insuficiente", {
                description: `Solo hay ${stockDisponible} unidades disponibles.`
            });
            return;
        }

        if (itemEnCarrito) {
            setCarrito(carrito.map(item =>
                item.id === producto.id
                    ? { ...item, cantidad: redondearCantidad(item.cantidad + incremento) }
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
        const itemActual = carrito.find((item) => item.id === id);
        if (!itemActual) return;

        const cambiosNormalizados = { ...cambios };

        if (typeof cambios.cantidad === "number") {
            const stockDisponible = stock[id] || 0;
            const cantidadNormalizada = esProductoAGranel(itemActual)
                ? redondearCantidad(cambios.cantidad)
                : Math.round(cambios.cantidad);

            if (cantidadNormalizada <= 0) {
                toast.error("La cantidad debe ser mayor a cero");
                return;
            }

            if (cantidadNormalizada > stockDisponible) {
                toast.error("No hay suficiente stock");
                return;
            }

            cambiosNormalizados.cantidad = cantidadNormalizada;
        }

        setCarrito(carrito.map(item =>
            item.id === id ? { ...item, ...cambiosNormalizados } : item
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

    const extraerMensajeError = (error: unknown) => {
        if (error && typeof error === "object") {
            const errorLike = error as RpcErrorLike;
            return errorLike.data?.message || errorLike.message || "Error desconocido";
        }
        return "Error desconocido";
    };

    const esRpcNoDisponible = (error: unknown) => {
        if (!error || typeof error !== "object") return false;
        const errorLike = error as RpcErrorLike;
        return errorLike.code === "PGRST202" || String(errorLike.message || "").includes("Could not find the function");
    };

    const procesarVentaConCliente = async (
        montoTotal: number,
        metodoPago: string,
        itemsPayload: { inventario_id: string; cantidad: number; precio_venta: number }[],
        clienteId: string
    ) => {
        return supabase.rpc('procesar_venta_cdmx' as never, {
            p_monto_total: montoTotal,
            p_metodo_pago: metodoPago,
            p_items: itemsPayload as unknown as Json,
            p_cliente_id: clienteId,
        } as never);
    };

    const procesarVentaSinCliente = async (
        montoTotal: number,
        metodoPago: string,
        itemsPayload: { inventario_id: string; cantidad: number; precio_venta: number }[]
    ) => {
        return supabase.rpc('procesar_venta_cdmx', {
            p_monto_total: montoTotal,
            p_metodo_pago: metodoPago,
            p_items: itemsPayload as unknown as Json
        });
    };

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
                        cantidad: redondearCantidad(tomar),
                        precio_venta: item.precio_venta
                    });
                    pendiente = redondearCantidad(pendiente - tomar);
                }

                if (pendiente > 0) {
                    throw new Error(`Stock insuficiente para ${item.nombre}. Faltan ${pendiente} unidades.`);
                }
            }

            const clienteFinalId = clienteId || getClienteFallbackId();

            if (!clienteFinalId) {
                throw new Error("No existe un cliente válido para POS. Crea/configura 'Público en general'.");
            }

            let data: ProcesarVentaCDMXResult[] | null = null;
            let error: RpcErrorLike | null = null;

            // Prefer the newer RPC signature with cliente_id; fall back if the DB is older.
            {
                const rpcResponse = await procesarVentaConCliente(montoTotal, metodoPago, itemsPayload, clienteFinalId);
                data = rpcResponse.data as ProcesarVentaCDMXResult[] | null;
                error = rpcResponse.error;
            }

            if (error && esRpcNoDisponible(error)) {
                const rpcResponse = await procesarVentaSinCliente(montoTotal, metodoPago, itemsPayload);
                data = rpcResponse.data;
                error = rpcResponse.error;
            }

            if (error && esRpcNoDisponible(error)) {
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
                .single<VentaRow>();

            toast.success("Venta registrada correctamente", {
                description: `Ticket #${ventaData?.numero_venta}`
            });

            limpiarCarrito();
            await refrescarStock();
            return ventaData;

        } catch (error: unknown) {
            console.error("Error al cobrar:", error);
            toast.error("Error al procesar la venta", {
                description: extraerMensajeError(error)
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
