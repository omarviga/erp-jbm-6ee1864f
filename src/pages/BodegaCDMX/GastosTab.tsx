import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Receipt, Upload, FileImage, X, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Database } from "@/integrations/supabase/types";

type CategoriaGasto = Database['public']['Enums']['categoria_gasto'];

const CATEGORIAS: { value: CategoriaGasto; label: string }[] = [
  { value: 'viaticos', label: 'Viáticos' },
  { value: 'combustible', label: 'Combustible' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'papeleria', label: 'Papelería' },
  { value: 'refacciones', label: 'Refacciones' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'otros', label: 'Otros' },
];

export default function GastosTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    concepto: '',
    monto: '',
    categoria: 'otros' as CategoriaGasto,
    proveedor: '',
    numero_ticket: '',
    notas: '',
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [archivoPreview, setArchivoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch gastos de CDMX (could filter by centro_de_costo in future)
  const { data: gastos, isLoading } = useQuery({
    queryKey: ['gastos-cdmx'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const totalGastosMes = gastos?.reduce((sum, g) => {
    const gastoDate = new Date(g.fecha);
    const now = new Date();
    if (gastoDate.getMonth() === now.getMonth() && gastoDate.getFullYear() === now.getFullYear()) {
      return sum + g.monto;
    }
    return sum;
  }, 0) || 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivo(file);
    if (file.type.startsWith('image/')) {
      setArchivoPreview(URL.createObjectURL(file));
    } else {
      setArchivoPreview(null);
    }
  };

  const removeFile = () => {
    if (archivoPreview) URL.revokeObjectURL(archivoPreview);
    setArchivo(null);
    setArchivoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.concepto || !formData.monto) {
      toast.error("Completa los campos requeridos");
      return;
    }

    const monto = parseFloat(formData.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    setSubmitting(true);

    try {
      let imagen_url = null;

      // Upload file if exists
      if (archivo) {
        const ext = archivo.name.split('.').pop();
        const path = `gastos-cdmx/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('gastos-tickets')
          .upload(path, archivo);

        if (uploadError) {
          console.error("Error uploading file:", uploadError);
        } else {
          const { data: urlData } = supabase.storage.from('gastos-tickets').getPublicUrl(path);
          imagen_url = urlData.publicUrl;
        }
      }

      // Insert gasto - automatically assigned to CDMX context
      const { error } = await supabase.from('gastos').insert({
        concepto: formData.concepto,
        monto,
        categoria: formData.categoria,
        proveedor: formData.proveedor || null,
        numero_ticket: formData.numero_ticket || null,
        notas: formData.notas ? `[BODEGA CDMX] ${formData.notas}` : '[BODEGA CDMX]',
        imagen_url,
        usuario_id: user?.id,
      });

      if (error) throw error;

      toast.success("Gasto registrado correctamente");
      
      // Reset form
      setFormData({
        concepto: '',
        monto: '',
        categoria: 'otros',
        proveedor: '',
        numero_ticket: '',
        notas: '',
      });
      removeFile();
      queryClient.invalidateQueries({ queryKey: ['gastos-cdmx'] });

    } catch (err: any) {
      console.error("Error saving gasto:", err);
      toast.error("Error al registrar gasto", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Gastos Locales</h1>
        <p className="text-sm text-muted-foreground">Registro de gastos de la Bodega CDMX</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 flex-1">
        {/* Left: Form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nuevo Gasto
            </CardTitle>
            <CardDescription>
              Todos los gastos se asignan automáticamente al centro de costo de Bodega CDMX.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Concepto *</Label>
                  <Input
                    placeholder="Ej: Comida para cargadores"
                    value={formData.concepto}
                    onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Monto *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-7"
                      value={formData.monto}
                      onChange={(e) => setFormData(prev => ({ ...prev, monto: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Categoría</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value as CategoriaGasto }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Proveedor</Label>
                  <Input
                    placeholder="Opcional"
                    value={formData.proveedor}
                    onChange={(e) => setFormData(prev => ({ ...prev, proveedor: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>No. Ticket / Factura</Label>
                  <Input
                    placeholder="Opcional"
                    value={formData.numero_ticket}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero_ticket: e.target.value }))}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="Observaciones adicionales..."
                    value={formData.notas}
                    onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                  />
                </div>
              </div>

              {/* File upload with drag & drop styling */}
              <div className="space-y-2">
                <Label>Comprobante (Foto/PDF)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                {!archivo ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Arrastra un archivo o haz clic para subir
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Imagen o PDF del ticket/factura
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 flex items-center gap-4">
                    {archivoPreview ? (
                      <img src={archivoPreview} alt="Preview" className="h-20 w-20 object-cover rounded" />
                    ) : (
                      <div className="h-20 w-20 bg-muted rounded flex items-center justify-center">
                        <FileImage className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{archivo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(archivo.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#1E5128] hover:bg-[#1E5128]/90"
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                ) : (
                  <><Receipt className="w-4 h-4 mr-2" /> Registrar Gasto</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: History */}
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Gastos del Mes</p>
                  <p className="text-3xl font-black text-red-600">
                    ${totalGastosMes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Receipt className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          {/* List */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Historial Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !gastos || gastos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin gastos registrados</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {gastos.map((gasto) => (
                    <div key={gasto.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{gasto.concepto}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(gasto.fecha), "dd MMM yyyy", { locale: es })}
                            {gasto.proveedor && ` • ${gasto.proveedor}`}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-bold text-red-600 font-mono">
                            -${gasto.monto.toFixed(2)}
                          </p>
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {CATEGORIAS.find(c => c.value === gasto.categoria)?.label || gasto.categoria}
                          </Badge>
                        </div>
                      </div>
                      {gasto.imagen_url && (
                        <a
                          href={gasto.imagen_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                          <FileImage className="h-3 w-3" /> Ver comprobante
                        </a>
                      )}
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
