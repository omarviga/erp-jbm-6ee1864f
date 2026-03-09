import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type KardexLoteRow = {
  id: string;
  created_at: string;
  tipo_movimiento: string;
  cantidad: number;
  ubicacion_origen: string;
  ubicacion_destino: string;
  usuario_id: string;
  usuario_nombre: string | null;
  usuario_email: string | null;
};

export const useKardexLote = (loteId?: string, open?: boolean) => {
  return useQuery({
    queryKey: ["kardex-lote", loteId],
    enabled: Boolean(loteId && open),
    queryFn: async (): Promise<KardexLoteRow[]> => {
      if (!loteId) return [];

      const { data: kardexRows, error } = await supabase
        .from("inventario_kardex")
        .select("id, created_at, tipo_movimiento, cantidad, ubicacion_origen, ubicacion_destino, usuario_id, lote_id")
        .eq("lote_id", loteId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!kardexRows || kardexRows.length === 0) return [];

      const uniqueUserIds = Array.from(new Set(kardexRows.map((r) => r.usuario_id).filter(Boolean)));
      let usuariosMap = new Map<string, { nombre: string | null; email: string | null }>();

      if (uniqueUserIds.length > 0) {
        const { data: usuarios, error: usuariosError } = await supabase
          .from("usuarios")
          .select("auth_user_id, nombre, email")
          .in("auth_user_id", uniqueUserIds);

        if (!usuariosError && usuarios) {
          usuariosMap = new Map(
            usuarios
              .filter((u) => Boolean(u.auth_user_id))
              .map((u) => [u.auth_user_id as string, { nombre: u.nombre || null, email: u.email || null }])
          );
        }
      }

      return kardexRows.map((row) => ({
        id: row.id,
        created_at: row.created_at,
        tipo_movimiento: row.tipo_movimiento,
        cantidad: row.cantidad,
        ubicacion_origen: row.ubicacion_origen,
        ubicacion_destino: row.ubicacion_destino,
        usuario_id: row.usuario_id,
        usuario_nombre: usuariosMap.get(row.usuario_id)?.nombre || null,
        usuario_email: usuariosMap.get(row.usuario_id)?.email || null,
      }));
    },
  });
};
