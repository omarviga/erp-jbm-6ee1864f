import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type ClienteMaquilaRow = Database["public"]["Tables"]["clientes_maquila"]["Row"];
type ClienteMaquilaInsert = Database["public"]["Tables"]["clientes_maquila"]["Insert"];
type ClienteGeneralRow = Database["public"]["Tables"]["clientes"]["Row"];
type OrdenMaquilaRow = Database["public"]["Tables"]["ordenes_maquila"]["Row"] & {
  clientes_maquila: {
    nombre: string | null;
  } | null;
};
type OrdenMaquilaInsert = Database["public"]["Tables"]["ordenes_maquila"]["Insert"];
type OrdenMaquilaUpdate = Database["public"]["Tables"]["ordenes_maquila"]["Update"] & {
  id: string;
};
type ClienteMaquilaUpdate = Database["public"]["Tables"]["clientes_maquila"]["Update"] & {
  id: string;
};
type ErrorLike = { message?: string };
type ClienteMaquilaOption = ClienteMaquilaRow & {
  origen: "maquila" | "catalogo_general";
  cliente_general_id?: string | null;
};

const GENERAL_CLIENT_PREFIX = "general:";

function esClienteGeneralTemporal(clienteId: string) {
  return clienteId.startsWith(GENERAL_CLIENT_PREFIX);
}

type ClienteMaquilaInicial = Pick<ClienteMaquilaInsert, "contacto" | "telefono" | "tarifa_kg" | "tarifa_caja">;

export function useMaquila() {
  const queryClient = useQueryClient();

  // Fetch clientes maquila
  const {
    data: clientesMaquila = [],
    isLoading: loadingClientesMaquila,
    error: errorClientesMaquila,
  } = useQuery({
    queryKey: ["clientes_maquila"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes_maquila")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return (data || []) as ClienteMaquilaRow[];
    },
    retry: 1,
  });

  const {
    data: clientesGenerales = [],
    isLoading: loadingClientesGenerales,
  } = useQuery({
    queryKey: ["clientes_maquila_fallback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return (data || []) as ClienteGeneralRow[];
    },
    retry: 1,
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
      return (data || []) as OrdenMaquilaRow[];
    },
  });

  useEffect(() => {
    if (!errorClientesMaquila) return;
    toast.error("No se pudo leer el catálogo de clientes de maquila. Se usarán los clientes generales disponibles.");
  }, [errorClientesMaquila]);

  const clientes = useMemo<ClienteMaquilaOption[]>(() => {
    const clientesMaquilaNormalizados = clientesMaquila.map((cliente) => ({
      ...cliente,
      // Si activo viene null desde BD, lo tratamos como activo para no ocultarlo por error.
      activo: cliente.activo ?? true,
      origen: "maquila" as const,
      cliente_general_id: null,
    }));

    const nombresMaquila = new Set(
      clientesMaquilaNormalizados.map((cliente) => cliente.nombre.trim().toLowerCase())
    );

    const clientesGeneralesDisponibles = clientesGenerales
      .filter((cliente) => !nombresMaquila.has(cliente.nombre.trim().toLowerCase()))
      .map((cliente) => ({
        id: `${GENERAL_CLIENT_PREFIX}${cliente.id}`,
        nombre: cliente.nombre,
        rfc: null,
        contacto: null,
        telefono: null,
        tarifa_kg: 0,
        tarifa_caja: 0,
        activo: true,
        created_at: cliente.created_at,
        origen: "catalogo_general" as const,
        cliente_general_id: cliente.id,
      }));

    return [...clientesMaquilaNormalizados, ...clientesGeneralesDisponibles].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );
  }, [clientesGenerales, clientesMaquila]);

  const loadingClientes = loadingClientesMaquila || loadingClientesGenerales;

  async function resolverClienteMaquilaId(clienteId: string, clienteInicial?: ClienteMaquilaInicial) {
    if (!esClienteGeneralTemporal(clienteId)) {
      return clienteId;
    }

    const clienteGeneralId = clienteId.replace(GENERAL_CLIENT_PREFIX, "");
    const clienteGeneral = clientesGenerales.find((cliente) => cliente.id === clienteGeneralId);

    if (!clienteGeneral) {
      throw new Error("No se encontró el cliente seleccionado.");
    }

    const clienteExistente = clientesMaquila.find(
      (cliente) => cliente.nombre.trim().toLowerCase() === clienteGeneral.nombre.trim().toLowerCase()
    );

    if (clienteExistente) {
      return clienteExistente.id;
    }

    const { data, error } = await supabase
      .from("clientes_maquila")
      .insert({
        nombre: clienteGeneral.nombre,
        activo: true,
        contacto: clienteInicial?.contacto || null,
        telefono: clienteInicial?.telefono || null,
        tarifa_kg: clienteInicial?.tarifa_kg ?? 0,
        tarifa_caja: clienteInicial?.tarifa_caja ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: ["clientes_maquila"] });

    return data.id;
  }

  // Create cliente maquila
  const crearCliente = useMutation({
    mutationFn: async (cliente: ClienteMaquilaInsert) => {
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
    onError: (err: unknown) => toast.error("Error al registrar cliente: " + ((err as ErrorLike)?.message || "Error desconocido")),
  });

  // Create orden maquila
  const crearOrden = useMutation({
    mutationFn: async (vars: {
      orden: OrdenMaquilaInsert;
      clienteInicial?: ClienteMaquilaInicial;
    }) => {
      const clienteMaquilaId = await resolverClienteMaquilaId(vars.orden.cliente_maquila_id, vars.clienteInicial);
      const { data, error } = await supabase
        .from("ordenes_maquila")
        .insert({
          ...vars.orden,
          cliente_maquila_id: clienteMaquilaId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes_maquila"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_maquila"] });
      toast.success("Orden de maquila creada");
    },
    onError: (err: unknown) => toast.error("Error al crear orden: " + ((err as ErrorLike)?.message || "Error desconocido")),
  });

  // Update orden (registrar procesamiento, finalizar, facturar)
  const actualizarOrden = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: OrdenMaquilaUpdate) => {
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
    onError: (err: unknown) => toast.error("Error al actualizar orden: " + ((err as ErrorLike)?.message || "Error desconocido")),
  });

  const actualizarCliente = useMutation({
    mutationFn: async ({ id, ...updates }: ClienteMaquilaUpdate) => {
      const { data, error } = await supabase
        .from("clientes_maquila")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes_maquila"] });
      toast.success("Cliente actualizado");
    },
    onError: (err: unknown) => toast.error("Error al actualizar cliente: " + ((err as ErrorLike)?.message || "Error desconocido")),
  });

  return {
    clientes,
    ordenes,
    loadingClientes,
    loadingOrdenes,
    clientesDesdeCatalogoGeneral: clientesMaquila.length === 0 && clientesGenerales.length > 0,
    errorClientesMaquila,
    crearCliente,
    crearOrden,
    actualizarOrden,
    actualizarCliente,
  };
}
