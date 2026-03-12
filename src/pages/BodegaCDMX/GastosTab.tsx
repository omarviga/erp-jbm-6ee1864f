import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileImage, Loader2, Plus, Receipt, ScanLine, Upload, X } from "lucide-react";

type CategoriaGasto = Database["public"]["Enums"]["categoria_gasto"];

const CATEGORIAS: { value: CategoriaGasto; label: string }[] = [
  { value: "viaticos", label: "Viaticos" },
  { value: "combustible", label: "Combustible" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "limpieza", label: "Limpieza" },
  { value: "papeleria", label: "Papeleria" },
  { value: "refacciones", label: "Refacciones" },
  { value: "servicios", label: "Servicios" },
  { value: "otros", label: "Otros" },
];

export default function GastosTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    concepto: "",
    monto: "",
    categoria: "otros" as CategoriaGasto,
    proveedor: "",
    numero_ticket: "",
    notas: "",
  });

  const { data: gastos, isLoading } = useQuery({
    queryKey: ["gastos-cdmx-rebuild"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gastos_cdmx")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data || [];
    },
  });

  const totalMes = useMemo(() => {
    const now = new Date();
    return (gastos || []).reduce((acc, row) => {
      const d = new Date(row.fecha);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        return acc + row.monto;
      }
      return acc;
    }, 0);
  }, [gastos]);

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const setTicketFile = (next: File) => {
    clearFile();
    setFile(next);
    if (next.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(next));
    }
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (!dropped) return;
    setTicketFile(dropped);
  };

  const handleOCR = async () => {
    if (!file) {
      toast.error("Primero sube una imagen del ticket");
      return;
    }

    setOcrLoading(true);
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("No se pudo leer el archivo"));
            return;
          }
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("process-gasto-ocr", {
        body: {
          imageBase64,
          fileName: file.name,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "No se pudo procesar el ticket");

      const ocrData = data.data || {};

      setForm((prev) => ({
        ...prev,
        fecha: ocrData.fecha || prev.fecha,
        concepto: ocrData.concepto || prev.concepto,
        categoria: ocrData.categoria || prev.categoria,
        monto: ocrData.monto?.toString() || prev.monto,
        proveedor: ocrData.proveedor || prev.proveedor,
        numero_ticket: ocrData.numero_ticket || prev.numero_ticket,
      }));

      toast.success("Datos del ticket extraidos");
    } catch (error: any) {
      toast.error("No se pudo procesar el OCR", {
        description: error?.message || "Error desconocido",
      });
    } finally {
      setOcrLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.concepto || !form.monto) {
      toast.error("Captura concepto y monto");
      return;
    }

    const monto = Number(form.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error("Monto invalido");
      return;
    }

    setSaving(true);
    try {
      let imagen_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `gastos-cdmx/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage.from("gastos-tickets").upload(path, file);
        if (uploadError) throw uploadError;

        const { data: signed } = await supabase.storage.from("gastos-tickets").createSignedUrl(path, 3600 * 24);
        imagen_url = signed?.signedUrl || null;
      }

      const { error } = await supabase.from("gastos_cdmx").insert({
        fecha: form.fecha,
        concepto: form.concepto,
        monto,
        categoria: form.categoria,
        proveedor: form.proveedor || null,
        numero_ticket: form.numero_ticket || null,
        notas: form.notas || null,
        imagen_url,
        usuario_id: user?.id || null,
      });

      if (error) throw error;

      toast.success("Gasto registrado en centro de costo CDMX");
      setForm({
        fecha: new Date().toISOString().split("T")[0],
        concepto: "",
        monto: "",
        categoria: "otros",
        proveedor: "",
        numero_ticket: "",
        notas: "",
      });
      clearFile();
      await queryClient.invalidateQueries({ queryKey: ["gastos-cdmx-rebuild"] });
    } catch (error: any) {
      toast.error("No se pudo guardar el gasto", { description: error?.message || "Error desconocido" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Gastos CDMX</h1>
        <p className="text-sm text-muted-foreground">Registrados en tabla exclusiva de CDMX, separados de matriz.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Nuevo gasto</CardTitle>
            <CardDescription>Formulario exclusivo para gastos operativos de Bodega CDMX.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <Card className="border-dashed">
                <CardContent className="space-y-3 pt-4">
                  <Label className="flex items-center gap-2">
                    <ScanLine className="h-4 w-4" />
                    Escanear ticket (OCR)
                  </Label>

                  {!file ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={onDrop}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
                    >
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm">Arrastra ticket aqui o haz clic para subir</p>
                      <p className="text-xs text-muted-foreground mt-1">Imagen o PDF</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3 flex items-center gap-3">
                        {preview ? <img src={preview} alt="ticket" className="h-16 w-16 rounded object-cover" /> : <FileImage className="h-8 w-8 text-muted-foreground" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <Button type="button" size="icon" variant="ghost" onClick={clearFile}><X className="h-4 w-4" /></Button>
                      </div>

                      <Button type="button" variant="secondary" className="w-full" onClick={handleOCR} disabled={ocrLoading}>
                        {ocrLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</> : <><Upload className="h-4 w-4 mr-2" />Extraer datos del ticket</>}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} />
                </div>

                <div className="col-span-2">
                  <Label>Concepto</Label>
                  <Input value={form.concepto} onChange={(e) => setForm((p) => ({ ...p, concepto: e.target.value }))} />
                </div>

                <div>
                  <Label>Monto</Label>
                  <Input type="number" min={0} step="0.01" value={form.monto} onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))} />
                </div>

                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v as CategoriaGasto }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Proveedor</Label>
                  <Input value={form.proveedor} onChange={(e) => setForm((p) => ({ ...p, proveedor: e.target.value }))} />
                </div>

                <div>
                  <Label>No. Ticket</Label>
                  <Input value={form.numero_ticket} onChange={(e) => setForm((p) => ({ ...p, numero_ticket: e.target.value }))} />
                </div>

                <div className="col-span-2">
                  <Label>Notas</Label>
                  <Textarea value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} />
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && setTicketFile(e.target.files[0])} />

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</> : <><Receipt className="h-4 w-4 mr-2" /> Registrar gasto</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground font-bold">Gasto total del mes (CDMX)</p>
              <p className="text-3xl font-black text-red-600">${totalMes.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !gastos?.length ? (
                <p className="text-sm text-muted-foreground">Sin gastos CDMX.</p>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
                  {gastos.map((g) => (
                    <div key={g.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-medium">{g.concepto}</p>
                          <p className="text-xs text-muted-foreground">{new Date(g.fecha).toLocaleDateString("es-MX")}</p>
                        </div>
                        <p className="font-semibold text-red-600">-${g.monto.toFixed(2)}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">{CATEGORIAS.find((x) => x.value === g.categoria)?.label || g.categoria}</Badge>
                        {g.imagen_url && (
                          <a href={g.imagen_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver ticket</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
