// src/hooks/useVentasLimon.ts
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProductoLimon, TipoLimon, Calibre, Empaque, TamanoArpilla, CartItemLimon } from "@/types/limon.types";

export function useVentasLimon() {
    const [productos, setProductos] = useState<ProductoLimon[]>([]);
    const [carrito, setCarrito] = useState<CartItemLimon[]>([]);
    const [loading, setLoading] = useState(false);
    const [stock, setStock] = useState<Record<string, number>>({});

    // Filtros específicos para limón
    const [filtroTipoLimon, setFiltroTipoLimon] = useState<TipoLimon | 'todos'>('todos');
    const [filtroCalibre, setFiltroCalibre] = useState<Calibre | 'todos'>('todos');
    const [filtroEmpaque, setFiltroEmpaque] = useState<Empaque | 'todos'>('todos');

    // Cargar productos específicos de limón
    const cargarProductosLimon = async () => {
        try {
            setLoading(true);

            // Cargar las presentaciones activas
            const { data: presentaciones, error: errorPresentaciones } = await supabase
                .from("presentaciones")
                .select("*")
                .eq("activa", true)
                .order("nombre");

            if (errorPresentaciones) throw errorPresentaciones;

            // Transformar las presentaciones a productos de limón
            const productosLimon: ProductoLimon[] = presentaciones.map((presentacion: any) => {
                // Extraer información del nombre para clasificar
                const nombre = presentacion.nombre.toLowerCase();

                // Detectar tipo de limón
                let tipo_limon: TipoLimon = 'verde';
                if (nombre.includes('alimonado')) tipo_limon = 'alimonado';
                else if (nombre.includes('amarillo')) tipo_limon = 'amarillo';
                else if (nombre.includes('economico')) tipo_limon = 'economico';

                // Detectar calibre
                let calibre: Calibre = 'X';
                if (nombre.includes('45')) calibre = '45';
                else if (nombre.includes('xx')) calibre = 'XX';
                else if (nombre.includes('xxx')) calibre = 'XXX';
                else if (nombre.includes('extra')) calibre = 'EXTRA';
                else if (nombre.includes('super')) calibre = 'SUPER';

                // Detectar empaque
                const empaque: Empaque = presentacion.tipo === 'arpilla' ? 'arpilla' : 'caja';

                // Detectar tamaño de arpilla
                let tamano_arpilla: TamanoArpilla | undefined = undefined;
                if (empaque === 'arpilla') {
                    if (nombre.includes('grande') || nombre.includes('gr')) tamano_arpilla = 'grande';
                    else if (nombre.includes('mediano') || nombre.includes('med')) tamano_arpilla = 'mediano';
                    else if (nombre.includes('chico') || nombre.includes('ch')) tamano_arpilla = 'chico';
                }

                // Calcular precio sugerido basado en la clasificación del documento
                const precio_sugerido = calcularPrecioSugerido(tipo_limon, calibre, empaque, tamano_arpilla);

                return {
                    id: presentacion.id,
                    nombre: presentacion.nombre,
                    descripcion: presentacion.descripcion || '',
                    tipo_limon,
                    calibre,
                    empaque,
                    tamano_arpilla,
                    peso_kg: presentacion.peso_kg || 0,
                    precio_base: presentacion.precio_base || 0,
                    precio_sugerido,
                    codigo: '50304100',
                    activa: presentacion.activa
                };
            });

            setProductos(productosLimon);

            // Cargar stock
            await cargarStockLimon();

        } catch (error: any) {
            console.error("Error cargando productos de limón:", error);
            toast.error("Error al cargar productos de limón");
        } finally {
            setLoading(false);
        }
    };

    // Función para calcular precios según el documento
    const calcularPrecioSugerido = (
        tipo: TipoLimon,
        calibre: Calibre,
        empaque: Empaque,
        tamano?: TamanoArpilla
    ): number => {
        // Precios base según el documento (por caja de 15kg)
        const preciosBase: Record<TipoLimon, Record<Calibre, number>> = {
            verde: {
                '45': 47.00,
                'X': 28.00,
                'XX': 35.00,
                'XXX': 53.00,
                'EXTRA': 32.00,
                'SUPER': 0
            },
            alimonado: {
                '45': 0,
                'X': 27.00,
                'XX': 54.00,
                'XXX': 61.00,
                'EXTRA': 48.00,
                'SUPER': 0
            },
            amarillo: {
                '45': 0,
                'X': 0,
                'XX': 0,
                'XXX': 4.00,
                'EXTRA': 0,
                'SUPER': 0
            },
            economico: {
                '45': 0,
                'X': 0,
                'XX': 0,
                'XXX': 0,
                'EXTRA': 0,
                'SUPER': 0
            }
        };

        let precio = preciosBase[tipo]?.[calibre] || 0;

        // Ajuste para arpillas (precios estimados basados en peso)
        if (empaque === 'arpilla' && precio > 0) {
            const peso = tamano === 'grande' ? 20 : tamano === 'mediano' ? 15 : 10;
            const precioPorKg = precio / 15; // Precio por kg (caja de 15kg)
            precio = precioPorKg * peso;
        }

        return precio;
    };

    // Cargar stock específico para productos de limón
    const cargarStockLimon = async () => {
        try {
            const { data, error } = await supabase
                .from("camara_fria")
                .select(`
          cantidad_disponible,
          produccion:produccion_id (
            presentacion_id
          )
        `);

            if (error) throw error;

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

    // Filtrar productos según los filtros activos
    const productosFiltrados = useMemo(() => {
        return productos.filter(producto => {
            // Filtro por tipo de limón
            if (filtroTipoLimon !== 'todos' && producto.tipo_limon !== filtroTipoLimon) {
                return false;
            }

            // Filtro por calibre
            if (filtroCalibre !== 'todos' && producto.calibre !== filtroCalibre) {
                return false;
            }

            // Filtro por empaque
            if (filtroEmpaque !== 'todos' && producto.empaque !== filtroEmpaque) {
                return false;
            }

            return true;
        });
    }, [productos, filtroTipoLimon, filtroCalibre, filtroEmpaque]);

    // Agregar al carrito
    const agregarAlCarrito = (producto: ProductoLimon) => {
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
            const nuevoItem: CartItemLimon = {
                id: producto.id,
                nombre: producto.nombre,
                tipo_limon: producto.tipo_limon,
                calibre: producto.calibre,
                empaque: producto.empaque,
                tamano_arpilla: producto.tamano_arpilla,
                cantidad: 1,
                precio_venta: producto.precio_sugerido,
                peso_kg: producto.peso_kg
            };
            setCarrito([...carrito, nuevoItem]);
        }
    };

    // Actualizar item del carrito
    const actualizarItem = (id: string, cambios: Partial<CartItemLimon>) => {
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

    // Eliminar del carrito
    const eliminarDelCarrito = (id: string) => {
        setCarrito(carrito.filter(item => item.id !== id));
    };

    // Limpiar carrito
    const limpiarCarrito = () => setCarrito([]);

    // Procesar venta
    const cobrar = async (clienteId: string | null, montoRecibido: number, metodoPago: string) => {
        if (carrito.length === 0) return null;
        setLoading(true);

        try {
            const montoTotal = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0);

            const itemsPayload = carrito.map(item => ({
                presentacion_id: item.id,
                cantidad: item.cantidad,
                precio: item.precio_venta
            }));

            // Crear la venta usando la función RPC
            const { data: ventaData, error: ventaError } = await supabase
                .rpc('process_sale_with_inventory', {
                    p_cliente_id: clienteId,
                    p_monto_total: montoTotal,
                    p_metodo_pago: metodoPago,
                    p_items: itemsPayload as any
                });

            if (ventaError) throw ventaError;

            if (!ventaData) {
                throw new Error("No se pudo crear la venta");
            }

            // Obtener los datos completos de la venta
            const ventaId = typeof ventaData === 'string' ? ventaData : (ventaData as any)?.id || (ventaData as any)?.[0]?.id;
            const { data: ventaCompleta } = await supabase
                .from('ventas')
                .select('*')
                .eq('id', ventaId)
                .single();

            toast.success("Venta de limón registrada correctamente", {
                description: `Ticket #${ventaCompleta?.numero_venta}`
            });

            limpiarCarrito();
            await cargarStockLimon(); // Refrescar stock
            return ventaCompleta;

        } catch (error: any) {
            console.error("Error al cobrar:", error);
            toast.error("Error al procesar la venta", {
                description: error.message || "Error desconocido"
            });
            return null;
        } finally {
            setLoading(false);
        }
    };

    // Cargar al iniciar
    useEffect(() => {
        cargarProductosLimon();
    }, []);

    return {
        // Datos
        productos: productosFiltrados,
        carrito,
        stock,
        loading,

        // Filtros
        filtroTipoLimon,
        setFiltroTipoLimon,
        filtroCalibre,
        setFiltroCalibre,
        filtroEmpaque,
        setFiltroEmpaque,

        // Funciones
        agregarAlCarrito,
        actualizarItem,
        eliminarDelCarrito,
        limpiarCarrito,
        cobrar,
        cargarProductosLimon
    };
}
