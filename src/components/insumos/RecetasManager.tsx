import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Loader2, ChefHat, PackageX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type CalidadLimon = Database["public"]["Enums"]["calidad_limon"];
type TipoInsumo = Database["public"]["Enums"]["tipo_insumo"];
type BaseReceta = "por_caja" | "por_pallet";

const CALIDADES: CalidadLimon[] = ["primera", "segunda"];

const BASE_LABELS: Record<BaseReceta, string> = {
  por_caja: "Por caja",
  por_pallet: "Por pallet (56 cajas)",
};

const TIPO_LABELS: Record<string, string> = {
  caja_plastica: "Caja Plástica",
  arpilla: "Arpilla",
  tarima: "Tarima",
  esquinero: "Esquinero",
  fleje: "Fleje",
  cera: "Cera",
  caja_carton: "Caja Cartón",
};

const calidadLabel = (c: CalidadLimon) =>
  c ? c.charAt(0).toUpperCase() + c.slice(1) : "Sin calidad";

// Radix Select lanza error si un <SelectItem value="">; usar centinela para "General"
const PRESENTACION_GENERAL = "__general__";

interface InsumoOption {
  id: string;
  nombre: string;
  tipo: TipoInsumo;
  stock: number;
}

interface PresentacionOption {
  id: string;
  nombre: string;
}

interface DetalleEditor {
  key: string;
  insumoId: string;
  cantidad: string;
  base: BaseReceta;
}

interface RecetaRow {
  id: string;
  calidad: CalidadLimon;
  presentacion_id: string | null;
  activa: boolean;
  presentacion?: { nombre: string } | null;
  detalles: Array<{
    id: string;
    insumo_id: string | null;
    cantidad: number;
    base: string;
    insumos?: { nombre: string; tipo: TipoInsumo } | null;
  }>;
}

const detalleKey = () => Math.random().toString(36).slice(2, 9);

const nuevoEditor = (): {
  recetaId: string | null;
  calidad: CalidadLimon;
  presentacionId: string;
  activa: boolean;
  detalles: DetalleEditor[];
} => ({
  recetaId: null,
  calidad: "primera",
  presentacionId: PRESENTACION_GENERAL,
  activa: true,
  detalles: [],
});

export function RecetasManager() {
  const queryClient = useQueryClient();

  const { data: insumos = [] } = useQuery<InsumoOption[]>({
    queryKey: ["insumos-recetas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("id, nombre, tipo, cantidad_disponible")
        .order("nombre");

      if (error) throw error;
      return (data || []).map((i) => ({
        id: i.id,
        nombre: i.nombre,
        tipo: i.tipo,
        stock: i.cantidad_disponible,
      }));
    },
  });

  const { data: presentaciones = [] } = useQuery<PresentacionOption[]>({
    queryKey: ["presentaciones-recetas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presentaciones")
        .select("id, nombre")
        .eq("activa", true)
        .order("nombre");

      if (error) throw error;
      return (data || []).map((p) => ({ id: p.id, nombre: p.nombre }));
    },
  });

  const { data: recetas = [], isLoading: cargandoRecetas } = useQuery<RecetaRow[]>({
    queryKey: ["recetas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recetas")
        .select(`
          *,
          presentacion:presentaciones(nombre),
          detalles:receta_detalles(insumo_id, cantidad, base, insumos(id, nombre, tipo))
        `)
        .order("calidad")
        .order("presentacion_id", { ascending: false });

      if (error) throw error;
      return (data || []) as RecetaRow[];
    },
  });

  const [editor, setEditor] = useState(nuevoEditor);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    if (editor.recetaId) {
      const receta = recetas.find((r) => r.id === editor.recetaId);
      if (receta) {
        setEditor({
          recetaId: receta.id,
          calidad: receta.calidad,
          presentacionId: receta.presentacion_id ?? PRESENTACION_GENERAL,
          activa: receta.activa,
          detalles: (receta.detalles ?? []).map((d) => ({
            key: detalleKey(),
            insumoId: d.insumo_id ?? "",
            cantidad: String(d.cantidad),
            base: (d.base === "por_pallet" ? "por_pallet" : "por_caja") as BaseReceta,
          })),
        });
      }
    }
  }, [editor.recetaId, recetas]);

  const selectReceta = useCallback((id: string) => {
    setEditor((prev) => ({ ...prev, recetaId: id }));
  }, []);

  const nuevaReceta = useCallback(() => {
    setEditor(nuevoEditor());
  }, []);

  const agregarDetalle = useCallback(() => {
    setEditor((prev) => ({
      ...prev,
      detalles: [...prev.detalles, { key: detalleKey(), insumoId: "", cantidad: "1", base: "por_caja" }],
    }));
  }, []);

  const actualizarDetalle = useCallback((key: string, patch: Partial<DetalleEditor>) => {
    setEditor((prev) => ({
      ...prev,
      detalles: prev.detalles.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    }));
  }, []);

  const quitarDetalle = useCallback((key: string) => {
    setEditor((prev) => ({
      ...prev,
      detalles: prev.detalles.filter((d) => d.key !== key),
    }));
  }, []);

  const guardar = async () => {
    if (!editor.calidad) {
      toast.error("Selecciona la calidad de la receta");
      return;
    }

    const detallesValidos = editor.detalles.filter((d) => d.insumoId);
    if (detallesValidos.length === 0) {
      toast.error("Agrega al menos un insumo a la receta");
      return;
    }

    setGuardando(true);
    try {
      const { data: recetaId, error } = await supabase.rpc("guardar_receta", {
        p_calidad: editor.calidad,
        p_presentacion_id: editor.presentacionId === PRESENTACION_GENERAL ? null : editor.presentacionId,
        p_activa: editor.activa,
        p_detalles: detallesValidos.map((d) => ({
          insumo_id: d.insumoId,
          cantidad: Math.max(1, Number(d.cantidad) || 1),
          base: d.base,
        })),
      });

      if (error) throw error;

      toast.success(editor.recetaId ? "Receta actualizada" : "Receta creada", {
        description: `Receta ${calidadLabel(editor.calidad)}${editor.presentacionId !== PRESENTACION_GENERAL ? ` (${presentaciones.find((p) => p.id === editor.presentacionId)?.nombre ?? ""})` : " (General)"}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["recetas"] });
      setEditor((prev) => ({ ...prev, recetaId: recetaId as string }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la receta";
      toast.error("Error al guardar receta", { description: message });
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!editor.recetaId) return;

    setBorrando(true);
    try {
      const { error } = await supabase.from("recetas").delete().eq("id", editor.recetaId);
      if (error) throw error;

      toast.success("Receta eliminada");
      await queryClient.invalidateQueries({ queryKey: ["recetas"] });
      setEditor(nuevoEditor());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar la receta";
      toast.error("Error al eliminar receta", { description: message });
    } finally {
      setBorrando(false);
    }
  };

  const insumoLabel = (insumoId: string) => {
    const i = insumos.find((x) => x.id === insumoId);
    return i ? `${i.nombre} (${TIPO_LABELS[i.tipo] ?? i.tipo})` : "Selecciona insumo";
  };

  const recetaTitulo = (r: RecetaRow) =>
    r.presentacion_id
      ? `${calidadLabel(r.calidad)} · ${r.presentacion?.nombre ?? "Presentación"}`
      : `${calidadLabel(r.calidad)} · General`;

  return (
    <Card className="module-card">
      <CardHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ChefHat className="h-5 w-5 text-primary" />
              Recetas de Empaque (BOM)
            </CardTitle>
            <CardDescription>
              Define qué insumos se consumen por caja o por pallet en cada calidad/presentación. Se aplica al registrar producción.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={nuevaReceta}>
            <Plus className="h-4 w-4 mr-1" /> Nueva receta
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Lista de recetas */}
          <div className="lg:col-span-4 space-y-2">
            {cargandoRecetas && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando recetas...
              </div>
            )}

            {!cargandoRecetas && recetas.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                <PackageX className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Sin recetas. Crea una nueva para empezar.
              </div>
            )}

            {recetas.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectReceta(r.id)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors",
                  editor.recetaId === r.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{recetaTitulo(r)}</span>
                  <Badge variant={r.activa ? "default" : "outline"} className="text-[10px]">
                    {r.activa ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.detalles.length} concepto{r.detalles.length === 1 ? "" : "s"}
                </p>
              </button>
            ))}
          </div>

          {/* Editor */}
          <div className="lg:col-span-8 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Calidad</Label>
                <Select
                  value={editor.calidad}
                  onValueChange={(v) => setEditor((prev) => ({ ...prev, calidad: v as CalidadLimon }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALIDADES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {calidadLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Presentación</Label>
                <Select
                  value={editor.presentacionId}
                  onValueChange={(v) => setEditor((prev) => ({ ...prev, presentacionId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="General" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PRESENTACION_GENERAL}>General (todas)</SelectItem>
                    {presentaciones.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end justify-between gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editor.activa}
                    onCheckedChange={(v) => setEditor((prev) => ({ ...prev, activa: v }))}
                  />
                  <Label className="cursor-pointer">Activa</Label>
                </div>
              </div>
            </div>

            {/* Detalles */}
            <div className="rounded-lg border">
              <div className="border-b bg-muted/40 px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">Insumos de la receta</span>
                <Button variant="ghost" size="sm" onClick={agregarDetalle}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar insumo
                </Button>
              </div>

              <div className="divide-y">
                {editor.detalles.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    Aún no hay insumos en esta receta.
                  </p>
                )}

                {editor.detalles.map((d) => (
                  <div key={d.key} className="grid grid-cols-12 gap-3 px-4 py-3 items-end">
                    <div className="col-span-12 md:col-span-6 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Insumo</Label>
                      <Select
                        value={d.insumoId}
                        onValueChange={(v) => actualizarDetalle(d.key, { insumoId: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          {insumos.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.nombre} ({TIPO_LABELS[i.tipo] ?? i.tipo}) · {i.stock} disp.
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-4 md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        value={d.cantidad}
                        onChange={(e) => actualizarDetalle(d.key, { cantidad: e.target.value })}
                      />
                    </div>

                    <div className="col-span-6 md:col-span-3 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Base</Label>
                      <Select
                        value={d.base}
                        onValueChange={(v) => actualizarDetalle(d.key, { base: v as BaseReceta })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="por_caja">{BASE_LABELS.por_caja}</SelectItem>
                          <SelectItem value="por_pallet">{BASE_LABELS.por_pallet}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 md:col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => quitarDetalle(d.key)}
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground max-w-md">
                La receta más específica (presentación) tiene prioridad sobre la general de la misma calidad.
              </p>
              <div className="flex items-center gap-2">
                {editor.recetaId && (
                  <Button variant="outline" className="text-destructive" onClick={borrar} disabled={borrando}>
                    {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                    Eliminar
                  </Button>
                )}
                <Button onClick={guardar} disabled={guardando}>
                  {guardando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {editor.recetaId ? "Actualizar receta" : "Guardar receta"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
