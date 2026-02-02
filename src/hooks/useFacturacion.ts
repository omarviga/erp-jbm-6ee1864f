import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

// Tipos mejorados
export type Factura = Database['public']['Tables']['facturas']['Row'] & {
    clientes?: { nombre: string; moneda: string };
};

export type FacturaDetalle = Database['public']['Tables']['factura_detalles']['Row'];

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
};

export const useFacturacion = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch recent invoices
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
          clientes (nombre, moneda)
        `)
                .order('fecha_emision', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching invoices:', error);
                throw error;
            }

            return data || [];
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
                // Primero obtenemos los precios pactados
                const { data: preciosPactados, error: errorPrecios } = await supabase
                    .from('precios_pactados')
                    .select('*');

                if (errorPrecios) {
                    console.warn('No se encontraron precios pactados:', errorPrecios);
                }

                // Luego obtenemos la producción
                const { data: produccionData, error } = await supabase
                    .from('produccion')
                    .select(`
            *,
            lotes (numero_lote),
            presentaciones (nombre, peso_kg)
          `)
                    .eq('disponible_para_venta', true)
                    .gt('cantidad_cajas', 0);

                if (error) throw error;

                return produccionData.map(p => {
                    // Buscar precio pactado para este producto
                    const precioPactado = preciosPactados?.find(
                        pp => pp.produccion_id === p.id
                    )?.precio_unitario || 0;

                    return {
                        id: p.id,
                        codigo: `${p.lotes?.numero_lote || 'N/A'}-${p.calibre}`,
                        descripcion: `${p.calidad} ${p.calibre} - ${p.presentaciones?.nombre || 'Granel'}`,
                        precio: precioPactado,
                        unidad: p.presentaciones?.nombre || 'Caja',
                        categoria: 'producto' as const,
                        iva: true,
                        cantidadDisponible: p.cantidad_cajas,
                        peso: p.presentaciones?.peso_kg || 0,
                        ubicacion: p.destino,
                    };
                });
            } catch (err) {
                console.error('Error fetching products:', err);
                throw err;
            }
        },
    });

    // Fetch clients - CORREGIDO: No usar clientes_sensible si no existe
    const {
        data: clientes = [],
        isLoading: loadingClientes
    } = useQuery({
        queryKey: ['clientes_facturacion'],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from('clientes')
                    .select('*')
                    .order('nombre');

                if (error) throw error;

                // Obtener RFCs de la tabla 'producers' si existe, o usar datos básicos
                const { data: producersData, error: producersError } = await supabase
                    .from('producers')
                    .select('rfc, nombre');

                // Si falla, continuar sin RFCs (no lanzar error)
                if (producersError) {
                    console.warn('No se pudieron obtener datos de producers:', producersError);
                }

                return data.map(c => {
                    const producerInfo = producersData?.find(p =>
                        p.nombre?.toLowerCase() === c.nombre.toLowerCase()
                    );

                    return {
                        id: c.id,
                        nombre: c.nombre,
                        rfc: producerInfo?.rfc || "POR DEFINIR",
                        direccion: c.direccion || "N/A",
                        email: c.email || "N/A",
                        telefono: c.telefono || "N/A",
                        condicionesPago: c.dias_credito || 0,
                        moneda: (c.tipo === 'exportacion_usa' ? 'USD' : 'MXN') as 'USD' | 'MXN'
                    };
                });
            } catch (err) {
                console.error('Error fetching clients:', err);
                throw err;
            }
        },
    });

    // Mutation to create an invoice
    const crearFacturaMutation = useMutation({
        mutationFn: async (vars: {
            factura: Database['public']['Tables']['facturas']['Insert'];
            detalles: Database['public']['Tables']['factura_detalles']['Insert'][];
        }) => {
            // Validación básica
            if (!vars.factura.cliente_id) {
                throw new Error('Se requiere un cliente');
            }
            if (!vars.detalles.length) {
                throw new Error('La factura debe tener al menos un producto');
            }

            // 1. Insert invoice
            const { data: factura, error: errorFactura } = await supabase
                .from('facturas')
                .insert({
                    ...vars.factura,
                    estado: 'PENDIENTE',
                    fecha_emision: new Date().toISOString()
                })
                .select()
                .single();

            if (errorFactura) {
                console.error('Error creating invoice:', errorFactura);
                throw errorFactura;
            }

            // 2. Insert details
            const detallesConId = vars.detalles.map(d => ({
                ...d,
                factura_id: factura.id
            }));

            const { error: errorDetalles } = await supabase
                .from('factura_detalles')
                .insert(detallesConId);

            if (errorDetalles) {
                console.error('Error creating invoice details:', errorDetalles);

                // Rollback: eliminar la factura creada
                await supabase
                    .from('facturas')
                    .delete()
                    .eq('id', factura.id);

                throw errorDetalles;
            }

            return factura;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['facturas'] });
            queryClient.invalidateQueries({ queryKey: ['productos_facturacion'] });

            toast({
                title: "✅ Factura Generada",
                description: "El registro de la factura se ha completado con éxito.",
            });
        },
        onError: (error: any) => {
            console.error('Mutation error:', error);
            toast({
                title: "❌ Error al facturar",
                description: error.message || "Ocurrió un error al crear la factura",
                variant: "destructive",
            });
        }
    });

    // Función para anular factura
    const anularFactura = async (facturaId: string) => {
        try {
            const { error } = await supabase
                .from('facturas')
                .update({ estado: 'ANULADA' })
                .eq('id', facturaId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['facturas'] });

            toast({
                title: "✅ Factura Anulada",
                description: "La factura ha sido anulada correctamente.",
            });

            return { success: true };
        } catch (error: any) {
            toast({
                title: "❌ Error",
                description: error.message || "Error al anular la factura",
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