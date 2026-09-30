import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, Enums } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

// Tipos alineados con la tabla facturas (CFDI 4.0) y factura_detalles
export type Factura = {
    id: string;
    cliente_id: string;
    numero_factura: string;
    fecha_emision: string;
    fecha_vencimiento: string | null;
    subtotal: number;
    iva: number;
    ieps: number;
    total: number;
    estado: string;
    estado_timbrado: string;
    moneda: string;
    metodo_pago: string | null;
    uso_cfdi: string | null;
    forma_pago: string | null;
    notas: string | null;
    terminos: string | null;
    receptor_nombre: string | null;
    receptor_rfc: string | null;
    receptor_email: string | null;
    receptor_direccion: string | null;
    created_at: string;
    clientes?: { nombre: string | null; moneda: string } | null;
};

export type FacturaDetalle = {
    id: string;
    factura_id: string;
    producto_id: string | null;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    unidad: string;
    iva_aplicable: boolean | null;
    ieps_aplicable: number | null;
    descuento: number | null;
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

type FacturaDBRow = Database['public']['Tables']['facturas']['Row'] & {
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

    // Facturas reales (tabla facturas / CFDI)
    const {
        data: facturasRecientes = [],
        isLoading: loadingFacturas,
        error: errorFacturas
    } = useQuery({
        queryKey: ['facturas'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('facturas')
                .select(`
                    *,
                    clientes (nombre, tipo)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Error fetching invoices:', error);
                throw error;
            }

            return ((data || []) as FacturaDBRow[]).map(v => ({
                id: v.id,
                numero_factura: v.folio,
                cliente_id: v.cliente_id,
                fecha_emision: v.fecha_emision,
                fecha_vencimiento: v.fecha_vencimiento,
                subtotal: Number(v.subtotal),
                iva: Number(v.iva),
                ieps: Number(v.ieps),
                total: Number(v.total),
                estado: v.status,
                estado_timbrado: v.estado_timbrado,
                moneda: v.moneda,
                metodo_pago: v.metodo_pago,
                uso_cfdi: v.uso_cfdi,
                forma_pago: v.forma_pago,
                notas: v.notas,
                terminos: v.terminos,
                receptor_nombre: v.receptor_nombre,
                receptor_rfc: v.receptor_rfc,
                receptor_email: v.receptor_email,
                receptor_direccion: v.receptor_direccion,
                created_at: v.created_at,
                clientes: v.clientes
                    ? { nombre: v.clientes.nombre || '', moneda: v.clientes.tipo === 'exportacion_usa' ? 'USD' : 'MXN' }
                    : undefined,
            }));
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

    // Mutation para crear factura via RPC CFDI (persiste datos fiscales reales)
    const crearFacturaMutation = useMutation({
        mutationFn: async (vars: {
            factura: {
                cliente_id: string;
                fecha_vencimiento: string | null;
                uso_cfdi: string;
                forma_pago: string;
                metodo_pago: string;
                moneda: string;
                notas: string;
                terminos: string;
            };
            detalles: {
                producto_id?: string | null;
                descripcion: string;
                cantidad: number;
                precio_unitario: number;
                unidad?: string;
                iva_aplicable?: boolean;
                ieps_aplicable?: number;
                descuento?: number;
            }[];
        }) => {
            if (!vars.factura.cliente_id) {
                throw new Error('Se requiere un cliente');
            }
            if (!vars.detalles.length) {
                throw new Error('La factura debe tener al menos un producto');
            }

            const { data, error } = await supabase.rpc('crear_factura_borrador_cfdi', {
                p_cliente_id: vars.factura.cliente_id,
                p_fecha_vencimiento: vars.factura.fecha_vencimiento,
                p_uso_cfdi: vars.factura.uso_cfdi,
                p_forma_pago: vars.factura.forma_pago,
                p_metodo_pago: vars.factura.metodo_pago,
                p_moneda: vars.factura.moneda,
                p_notas: vars.factura.notas || '',
                p_terminos: vars.factura.terminos || '',
                p_items: vars.detalles.map(d => ({
                    producto_id: d.producto_id || null,
                    descripcion: d.descripcion,
                    cantidad: d.cantidad,
                    precio_unitario: d.precio_unitario,
                    unidad: d.unidad || 'Caja',
                    iva_aplicable: d.iva_aplicable !== false,
                    ieps_aplicable: d.ieps_aplicable || 0,
                    descuento: d.descuento || 0,
                })),
            });

            if (error) throw error;
            const resultado = data?.[0];
            if (!resultado) {
                throw new Error('El sistema no devolvió una factura');
            }
            return resultado;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['facturas'] });
            queryClient.invalidateQueries({ queryKey: ['productos_facturacion'] });

            toast({
                title: "Factura Generada",
                description: "El registro de la factura se ha completado con éxito.",
            });
        },
        onError: (error: unknown) => {
            console.error('Mutation error:', error);
            toast({
                title: "Error al facturar",
                description: (error as ErrorLike)?.message || "Ocurrió un error al crear la factura",
                variant: "destructive",
            });
        }
    });

    // Cambiar el estado de negocio de una factura
    const actualizarEstadoFactura = async (facturaId: string, estado: string) => {
        const { error } = await supabase
            .from('facturas')
            .update({ status: estado, updated_at: new Date().toISOString() })
            .eq('id', facturaId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['facturas'] });
        return { success: true };
    };

    // Función para anular (cancelar) una factura de verdad
    const anularFactura = async (facturaId: string) => {
        try {
            const { error } = await supabase
                .from('facturas')
                .update({ status: 'cancelada', updated_at: new Date().toISOString() })
                .eq('id', facturaId);

            if (error) throw error;

            const { error: errorEvento } = await supabase
                .from('factura_eventos')
                .insert({
                    factura_id: facturaId,
                    tipo_evento: 'factura_cancelada',
                    payload: { motivo: 'anulada desde el modulo de facturacion' },
                });

            if (errorEvento) throw errorEvento;

            queryClient.invalidateQueries({ queryKey: ['facturas'] });

            toast({
                title: "Factura Anulada",
                description: "La factura ha sido cancelada correctamente.",
            });

            return { success: true };
        } catch (error: unknown) {
            toast({
                title: "Error",
                description: (error as ErrorLike)?.message || "Error al anular la factura",
                variant: "destructive",
            });
            return { success: false, error };
        }
    };

    // Cargar los conceptos reales de una factura (para el PDF del historial)
    const cargarDetallesFactura = async (facturaId: string): Promise<FacturaDetalle[]> => {
        const { data, error } = await supabase
            .from('factura_detalles')
            .select('*')
            .eq('factura_id', facturaId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return (data || []) as FacturaDetalle[];
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
        anularFactura,
        actualizarEstadoFactura,
        cargarDetallesFactura
    };
};
