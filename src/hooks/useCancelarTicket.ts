import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { validarMotivoCancelacion } from "@/lib/tickets/cancelacion";

/** Cancela un ticket vía RPC `cancelar_ticket` y refresca Finanzas. */
export function useCancelarTicket() {
  const queryClient = useQueryClient();
  const [cancelando, setCancelando] = useState(false);

  const cancelar = async (loteId: string, motivo: string): Promise<void> => {
    const errores = validarMotivoCancelacion(motivo);
    if (errores.length > 0) throw new Error(errores[0]);
    setCancelando(true);
    try {
      const { error } = await supabase.rpc("cancelar_ticket", {
        p_lote_id: loteId,
        p_motivo: motivo.trim(),
      });
      // Sin throwOnError, PostgREST devuelve un objeto plano (no Error):
      // normalizarlo para que el toast muestre el mensaje real del servidor.
      if (error) throw new Error(error.message || "No se pudo cancelar el ticket");
      await queryClient.invalidateQueries({ queryKey: ["finanzas"] });
    } finally {
      setCancelando(false);
    }
  };

  return { cancelar, cancelando };
}
