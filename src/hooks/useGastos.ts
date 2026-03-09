import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Gasto {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  proveedor: string | null;
  numero_ticket: string | null;
  notas: string | null;
  imagen_url: string | null;
  usuario_id: string | null;
  created_at: string;
}

export function useGastos() {
  const queryClient = useQueryClient();

  const gastosQuery = useQuery({
    queryKey: ["gastos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gastos" as any)
        .select("*")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data as unknown as Gasto[];
    },
  });

  const createGasto = useMutation({
    mutationFn: async (gasto: Omit<Gasto, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("gastos" as any)
        .insert(gasto as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos"] });
      toast({ title: "Gasto registrado correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al registrar gasto", description: error.message, variant: "destructive" });
    },
  });

  const deleteGasto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gastos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos"] });
      toast({ title: "Gasto eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const uploadTicketImage = async (file: File): Promise<string | null> => {
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("gastos-tickets")
      .upload(fileName, file);
    if (error) {
      toast({ title: "Error al subir imagen", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("gastos-tickets").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const processOCR = async (file: File) => {
    const reader = new FileReader();
    return new Promise<any>((resolve, reject) => {
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const { data, error } = await supabase.functions.invoke("process-gasto-ocr", {
            body: { imageBase64: base64, fileName: file.name },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Error procesando OCR");
          resolve(data.data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Error leyendo archivo"));
      reader.readAsDataURL(file);
    });
  };

  return {
    gastos: gastosQuery.data || [],
    isLoading: gastosQuery.isLoading,
    createGasto,
    deleteGasto,
    uploadTicketImage,
    processOCR,
  };
}
