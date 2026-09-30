import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, PackagePlus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TipoInsumo = Database["public"]["Enums"]["tipo_insumo"];

const TIPOS_INSUMO: TipoInsumo[] = [
  "caja_plastica",
  "arpilla",
  "tarima",
  "esquinero",
  "fleje",
  "cera",
  "caja_carton",
];

const TIPO_LABELS: Record<TipoInsumo, string> = {
  caja_plastica: "Caja Plástica",
  arpilla: "Arpilla",
  tarima: "Tarima",
  esquinero: "Esquinero",
  fleje: "Fleje",
  cera: "Cera",
  caja_carton: "Caja Cartón",
};

const estadoInicial = { nombre: "", tipo: "" as TipoInsumo | "", cantidad: "", costo: "", minimo: "10" };

export function AltaInsumo() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(estadoInicial);

  const mutation = useMutation({
    mutationFn: async () => {
      const nombre = form.nombre.trim();
      const cantidad = Number(form.cantidad);
      const costo = Number(form.costo);
      const minimo = Number(form.minimo) || 10;

      if (!nombre || !form.tipo) {
        throw new Error("Nombre y tipo son requeridos");
      }
      if (!cantidad || cantidad <= 0) {
        throw new Error("La cantidad inicial debe ser mayor a 0");
      }

      const { data: insumo, error } = await supabase
        .from("insumos")
        .insert({
          nombre,
          tipo: form.tipo,
          cantidad_disponible: cantidad,
          cantidad_minima: minimo,
          costo_unitario: costo,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: movError } = await supabase
        .from("insumo_movimientos")
        .insert({
          insumo_id: insumo.id,
          tipo_movimiento: "entrada",
          cantidad,
          referencia: "Alta inicial de insumo",
        });

      if (movError) throw movError;
    },
    onSuccess: async () => {
      toast.success("Insumo registrado", {
        description: `${form.nombre} dado de alta con ${Number(form.cantidad)} unidades.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["insumos"] });
      await queryClient.invalidateQueries({ queryKey: ["insumo_movimientos"] });
      await queryClient.invalidateQueries({ queryKey: ["insumos-recetas"] });
      setForm(estadoInicial);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo registrar el insumo";
      toast.error("Error al dar de alta", { description: message });
    },
  });

  return (
    <Card className="module-card">
      <CardHeader className="border-b px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PackagePlus className="h-5 w-5 text-primary" />
          Alta de Insumo
        </CardTitle>
        <CardDescription>
          Registra nuevos materiales: tarima estufada (exportación), tarima nacional, fleje, cera, etc.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          <Label>Nombre del material</Label>
          <Input
            placeholder="Ej: Tarima estufada (exportación)"
            value={form.nombre}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm((prev) => ({ ...prev, tipo: v as TipoInsumo }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_INSUMO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cantidad inicial</Label>
            <Input
              type="number"
              min="1"
              placeholder="0"
              value={form.cantidad}
              onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Costo unitario ($)</Label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={form.costo}
              onChange={(e) => setForm((prev) => ({ ...prev, costo: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Stock mínimo</Label>
            <Input
              type="number"
              min="0"
              value={form.minimo}
              onChange={(e) => setForm((prev) => ({ ...prev, minimo: e.target.value }))}
            />
          </div>
        </div>

        <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Dar de alta insumo
        </Button>
      </CardContent>
    </Card>
  );
}
