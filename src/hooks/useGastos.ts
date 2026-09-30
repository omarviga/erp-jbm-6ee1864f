import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

export type Gasto = Database["public"]["Tables"]["gastos"]["Row"];
type GastoInsert = Database["public"]["Tables"]["gastos"]["Insert"];
type OCRGastoData = {
  fecha?: string;
  concepto?: string;
  categoria?: string;
  monto?: number;
  proveedor?: string | null;
  numero_ticket?: string | null;
  notas?: string | null;
};

const GASTOS_TICKETS_BUCKET = "gastos-tickets";
const SIGNED_URL_TTL_SECONDS = 3600;

const extractTicketPath = (storedValue: string): string | null => {
  if (!storedValue) return null;
  if (!storedValue.startsWith("http")) return storedValue;

  try {
    const url = new URL(storedValue);
    const signedPrefix = `/storage/v1/object/sign/${GASTOS_TICKETS_BUCKET}/`;
    const publicPrefix = `/storage/v1/object/public/${GASTOS_TICKETS_BUCKET}/`;

    if (url.pathname.startsWith(signedPrefix)) {
      return decodeURIComponent(url.pathname.slice(signedPrefix.length));
    }

    if (url.pathname.startsWith(publicPrefix)) {
      return decodeURIComponent(url.pathname.slice(publicPrefix.length));
    }
  } catch {
    return null;
  }

  return null;
};

const resolveTicketUrl = async (storedValue: string | null): Promise<string | null> => {
  if (!storedValue) return null;

  const filePath = extractTicketPath(storedValue);
  if (!filePath) return storedValue;

  const { data, error } = await supabase.storage
    .from(GASTOS_TICKETS_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    return null;
  }

  return data.signedUrl;
};

export function useGastos() {
  const queryClient = useQueryClient();

  const gastosQuery = useQuery({
    queryKey: ["gastos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gastos")
        .select("*")
        .order("fecha", { ascending: false });
      if (error) throw error;

      const gastos = (data || []) as Gasto[];
      const gastosConUrl = await Promise.all(
        gastos.map(async (gasto) => ({
          ...gasto,
          imagen_url: await resolveTicketUrl(gasto.imagen_url),
        })),
      );

      return gastosConUrl;
    },
  });

  const createGasto = useMutation({
    mutationFn: async (gasto: Omit<GastoInsert, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("gastos")
        .insert(gasto)
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
      const { error } = await supabase.from("gastos").delete().eq("id", id);
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
      .from(GASTOS_TICKETS_BUCKET)
      .upload(fileName, file);
    if (error) {
      toast({ title: "Error al subir imagen", description: error.message, variant: "destructive" });
      return null;
    }
    return fileName;
  };

  const processOCR = async (file: File) => {
    const reader = new FileReader();
    return new Promise<OCRGastoData>((resolve, reject) => {
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
