import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

export type Factura = Database['public']['Tables']['facturas']['Row'];
export type FacturaDetalle = Database['public']['Tables']['factura_detalles']['Row'];

export const useFacturacion = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch recent invoices
    const { data: facturasRecientes, isLoading: loadingFacturas } = useQuery({
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
            if (error) throw error;
            return data;
        },
    });

    // Fetch products (boxes produced and in stock)
    const { data: productos, isLoading: loadingProductos } = useQuery({
        queryKey: ['productos_facturacion'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('produccion')
                .select(`
          *,
          lotes (numero_lote),
          presentaciones (nombre, peso_kg)
        `);
            if (error) throw error;

            return data.map(p => ({
                id: p.id,
                codigo: `${p.lotes?.numero_lote || 'N/A'}-${p.calibre}`,
                descripcion: `${p.calidad} ${p.calibre} - ${p.presentaciones?.nombre || 'Granel'}`,
                precio: 0, // In UI, price might be pactado or manual
                unidad: p.presentaciones?.nombre || 'Caja',
                categoria: 'producto' as const,
                iva: true,
                cantidadDisponible: p.cantidad_cajas,
                peso: p.presentaciones?.peso_kg || 0,
                ubicacion: p.destino,
            }));
        },
    });

    // Fetch clients with sensitive data
    const { data: clientes, isLoading: loadingClientes } = useQuery({
        queryKey: ['clientes_facturacion'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('clientes')
                .select(`
                    *,
                    clientes_sensible (*)
                `)
                .order('nombre');

            if (error) throw error;

            return data.map(c => ({
                id: c.id,
                nombre: c.nombre,
                rfc: "Buscando...", // RFC is not in clientes or clientes_sensible? Let's check table producers
                direccion: c.clientes_sensible?.direccion || "N/A",
                email: c.clientes_sensible?.email || "N/A",
                telefono: c.clientes_sensible?.telefono || "N/A",
                condicionesPago: c.dias_credito || 0,
                moneda: (c.tipo === 'exportacion_usa' ? 'USD' : 'MXN') as 'USD' | 'MXN'
            }));
        },
    });

    // Mutation to create an invoice
    const crearFacturaMutation = useMutation({
        mutationFn: async (vars: {
            factura: Database['public']['Tables']['facturas']['Insert'];
            detalles: Database['public']['Tables']['factura_detalles']['Insert'][];
        }) => {
            // 1. Insert invoice
            const { data: factura, error: errorFactura } = await supabase
                .from('facturas')
                .insert(vars.factura)
                .select()
                .single();

            if (errorFactura) throw errorFactura;

            // 2. Insert details
            const detallesConId = vars.detalles.map(d => ({ ...d, factura_id: factura.id }));
            const { error: errorDetalles } = await supabase
                .from('factura_detalles')
                .insert(detallesConId);

            if (errorDetalles) throw errorDetalles;

            return factura;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['facturas'] });
            toast({
                title: "Factura Generada",
                description: "El registro de la factura se ha completado con éxito.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error al facturar",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    return {
        facturasRecientes,
        productos,
        clientes,
        loadingFacturas,
        loadingProductos,
        loadingClientes,
        crearFactura: crearFacturaMutation.mutateAsync,
        isProcessing: crearFacturaMutation.isPending
    };
};
