import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";
import { z } from "zod";

const huertoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres"),
  ubicacion: z.string().max(200, "Máximo 200 caracteres").optional().nullable(),
  hectareas: z.number().nonnegative("Las hectáreas no pueden ser negativas").max(10000, "Máximo 10,000 ha").optional().nullable(),
});

type HuertoForm = z.infer<typeof huertoSchema>;

export function HuertosTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHuerto, setEditingHuerto] = useState<any>(null);
  const [formData, setFormData] = useState<HuertoForm>({
    nombre: "",
    ubicacion: "",
    hectareas: null,
  });

  // Fetch huertos
  const { data: huertos, isLoading } = useQuery({
    queryKey: ["huertos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huertos")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Create huerto
  const createMutation = useMutation({
    mutationFn: async (data: HuertoForm) => {
      const { error } = await supabase.from("huertos").insert([{
        nombre: data.nombre,
        ubicacion: data.ubicacion || null,
        hectareas: data.hectareas || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["huertos"] });
      toast({ title: "Huerto creado exitosamente" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error al crear huerto", description: error.message, variant: "destructive" });
    },
  });

  // Update huerto
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & Partial<HuertoForm>) => {
      const { error } = await supabase.from("huertos").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["huertos"] });
      toast({ title: "Huerto actualizado" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  // Delete huerto
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("huertos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["huertos"] });
      toast({ title: "Huerto eliminado" });
    },
    onError: (error: any) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ nombre: "", ubicacion: "", hectareas: null });
    setEditingHuerto(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = huertoSchema.safeParse(formData);
    if (!validation.success) {
      toast({ title: "Error de validación", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (editingHuerto) {
      updateMutation.mutate({ id: editingHuerto.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (huerto: any) => {
    setEditingHuerto(huerto);
    setFormData({
      nombre: huerto.nombre,
      ubicacion: huerto.ubicacion || "",
      hectareas: huerto.hectareas,
    });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Huertos Propios</CardTitle>
          <CardDescription>Administra los huertos de la empresa para cosecha propia</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Huerto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHuerto ? "Editar" : "Nuevo"} Huerto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Huerto San José"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicación</Label>
                <Input
                  id="ubicacion"
                  value={formData.ubicacion || ""}
                  onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                  placeholder="Ej: Carretera a Tecomán Km 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hectareas">Hectáreas</Label>
                <Input
                  id="hectareas"
                  type="number"
                  step="0.01"
                  value={formData.hectareas ?? ""}
                  onChange={(e) => setFormData({ ...formData, hectareas: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Ej: 25.5"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingHuerto ? "Guardar" : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Hectáreas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {huertos?.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.nombre}</TableCell>
                  <TableCell>
                    {h.ubicacion ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {h.ubicacion}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{h.hectareas ? `${h.hectareas} ha` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(h)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {huertos?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No hay huertos registrados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
