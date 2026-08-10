import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, UserPlus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

// Schema de validación
const productorSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  telefono: z.string()
    .regex(/^[0-9]{10}$/, "El teléfono debe tener 10 dígitos")
    .optional()
    .or(z.literal("")),
  rfc: z.string()
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, "RFC inválido")
    .optional()
    .or(z.literal("")),
});

type ProductorInput = z.infer<typeof productorSchema>;

interface NuevoProductorDialogProps {
  onProductorCreated?: (productorId: string) => void;
}

export function NuevoProductorDialog({ onProductorCreated }: NuevoProductorDialogProps) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rfc, setRfc] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const queryClient = useQueryClient();

  const createProductor = useMutation({
    mutationFn: async (data: ProductorInput) => {
      const { data: productor, error } = await supabase
        .from("productores")
        .insert({
          nombre: data.nombre.trim(),
          telefono: data.telefono?.trim() || null,
          rfc: data.rfc?.trim().toUpperCase() || null,
        })
        .select()
        .single();

      if (error) throw error;
      return productor;
    },
    onSuccess: (productor) => {
      queryClient.invalidateQueries({ queryKey: ["productores"] });
      toast.success("✅ Productor registrado", {
        description: `${productor.nombre} ha sido agregado correctamente.`,
      });
      
      // Reset form
      setNombre("");
      setTelefono("");
      setRfc("");
      setErrors({});
      setOpen(false);
      
      // Callback opcional
      onProductorCreated?.(productor.id);
    },
    onError: (error: Error) => {
      toast.error("❌ Error al registrar productor", {
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    // Validar
    const result = productorSchema.safeParse({
      nombre,
      telefono: telefono || undefined,
      rfc: rfc || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    createProductor.mutate(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-14 w-14 shrink-0">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Nuevo Productor
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez González"
              className={errors.nombre ? "border-destructive" : ""}
            />
            {errors.nombre && (
              <p className="text-sm text-destructive">{errors.nombre}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono (10 dígitos)</Label>
            <Input
              id="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Ej: 3121234567"
              className={errors.telefono ? "border-destructive" : ""}
            />
            {errors.telefono && (
              <p className="text-sm text-destructive">{errors.telefono}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rfc">RFC (opcional)</Label>
            <Input
              id="rfc"
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase().slice(0, 13))}
              placeholder="Ej: XAXX010101000"
              className={errors.rfc ? "border-destructive" : ""}
            />
            {errors.rfc && (
              <p className="text-sm text-destructive">{errors.rfc}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" disabled={createProductor.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button 
            onClick={handleSubmit} 
            disabled={!nombre.trim() || createProductor.isPending}
          >
            {createProductor.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Registrar Productor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
