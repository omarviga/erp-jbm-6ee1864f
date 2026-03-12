import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Productor } from "@/hooks/useProductores";
import { toast } from "sonner";
import { Plus, Search, Loader2, UserPlus, Phone, FileText, Edit2, Trash2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, "RFC inválido. Formato esperado: XXXX999999XXX")
    .optional()
    .or(z.literal("")),
});

type ProductorInput = z.infer<typeof productorSchema>;


export default function Productores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProductor, setEditingProductor] = useState<Productor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const form = useForm<ProductorInput>({
    resolver: zodResolver(productorSchema),
    defaultValues: {
      nombre: "",
      telefono: "",
      rfc: "",
    },
  });

  // Fetch productores
  const { data: productores, isLoading } = useQuery({
    queryKey: ["productores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productores")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data as Productor[];
    },
  });

  // Create productor
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productores"] });
      toast.success("✅ Productor registrado correctamente");
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error("❌ Error al registrar productor", { description: error.message });
    },
  });

  // Update productor
  const updateProductor = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductorInput }) => {
      const { error } = await supabase
        .from("productores")
        .update({
          nombre: data.nombre.trim(),
          telefono: data.telefono?.trim() || null,
          rfc: data.rfc?.trim().toUpperCase() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productores"] });
      toast.success("✅ Productor actualizado");
      form.reset();
      setDialogOpen(false);
      setEditingProductor(null);
    },
    onError: (error: Error) => {
      toast.error("❌ Error al actualizar", { description: error.message });
    },
  });

  // Delete productor
  const deleteProductor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("productores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productores"] });
      toast.success("Productor eliminado");
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast.error("❌ Error al eliminar", { description: error.message });
    },
  });

  const openEditDialog = (productor: Productor) => {
    setEditingProductor(productor);
    form.reset({
      nombre: productor.nombre,
      telefono: productor.telefono || "",
      rfc: productor.rfc || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ProductorInput) => {
    if (editingProductor) {
      updateProductor.mutate({ id: editingProductor.id, data });
    } else {
      createProductor.mutate(data);
    }
  };

  const filteredProductores = productores?.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.telefono?.includes(searchTerm) ||
    p.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalProductores = productores?.length || 0;
  const productoresConAnticipo = productores?.filter((p) => (p.saldo_anticipos || 0) > 0).length || 0;
  const productoresConSaldoPendiente = productores?.filter((p) => (p.saldo_pendiente || 0) > 0).length || 0;
  const saldoPendienteTotal = productores?.reduce((sum, productor) => sum + (productor.saldo_pendiente || 0), 0) || 0;

  const isPending = createProductor.isPending || updateProductor.isPending;

  return (
    <MainLayout title="Productores" subtitle="Directorio, contacto y saldos de productores">
      <div className="space-y-6">
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Directorio operativo</p>
                <h2 className="text-2xl font-bold text-slate-900">Productores y saldos</h2>
                <p className="text-sm text-slate-600">Consulta rápidamente contacto, RFC y situación financiera de cada productor.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{totalProductores} registrados</Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{productoresConAnticipo} con anticipos</Badge>
                <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">{productoresConSaldoPendiente} con saldo pendiente</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total productores</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{totalProductores}</p>
            </CardContent>
          </Card>
          <Card className="border border-amber-200 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Con anticipos</p>
              <p className="mt-2 text-3xl font-black text-amber-700">{productoresConAnticipo}</p>
            </CardContent>
          </Card>
          <Card className="border border-blue-200 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Saldo pendiente total</p>
              <p className="mt-2 text-3xl font-black text-blue-700">${saldoPendienteTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, teléfono o RFC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  form.reset({ nombre: "", telefono: "", rfc: "" });
                  setEditingProductor(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Productor
                  </Button>
                </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      {editingProductor ? "Editar Productor" : "Nuevo Productor"}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <FormField
                      control={form.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre completo *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Juan Pérez González" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="telefono"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono (10 dígitos)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej: 3121234567"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rfc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RFC (opcional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej: XAXX010101000"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase().slice(0, 13))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <DialogClose asChild>
                      <Button variant="outline" type="button" disabled={isPending}>
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          {editingProductor ? "Guardar Cambios" : "Registrar"}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de productores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Lista de Productores
              {filteredProductores && (
                <Badge variant="secondary" className="ml-2">
                  {filteredProductores.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProductores?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm ? "No se encontraron productores" : "No hay productores registrados"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead className="text-right">Anticipos</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProductores?.map((productor) => (
                    <TableRow key={productor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{productor.nombre}</span>
                          {(productor.saldo_pendiente || 0) > 0 && (
                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Pendiente</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {productor.telefono ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {productor.telefono}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {productor.rfc || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={(productor.saldo_anticipos || 0) > 0 ? "font-semibold text-amber-700" : "text-slate-600"}>
                          ${(productor.saldo_anticipos || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={(productor.saldo_pendiente || 0) > 0 ? "font-semibold text-blue-700" : "text-slate-600"}>
                          ${(productor.saldo_pendiente || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(productor)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(productor.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmación de eliminación */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente al productor
              y todos los datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteProductor.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
