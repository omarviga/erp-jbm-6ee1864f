import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, Enums } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

// Tipos mejorados - use inline types since facturas/factura_detalles tables don't exist yet
export type Factura = {
    id: string;
    cliente_id: string;
    numero_factura: string;
    fecha_emision: string;
    subtotal: number;
    iva: number;
    total: number;
    estado: string;
    created_at: string;
    clientes?: { nombre: string; moneda: string };
};

export type FacturaDetalle = {
    id: string;
    factura_id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
};

// Tipos para productos y clientes
export type ProductoFacturacion = {
    id: string;
    codigo: string;
    descripcion: string;
    precio: number;
    unidad: string;
    categoria: 'producto' | 'servicio' | 'material';
    iva: boolean;
    cantidadDisponible: number;
    peso: number;
    ubicacion: string;
};

export type ClienteFacturacion = {
    id: string;
    nombre: string;
    rfc: string;
    direccion: string;
    email: string;
    telefono: string;
    condicionesPago: number;
    moneda: 'USD' | 'MXN';
    tipo: Enums<'tipo_cliente'>;
};

type VentaFacturaRow = Database['public']['Tables']['ventas']['Row'] & {
    clientes: {
        nombre: string | null;
        tipo: Enums<'tipo_cliente'> | null;
    } | null;
};

type ProduccionFacturacionRow = Database['public']['Tables']['produccion']['Row'] & {
    lotes: {
        numero_lote: string | null;
    } | null;
    presentaciones: {
        nombre: string | null;
        peso_kg: number | null;
    } | null;
};

type ClienteFacturacionRow = Database['public']['Tables']['clientes']['Row'] & {
    clientes_sensible: {
        direccion: string | null;
        email: string | null;
        telefono: string | null;
        limite_credito: number | null;
    } | null;
};

type ErrorLike = { message?: string };

export const useFacturacion = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Facturas - use ventas table as proxy since facturas table doesn't exist
    const {
        data: facturasRecientes = [],
        isLoading: loadingFacturas,
        error: errorFacturas
    } = useQuery({
        queryKey: ['facturas'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ventas')
                .select(`*, clientes (nombre, tipo)`)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching invoices:', error);
                throw error;
            }

            return ((data || []) as VentaFacturaRow[]).map(v => {
                // ventas.total ya incluye IVA; extraemos subtotal/IVA para el historial
                const subtotal = Math.round((v.total / 1.16) * 100) / 100;
                const iva = Math.round((v.total - subtotal) * 100) / 100;

                return {
                    id: v.id,
                    numero_factura: v.numero_venta,
                    cliente_id: v.cliente_id,
                    fecha_emision: v.fecha_venta,
                    subtotal,
                    iva,
                    total: v.total,
                    estado: v.pagado ? 'PAGADA' : 'PENDIENTE',
                    created_at: v.created_at,
                    clientes: v.clientes ? { nombre: v.clientes.nombre || '', moneda: v.clientes.tipo === 'exportacion_usa' ? 'USD' : 'MXN' } : undefined,
                };
            });
        },
        retry: 1
    });

    // Fetch products (boxes produced and in stock)
    const {
        data: productos = [],
        isLoading: loadingProductos
    } = useQuery({
        queryKey: ['productos_facturacion'],
        queryFn: async () => {
            try {
                const { data: produccionData, error } = await supabase
                    .from('produccion')
                    .select(`*, lotes (numero_lote), presentaciones (nombre, peso_kg)`)
                    .gt('cantidad_cajas', 0);

                if (error) throw error;

                return ((produccionData || []) as ProduccionFacturacionRow[]).map(p => ({
                    id: p.id,
                    codigo: `${p.lotes?.numero_lote || 'N/A'}-${p.calibre}`,
                    descripcion: `${p.calidad} ${p.calibre} - ${p.presentaciones?.nombre || 'Granel'}`,
                    precio: 0,
                    unidad: p.presentaciones?.nombre || 'Caja',
                    categoria: 'producto' as const,
                    iva: true,
                    cantidadDisponible: p.cantidad_cajas,
                    peso: p.presentaciones?.peso_kg || 0,
                    ubicacion: p.destino,
                }));
            } catch (err) {
                console.error('Error fetching products:', err);
                throw err;
            }
        },
    });

    // Fetch clients
    const {
        data: clientes = [],
        isLoading: loadingClientes
    } = useQuery({
        queryKey: ['clientes_facturacion'],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from('clientes')
                    .select(`
                        *,
                        clientes_sensible (
                            direccion,
                            email,
                            telefono,
                            limite_credito
                        )
                    `)
                    .order('nombre');

                if (error) throw error;

                return ((data || []) as ClienteFacturacionRow[]).map(c => ({
                    id: c.id,
                    nombre: c.nombre,
                    rfc: "POR DEFINIR",
                    direccion: c.clientes_sensible?.direccion || "Sin registrar",
                    email: c.clientes_sensible?.email || "Sin registrar",
                    telefono: c.clientes_sensible?.telefono || "Sin registrar",
                    condicionesPago: c.dias_credito || 0,
                    moneda: (c.tipo === 'exportacion_usa' ? 'USD' : 'MXN') as 'USD' | 'MXN',
                    tipo: c.tipo
                }));
            } catch (err) {
                console.error('Error fetching clients:', err);
                throw err;
            }
        },
    });

    // Mutation to create an invoice (uses ventas table)
    const crearFacturaMutation = useMutation({
        mutationFn: async (vars: {
            factura: { cliente_id: string; total: number; notas?: string };
            detalles: { descripcion: string; cantidad: number; precio_unitario: number }[];
        }) => {
            if (!vars.factura.cliente_id) {
                throw new Error('Se requiere un cliente');
            }
            if (!vars.detalles.length) {
                throw new Error('La factura debe tener al menos un producto');
            }

            const numero_venta = 'F-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000);

            const { data: venta, error: errorVenta } = await supabase
                .from('ventas')
                .insert({
                    numero_venta,
                    cliente_id: vars.factura.cliente_id,
                    tipo: 'factura',
                    total: vars.factura.total,
                    notas: vars.factura.notas || null,
                })
                .select()
                .single();

            if (errorVenta) throw errorVenta;

            const detallesConId = vars.detalles.map(d => ({
                venta_id: venta.id,
                descripcion: d.descripcion,
                cantidad: d.cantidad,
                precio_unitario: d.precio_unitario,
            }));

            const { error: errorDetalles } = await supabase
                .from('venta_detalles')
                .insert(detallesConId);

            if (errorDetalles) {
                await supabase.from('ventas').delete().eq('id', venta.id);
                throw errorDetalles;
            }

            return venta;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['facturas'] });
            queryClient.invalidateQueries({ queryKey: ['productos_facturacion'] });

            toast({
                title: "✅ Factura Generada",
                description: "El registro de la factura se ha completado con éxito.",
            });
        },
        onError: (error: unknown) => {
            console.error('Mutation error:', error);
            toast({
                title: "❌ Error al facturar",
                description: (error as ErrorLike)?.message || "Ocurrió un error al crear la factura",
                variant: "destructive",
            });
        }
    });

    // Función para anular factura
    const anularFactura = async (facturaId: string) => {
        try {
            // Since we use ventas, we mark as not paid
            const { error } = await supabase
                .from('ventas')
                .update({ pagado: false })
                .eq('id', facturaId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['facturas'] });

            toast({
                title: "✅ Factura Anulada",
                description: "La factura ha sido anulada correctamente.",
            });

            return { success: true };
        } catch (error: unknown) {
            toast({
                title: "❌ Error",
                description: (error as ErrorLike)?.message || "Error al anular la factura",
                variant: "destructive",
            });
            return { success: false, error };
        }
    };

    return {
        facturasRecientes,
        productos,
        clientes,
        loadingFacturas,
        loadingProductos,
        loadingClientes,
        errorFacturas,
        crearFactura: crearFacturaMutation.mutateAsync,
        isProcessing: crearFacturaMutation.isPending,
        anularFactura
    };
};
