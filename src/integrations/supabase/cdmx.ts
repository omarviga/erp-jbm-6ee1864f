import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

// La tabla tickets_pos_cdmx no está en los tipos generados (types.ts).
// Este cliente tipado permite consultarla sin usar `as any`.

export type TicketItemPosCdmx = {
  id: string | number;
  nombre: string;
  cantidad: number;
  precio_venta: number;
};

export type TicketPosCdmx = {
  id: string;
  venta_id: string;
  numero_venta: string;
  cliente_nombre: string;
  metodo_pago: "efectivo" | "cheque" | "transferencia";
  total: number;
  created_at: string;
  items: TicketItemPosCdmx[];
};

type CdmxDatabase = Database & {
  public: {
    Tables: {
      tickets_pos_cdmx: {
        Row: TicketPosCdmx;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: never[];
      };
    };
  };
};

export const supabaseCdmx = supabase as unknown as SupabaseClient<CdmxDatabase>;
