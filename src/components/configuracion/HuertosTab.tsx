import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, MapPin, Users } from "lucide-react";
import { z } from "zod";

// --- Huerto Schema & Form ---
const huertoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres"),
  ubicacion: z.string().max(200, "Máximo 200 caracteres").optional().nullable(),
  hectareas: z.number().nonnegative("Las hectáreas no pueden ser negativas").max(10000, "Máximo 10,000 ha").optional().nullable(),
});
type HuertoForm = z.infer<typeof huertoSchema>;

// --- Cortador Schema & Form ---
const cortadorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres"),
  telefono: z.string().max(20, "Máximo 20 caracteres").optional().nullable(),
});
type CortadorForm = z.infer<typeof cortadorSchema>;
type HuertoRow = Database["public"]["Tables"]["huertos"]["Row"];
type CortadorRow = Database["public"]["Tables"]["cortadores"]["Row"];
type ErrorLike = { message?: string };

export function HuertosTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // === HUERTOS STATE ===
  const [huertoDialogOpen, setHuertoDialogOpen] = useState(false);
  const [editingHuerto, setEditingHuerto] = useState<HuertoRow | null>(null);
  const [huertoFormData, setHuertoFormData] = useState<HuertoForm>({
    nombre: "",
    ubicacion: "",
    hectareas: null,
  });

  // === CORTADORES STATE ===
  const [cortadorDialogOpen, setCortadorDialogOpen] = useState(false);
  const [editingCortador, setEditingCortador] = useState<CortadorRow | null>(null);
  const [cortadorFormData, setCortadorFormData] = useState<CortadorForm>({
    nombre: "",
    telefono: "",
  });

  // ===================== HUERTOS QUERIES =====================
  const { data: huertos, isLoading: loadingHuertos } = useQuery({
    queryKey: ["huertos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("huertos").select("*").order("nombre");
      if (error) throw error;
      return (data || []) as HuertoRow[];
    },
  });

  const createHuertoMutation = useMutation({
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
      resetHuertoForm();
    },
    onError: (error: unknown) => {
      toast({ title: "Error al crear huerto", description: (error as ErrorLike)?.message || "Error desconocido", variant: "destructive" });
    },
  });

  const updateHuertoMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & Partial<HuertoForm>) => {
      const { error } = await supabase.from("huertos").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["huertos"] });
      toast({ title: "Huerto actualizado" });
      resetHuertoForm();
    },
    onError: (error: unknown) => {
      toast({ title: "Error al actualizar", description: (error as ErrorLike)?.message || "Error desconocido", variant: "destructive" });
    },
  });

  const deleteHuertoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("huertos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["huertos"] });
      toast({ title: "Huerto eliminado" });
    },
    onError: (error: unknown) => {
      toast({ title: "Error al eliminar", description: (error as ErrorLike)?.message || "Error desconocido", variant: "destructive" });
    },
  });

  const resetHuertoForm = () => {
    setHuertoFormData({ nombre: "", ubicacion: "", hectareas: null });
    setEditingHuerto(null);
    setHuertoDialogOpen(false);
  };

  const handleHuertoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = huertoSchema.safeParse(huertoFormData);
    if (!validation.success) {
      toast({ title: "Error de validación", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (editingHuerto) {
      updateHuertoMutation.mutate({ id: editingHuerto.id, ...huertoFormData });
    } else {
      createHuertoMutation.mutate(huertoFormData);
    }
  };

  const handleEditHuerto = (huerto: HuertoRow) => {
    setEditingHuerto(huerto);
    setHuertoFormData({
      nombre: huerto.nombre,
      ubicacion: huerto.ubicacion || "",
      hectareas: huerto.hectareas,
    });
    setHuertoDialogOpen(true);
  };

  // ===================== CORTADORES QUERIES =====================
  const { data: cortadores, isLoading: loadingCortadores } = useQuery({
    queryKey: ["cortadores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cortadores").select("*").order("nombre");
      if (error) throw error;
      return (data || []) as CortadorRow[];
    },
  });

  const createCortadorMutation = useMutation({
    mutationFn: async (data: CortadorForm) => {
      const { error } = await supabase.from("cortadores").insert([{
        nombre: data.nombre,
        telefono: data.telefono || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cortadores"] });
      toast({ title: "Cortador registrado exitosamente" });
      resetCortadorForm();
    },
    onError: (error: unknown) => {
      toast({ title: "Error al registrar cortador", description: (error as ErrorLike)?.message || "Error desconocido", variant: "destructive" });
    },
  });

  const updateCortadorMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string; nombre?: string; telefono?: string | null; activo?: boolean }) => {
      const { error } = await supabase.from("cortadores").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cortadores"] });
      toast({ title: "Cortador actualizado" });
      resetCortadorForm();
    },
    onError: (error: unknown) => {
      toast({ title: "Error al actualizar", description: (error as ErrorLike)?.message || "Error desconocido", variant: "destructive" });
    },
  });

  const deleteCortadorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cortadores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cortadores"] });
      toast({ title: "Cortador eliminado" });
    },
    onError: (error: unknown) => {
      toast({ title: "Error al eliminar", description: (error as ErrorLike)?.message || "Error desconocido", variant: "destructive" });
    },
  });

  const resetCortadorForm = () => {
    setCortadorFormData({ nombre: "", telefono: "" });
    setEditingCortador(null);
    setCortadorDialogOpen(false);
  };

  const handleCortadorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = cortadorSchema.safeParse(cortadorFormData);
    if (!validation.success) {
      toast({ title: "Error de validación", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (editingCortador) {
      updateCortadorMutation.mutate({ id: editingCortador.id, ...cortadorFormData });
    } else {
      createCortadorMutation.mutate(cortadorFormData);
    }
  };

  const handleEditCortador = (cortador: CortadorRow) => {
    setEditingCortador(cortador);
    setCortadorFormData({
      nombre: cortador.nombre,
      telefono: cortador.telefono || "",
    });
    setCortadorDialogOpen(true);
  };

  const handleToggleCortadorActivo = (cortador: CortadorRow) => {
    updateCortadorMutation.mutate({ id: cortador.id, activo: !cortador.activo });
  };

  return (
    <div className="space-y-6">
      {/* ========== HUERTOS ========== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Huertos Propios</CardTitle>
            <CardDescription>Administra los huertos de la empresa para cosecha propia</CardDescription>
          </div>
          <Dialog open={huertoDialogOpen} onOpenChange={setHuertoDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetHuertoForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Huerto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingHuerto ? "Editar" : "Nuevo"} Huerto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleHuertoSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="huerto-nombre">Nombre *</Label>
                  <Input
                    id="huerto-nombre"
                    value={huertoFormData.nombre}
                    onChange={(e) => setHuertoFormData({ ...huertoFormData, nombre: e.target.value })}
                    placeholder="Ej: Huerto San José"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="huerto-ubicacion">Ubicación</Label>
                  <Input
                    id="huerto-ubicacion"
                    value={huertoFormData.ubicacion || ""}
                    onChange={(e) => setHuertoFormData({ ...huertoFormData, ubicacion: e.target.value })}
                    placeholder="Ej: Carretera a Tecomán Km 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="huerto-hectareas">Hectáreas</Label>
                  <Input
                    id="huerto-hectareas"
                    type="number"
                    step="0.01"
                    value={huertoFormData.hectareas ?? ""}
                    onChange={(e) => setHuertoFormData({ ...huertoFormData, hectareas: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Ej: 25.5"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetHuertoForm}>Cancelar</Button>
                  <Button type="submit" disabled={createHuertoMutation.isPending || updateHuertoMutation.isPending}>
                    {(createHuertoMutation.isPending || updateHuertoMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingHuerto ? "Guardar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingHuertos ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
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
                          <MapPin className="h-3 w-3" />{h.ubicacion}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{h.hectareas ? `${h.hectareas} ha` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEditHuerto(h)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteHuertoMutation.mutate(h.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {huertos?.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay huertos registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ========== CORTADORES ========== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Cortadores
            </CardTitle>
            <CardDescription>Personal de campo que realiza la cosecha en los huertos propios</CardDescription>
          </div>
          <Dialog open={cortadorDialogOpen} onOpenChange={setCortadorDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetCortadorForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Cortador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCortador ? "Editar" : "Nuevo"} Cortador</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCortadorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cortador-nombre">Nombre *</Label>
                  <Input
                    id="cortador-nombre"
                    value={cortadorFormData.nombre}
                    onChange={(e) => setCortadorFormData({ ...cortadorFormData, nombre: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cortador-telefono">Teléfono</Label>
                  <Input
                    id="cortador-telefono"
                    value={cortadorFormData.telefono || ""}
                    onChange={(e) => setCortadorFormData({ ...cortadorFormData, telefono: e.target.value })}
                    placeholder="Ej: 312 123 4567"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetCortadorForm}>Cancelar</Button>
                  <Button type="submit" disabled={createCortadorMutation.isPending || updateCortadorMutation.isPending}>
                    {(createCortadorMutation.isPending || updateCortadorMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingCortador ? "Guardar" : "Registrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingCortadores ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cortadores?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell>{c.telefono || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.activo ? "default" : "secondary"}>
                        {c.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Switch
                          checked={c.activo ?? true}
                          onCheckedChange={() => handleToggleCortadorActivo(c)}
                        />
                        <Button size="icon" variant="ghost" onClick={() => handleEditCortador(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteCortadorMutation.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cortadores?.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay cortadores registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
