import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type KardexRawRow = {
  id: string;
  created_at: string;
  tipo_movimiento: string;
  cantidad: number;
  ubicacion_origen: string | null;
  ubicacion_destino: string | null;
  usuario_id: string | null;
  lote_id: string;
};
type ProduccionKardexRow = Pick<Database["public"]["Tables"]["produccion"]["Row"], "id" | "created_at" | "destino" | "cantidad_cajas">;
type CamaraKardexRow = Pick<Database["public"]["Tables"]["camara_fria"]["Row"], "id" | "fecha_ingreso" | "cantidad_disponible" | "produccion_id">;

const enrichUsuarios = async (rows: Omit<KardexLoteRow, "usuario_nombre" | "usuario_email">[]): Promise<KardexLoteRow[]> => {
  const uniqueUserIds = Array.from(new Set(rows.map((r) => r.usuario_id).filter(Boolean)));
  let usuariosMap = new Map<string, { nombre: string | null; email: string | null }>();

  if (uniqueUserIds.length > 0) {
    const { data: usuarios, error: usuariosError } = await supabase
      .from("usuarios")
      .select("auth_user_id, nombre, email")
      .in("auth_user_id", uniqueUserIds as string[]);

    if (!usuariosError && usuarios) {
      usuariosMap = new Map(
        (usuarios as UsuarioRow[])
          .filter((u) => Boolean(u.auth_user_id))
          .map((u) => [u.auth_user_id as string, { nombre: u.nombre || null, email: u.email || null }])
      );
    }
  }

  return rows.map((row) => ({
    ...row,
    usuario_nombre: usuariosMap.get(row.usuario_id)?.nombre || null,
    usuario_email: usuariosMap.get(row.usuario_id)?.email || null,
  }));
};

export const useKardexLote = (loteId?: string, open?: boolean) => {
  return useQuery({
    queryKey: ["kardex-lote", loteId],
    enabled: Boolean(loteId && open),
    queryFn: async (): Promise<KardexLoteRow[]> => {
      if (!loteId) return [];

      // Try inventario_kardex table (may not exist)
      try {
        const { data: kardexRows, error: kardexError } = await supabase
          .from("inventario_kardex" as never)
          .select("id, created_at, tipo_movimiento, cantidad, ubicacion_origen, ubicacion_destino, usuario_id, lote_id")
          .eq("lote_id", loteId)
          .order("created_at", { ascending: false });

        if (!kardexError && kardexRows && kardexRows.length > 0) {
          const normalized = (kardexRows as unknown as KardexRawRow[]).map((row) => ({
            id: row.id,
            created_at: row.created_at,
            tipo_movimiento: row.tipo_movimiento,
            cantidad: Number(row.cantidad || 0),
            ubicacion_origen: row.ubicacion_origen || "-",
            ubicacion_destino: row.ubicacion_destino || "-",
            usuario_id: row.usuario_id || "",
          }));
          return enrichUsuarios(normalized);
        }
      } catch {
        // table doesn't exist, fall through to synthetic
      }

      // Fallback: build synthetic history from produccion + camara_fria
      const { data: producciones, error: prodError } = await supabase
        .from("produccion")
        .select("id, created_at, destino, cantidad_cajas")
        .eq("lote_id", loteId)
        .order("created_at", { ascending: false });

      const produccionRows = (producciones || []) as ProduccionKardexRow[];
      const produccionIds = produccionRows.map((p) => p.id);
      const { data: camaraRows, error: camaraError } = produccionIds.length > 0
        ? await supabase
            .from("camara_fria")
            .select("id, fecha_ingreso, cantidad_disponible, produccion_id")
            .in("produccion_id", produccionIds)
        : { data: [] as CamaraKardexRow[], error: null };

      if (prodError || camaraError) {
        const details = [prodError?.message, camaraError?.message].filter(Boolean).join(" | ");
        throw new Error(details || "No se pudo cargar el historial del kardex.");
      }

      const syntheticRows: Omit<KardexLoteRow, "usuario_nombre" | "usuario_email">[] = [];

      for (const p of produccionRows) {
        syntheticRows.push({
          id: `prod-${p.id}`,
          created_at: p.created_at,
          tipo_movimiento: "entrada_produccion",
          cantidad: Number(p.cantidad_cajas || 0),
          ubicacion_origen: "linea_produccion",
          ubicacion_destino: p.destino || "inventario",
          usuario_id: "",
        });
      }

      for (const c of ((camaraRows || []) as CamaraKardexRow[])) {
        syntheticRows.push({
          id: `camara-${c.id}`,
          created_at: c.fecha_ingreso,
          tipo_movimiento: "traslado_interno",
          cantidad: Number(c.cantidad_disponible || 0),
          ubicacion_origen: "piso_empaque",
          ubicacion_destino: "camara_fria",
          usuario_id: "",
        });
      }

      const ordered = syntheticRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return enrichUsuarios(ordered);
    },
  });
};
