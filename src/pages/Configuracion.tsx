import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Settings, Package, Thermometer, Plus, Pencil, Trash2, Loader2, Trees } from "lucide-react";
import { HuertosTab } from "@/components/configuracion/HuertosTab";
import { COMPANY_ADDRESS, COMPANY_INFO } from "@/lib/company";
import { z } from "zod";

const presentacionSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  tipo: z.string().min(1, "El tipo es requerido"),
  peso_kg: z.number().positive("El peso debe ser positivo"),
});

type PresentacionForm = z.infer<typeof presentacionSchema>;

export default function Configuracion() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPresentacion, setEditingPresentacion] = useState<any>(null);
  const [formData, setFormData] = useState<PresentacionForm>({
    nombre: "",
    tipo: "caja",
    peso_kg: 0,
  });

  // Fetch presentaciones
  const { data: presentaciones, isLoading: loadingPresentaciones } = useQuery({
    queryKey: ["presentaciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presentaciones")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Create presentacion
  const createMutation = useMutation({
    mutationFn: async (data: PresentacionForm) => {
      const insertData = {
        nombre: data.nombre,
        tipo: data.tipo,
        peso_kg: data.peso_kg,
      };
      const { error } = await supabase.from("presentaciones").insert([insertData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presentaciones"] });
      toast({ title: "Presentación creada exitosamente" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error al crear presentación", description: error.message, variant: "destructive" });
    },
  });

  // Update presentacion
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string; nombre?: string; tipo?: string; peso_kg?: number; activa?: boolean }) => {
      const { error } = await supabase.from("presentaciones").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presentaciones"] });
      toast({ title: "Presentación actualizada" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  // Delete presentacion
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("presentaciones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presentaciones"] });
      toast({ title: "Presentación eliminada" });
    },
    onError: (error: any) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ nombre: "", tipo: "caja", peso_kg: 0 });
    setEditingPresentacion(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = presentacionSchema.safeParse(formData);
    if (!validation.success) {
      toast({ title: "Error de validación", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (editingPresentacion) {
      updateMutation.mutate({ id: editingPresentacion.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (presentacion: any) => {
    setEditingPresentacion(presentacion);
    setFormData({
      nombre: presentacion.nombre,
      tipo: presentacion.tipo,
      peso_kg: presentacion.peso_kg,
    });
    setDialogOpen(true);
  };

  const handleToggleActiva = (presentacion: any) => {
    updateMutation.mutate({ id: presentacion.id, activa: !presentacion.activa });
  };

  return (
    <MainLayout title="Configuración" subtitle="Ajustes generales del sistema">
      <Tabs defaultValue="presentaciones" className="space-y-6">
        <TabsList>
          <TabsTrigger value="presentaciones" className="gap-2">
            <Package className="h-4 w-4" />
            Presentaciones
          </TabsTrigger>
          <TabsTrigger value="huertos" className="gap-2">
            <Trees className="h-4 w-4" />
            Huertos
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="camara" className="gap-2">
            <Thermometer className="h-4 w-4" />
            Cámara Fría
          </TabsTrigger>
        </TabsList>

        {/* Presentaciones Tab */}
        <TabsContent value="presentaciones">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tipos de Presentación</CardTitle>
                <CardDescription>Administra los tipos de empaque y presentación del producto</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Presentación
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingPresentacion ? "Editar" : "Nueva"} Presentación</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Caja 40 lbs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo</Label>
                      <Input
                        id="tipo"
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        placeholder="Ej: caja, arpilla, granel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="peso_kg">Peso (kg)</Label>
                      <Input
                        id="peso_kg"
                        type="number"
                        step="0.01"
                        value={formData.peso_kg || ""}
                        onChange={(e) => setFormData({ ...formData, peso_kg: parseFloat(e.target.value) || 0 })}
                        placeholder="Ej: 18.14"
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
                        {editingPresentacion ? "Guardar" : "Crear"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingPresentaciones ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Peso (kg)</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presentaciones?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell>{p.tipo}</TableCell>
                        <TableCell>{p.peso_kg} kg</TableCell>
                        <TableCell>
                          <Badge variant={p.activa ? "default" : "secondary"}>
                            {p.activa ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Switch
                              checked={p.activa}
                              onCheckedChange={() => handleToggleActiva(p)}
                            />
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(p.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {presentaciones?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay presentaciones registradas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Huertos Tab */}
        <TabsContent value="huertos">
          <HuertosTab />
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
              <CardDescription>Ajustes generales de la aplicación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de la Empresa</Label>
                  <Input defaultValue={COMPANY_INFO.displayName} disabled />
                </div>
                <div className="space-y-2">
                  <Label>RFC</Label>
                  <Input placeholder="RFC de la empresa" disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Domicilio</Label>
                <Input defaultValue={COMPANY_ADDRESS} disabled />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Modo Oscuro</Label>
                  <p className="text-sm text-muted-foreground">
                    Activar el tema oscuro para la interfaz
                  </p>
                </div>
                <Switch disabled />
              </div>
              <p className="text-sm text-muted-foreground">
                * Algunas opciones requieren permisos de administrador para ser modificadas.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cámara Fría Tab */}
        <TabsContent value="camara">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Cámara Fría</CardTitle>
              <CardDescription>Parámetros de temperatura y alertas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Temperatura Mínima (°C)</Label>
                  <Input type="number" defaultValue="2" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Temperatura Máxima (°C)</Label>
                  <Input type="number" defaultValue="8" disabled />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Alertas de Temperatura</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir notificaciones cuando la temperatura esté fuera de rango
                  </p>
                </div>
                <Switch defaultChecked disabled />
              </div>
              <div className="space-y-2">
                <Label>Intervalo de Registro (minutos)</Label>
                <Input type="number" defaultValue="30" disabled />
              </div>
              <p className="text-sm text-muted-foreground">
                * Estas configuraciones serán implementadas en una futura actualización.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
