// src/hooks/useProductores.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Database } from "@/integrations/supabase/types";

export type Productor = Database['public']['Tables']['productores']['Row'];

export function useProductores() {
  const {
    data: productores = [],
    isLoading: loading,
    error,
    refetch
  } = useQuery({
    queryKey: ["productores"],
    queryFn: async () => {
      console.log("DEBUG: Fetching productores con React Query...");
      const { data, error } = await supabase
        .from("productores")
        .select("*")
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error fetching productores:", error);
        throw error;
      }

      return data as Productor[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache fresco
  });

  return {
    productores,
    loading,
    error,
    refetch
  };
}