import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Receipt, Plus, Upload, Loader2, Trash2, Image as ImageIcon, ScanLine } from "lucide-react";
import { useGastos } from "@/hooks/useGastos";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORIAS = [
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "viaticos", label: "Viáticos" },
  { value: "combustible", label: "Combustible" },
  { value: "papeleria", label: "Papelería" },
  { value: "limpieza", label: "Limpieza" },
  { value: "refacciones", label: "Refacciones" },
  { value: "servicios", label: "Servicios" },
  { value: "otros", label: "Otros" },
];

const categoriaBadgeColor: Record<string, string> = {
  mantenimiento: "bg-orange-100 text-orange-800",
  viaticos: "bg-blue-100 text-blue-800",
  combustible: "bg-red-100 text-red-800",
  papeleria: "bg-gray-100 text-gray-800",
  limpieza: "bg-teal-100 text-teal-800",
  refacciones: "bg-yellow-100 text-yellow-800",
  servicios: "bg-purple-100 text-purple-800",
  otros: "bg-muted text-muted-foreground",
};

export default function Gastos() {
  const { gastos, isLoading, createGasto, deleteGasto, uploadTicketImage, processOCR } = useGastos();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    concepto: "",
    categoria: "otros",
    monto: "",
    proveedor: "",
    numero_ticket: "",
    notas: "",
  });

  const resetForm = () => {
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      concepto: "",
      categoria: "otros",
      monto: "",
      proveedor: "",
      numero_ticket: "",
      notas: "",
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleOCR = async () => {
    if (!imageFile) return;
    setOcrLoading(true);
    try {
      const data = await processOCR(imageFile);
      setForm((prev) => ({
        ...prev,
        concepto: data.concepto || prev.concepto,
        categoria: data.categoria || prev.categoria,
        monto: data.monto?.toString() || prev.monto,
        proveedor: data.proveedor || prev.proveedor,
        numero_ticket: data.numero_ticket || prev.numero_ticket,
        fecha: data.fecha || prev.fecha,
      }));
    } catch {
      // error handled by hook
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.concepto || !form.monto) return;

    let imagen_url: string | null = null;
    if (imageFile) {
      imagen_url = await uploadTicketImage(imageFile);
    }

    await createGasto.mutateAsync({
      fecha: form.fecha,
      concepto: form.concepto,
      categoria: form.categoria,
      monto: parseFloat(form.monto),
      proveedor: form.proveedor || null,
      numero_ticket: form.numero_ticket || null,
      notas: form.notas || null,
      imagen_url,
      usuario_id: user?.id || null,
    });

    resetForm();
    setOpen(false);
  };

  const gastosFiltrados = filtroCategoria === "todas"
    ? gastos
    : gastos.filter((g) => g.categoria === filtroCategoria);

  const totalGastos = gastosFiltrados.reduce((sum, g) => sum + g.monto, 0);

  return (
    <MainLayout title="Gastos">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="Control de Gastos" icon={Receipt} description="Registra y controla los gastos del empaque" />
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nuevo Gasto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Gasto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* OCR Section */}
                <Card className="border-dashed">
                  <CardContent className="pt-4 space-y-3">
                    <Label className="flex items-center gap-2">
                      <ScanLine className="w-4 h-4" /> Escanear ticket (OCR)
                    </Label>
                    <Input type="file" accept="image/*" onChange={handleImageChange} />
                    {imagePreview && (
                      <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-contain rounded-md border" />
                    )}
                    {imageFile && (
                      <Button variant="secondary" onClick={handleOCR} disabled={ocrLoading} className="w-full">
                        {ocrLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : <><Upload className="w-4 h-4 mr-2" />Extraer datos del ticket</>}
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Concepto *</Label>
                  <Input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="Descripción del gasto" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monto *</Label>
                    <Input type="number" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>No. Ticket/Folio</Label>
                    <Input value={form.numero_ticket} onChange={(e) => setForm({ ...form, numero_ticket: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} />
                </div>

                <Button onClick={handleSubmit} disabled={createGasto.isPending || !form.concepto || !form.monto} className="w-full">
                  {createGasto.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Guardar Gasto
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Gastos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">${totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Registros</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{gastosFiltrados.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Filtrar por categoría</CardTitle></CardHeader>
            <CardContent>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : gastosFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay gastos registrados</TableCell></TableRow>
                ) : (
                  gastosFiltrados.map((gasto) => (
                    <TableRow key={gasto.id}>
                      <TableCell>{format(new Date(gasto.fecha), "dd MMM yyyy", { locale: es })}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{gasto.concepto}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={categoriaBadgeColor[gasto.categoria] || ""}>
                          {CATEGORIAS.find((c) => c.value === gasto.categoria)?.label || gasto.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>{gasto.proveedor || "—"}</TableCell>
                      <TableCell className="text-right font-mono">${gasto.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {gasto.imagen_url ? (
                          <a href={gasto.imagen_url} target="_blank" rel="noopener noreferrer">
                            <ImageIcon className="w-4 h-4 text-primary" />
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteGasto.mutate(gasto.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
