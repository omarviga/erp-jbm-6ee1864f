import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";

// Tipos derivados de tu base de datos
type Cliente = Database['public']['Tables']['clientes']['Row'];
type Clasificacion = Database['public']['Tables']['cat_clasificaciones']['Row'];

// Extendemos Clasificacion para usarla en el carrito (tu DB no tiene precio fijo en catalogo, lo manejamos en UI)
export interface ItemCarrito {
  id_producto: number; // ID de cat_clasificaciones
  nombre: string;
  cantidad: number;
  precio_venta: number;
  tipo: string; // Para mostrar ícono (caja/arpilla)
}

export const useVentas = () => {
  const [productosCatalogo, setProductosCatalogo] = useState<Clasificacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Cargar Clientes y Catálogo
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);

      // Cargar Clientes
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre');

      // Cargar Catálogo (cat_clasificaciones)
      const { data: catalogoData } = await supabase
        .from('cat_clasificaciones')
        .select('*')
        .limit(50); // Limite para no saturar

      if (clientesData) setClientes(clientesData);
      if (catalogoData) setProductosCatalogo(catalogoData);

      setLoading(false);
    };

    cargarDatos();
  }, []);

  // Simulación de Stock (Ya que tu stock real está en lotes/camara_fria y es complejo calcularlo en tiempo real aquí)
  const stock = useMemo(() => {
    const s: Record<string, number> = {};
    productosCatalogo.forEach(p => s[p.id] = 100); // Stock dummy por ahora
    return s;
  }, [productosCatalogo]);

  // 2. Acciones del Carrito
  const agregarAlCarrito = (producto: Clasificacion) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id_producto === producto.id);
      if (existe) {
        return prev.map(item => item.id_producto === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, {
        id_producto: producto.id,
        nombre: producto.nombre_completo || producto.nombre_producto,
        cantidad: 1,
        precio_venta: 0, // Debes asignar precio en el UI
        tipo: producto.calibre
      }];
    });
  };

  const actualizarItem = (id_producto: number, updates: Partial<ItemCarrito>) => {
    setCarrito(prev => prev.map(item => item.id_producto === id_producto ? { ...item, ...updates } : item));
  };

  const eliminarDelCarrito = (id_producto: number) => {
    setCarrito(prev => prev.filter(item => item.id_producto !== id_producto));
  };

  const limpiarCarrito = () => setCarrito([]);

  // 3. COBRAR (Insertar en tablas reales: ventas y venta_detalles)
  const cobrar = async (clienteId: string | null, totalRecibido: number, metodoPago: string) => {
    setLoading(true);
    try {
      const totalVenta = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0);
      const numeroVenta = `NV-${Date.now().toString().slice(-6)}`; // Generador simple de folio

      // A. Insertar Encabezado (Tabla 'ventas')
      const { data: venta, error: errorVenta } = await supabase
        .from('ventas')
        .insert({
          numero_venta: numeroVenta,
          cliente_id: clienteId, // Puede ser null si es mostrador
          fecha_venta: new Date().toISOString(),
          tipo: 'mostrador',
          total: totalVenta,
          pagado: true,
          notas: `Pago con ${metodoPago}`
        })
        .select()
        .single();

      if (errorVenta) throw errorVenta;
      if (!venta) throw new Error("No se pudo crear la venta");

      // B. Insertar Detalles (Tabla 'venta_detalles')
      const detalles = carrito.map(item => ({
        venta_id: venta.id,
        descripcion: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio_venta,
        subtotal: item.cantidad * item.precio_venta
      }));

      const { error: errorDetalles } = await supabase
        .from('venta_detalles')
        .insert(detalles);

      if (errorDetalles) throw errorDetalles;

      limpiarCarrito();
      return { ...venta, items: carrito };

    } catch (error) {
      console.error("Error al cobrar:", error);
      alert("Error al guardar la venta en base de datos");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    productos: productosCatalogo.map(p => ({
      id: p.id,
      nombre: p.nombre_completo || p.nombre_producto,
      precio_sugerido: 0, // Tu tabla no tiene precio, poner 0 o default
      stock_actual: 100,
      peso_kg: 0,
      tipo: p.calibre
    })), // Mapeo para que coincida con tu UI actual
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
};