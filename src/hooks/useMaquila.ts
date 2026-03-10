import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useMaquila() {
  const queryClient = useQueryClient();

  // Fetch clientes maquila
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes_maquila"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes_maquila")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch ordenes maquila with client info
  const { data: ordenes = [], isLoading: loadingOrdenes } = useQuery({
    queryKey: ["ordenes_maquila"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordenes_maquila")
        .select("*, clientes_maquila(nombre)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create cliente maquila
  const crearCliente = useMutation({
    mutationFn: async (cliente: {
      nombre: string;
      rfc?: string;
      contacto?: string;
      telefono?: string;
      tarifa_kg: number;
      tarifa_caja: number;
    }) => {
      const { data, error } = await supabase
        .from("clientes_maquila")
        .insert(cliente)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes_maquila"] });
      toast.success("Cliente de maquila registrado");
    },
    onError: (err: any) => toast.error("Error al registrar cliente: " + err.message),
  });

  // Create orden maquila
  const crearOrden = useMutation({
    mutationFn: async (orden: {
      cliente_maquila_id: string;
      folio: string;
      kilos_recibidos?: number;
    }) => {
      const { data, error } = await supabase
        .from("ordenes_maquila")
        .insert(orden)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes_maquila"] });
      toast.success("Orden de maquila creada");
    },
    onError: (err: any) => toast.error("Error al crear orden: " + err.message),
  });

  // Update orden (registrar procesamiento, finalizar, facturar)
  const actualizarOrden = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      kilos_procesados?: number;
      cajas_empacadas?: number;
      costo_total?: number;
      status?: string;
      facturado?: boolean;
      fecha_fin?: string;
    }) => {
      const { data, error } = await supabase
        .from("ordenes_maquila")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes_maquila"] });
      toast.success("Orden actualizada");
    },
    onError: (err: any) => toast.error("Error al actualizar orden: " + err.message),
  });

  return {
    clientes,
    ordenes,
    loadingClientes,
    loadingOrdenes,
    crearCliente,
    crearOrden,
    actualizarOrden,
  };
}
