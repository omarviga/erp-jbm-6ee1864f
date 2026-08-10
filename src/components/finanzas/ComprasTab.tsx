import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Package,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Save,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InsumoExtraido {
  nombre: string;
  tipo_insumo: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface DatosFactura {
  proveedor: string;
  numero_factura: string;
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
  insumos: InsumoExtraido[];
}

type TipoInsumo = Database["public"]["Enums"]["tipo_insumo"];
type ErrorLike = { message?: string };

const TIPOS_INSUMO = [
  "caja_plastica",
  "arpilla",
  "tarima",
  "esquinero",
  "fleje",
  "cera",
  "caja_carton",
] as const satisfies readonly TipoInsumo[];

const esTipoInsumoValido = (valor: string): valor is TipoInsumo =>
  TIPOS_INSUMO.includes(valor as TipoInsumo);

const extraerMensajeError = (error: unknown) =>
  (error as ErrorLike)?.message || "Error desconocido";

export function ComprasTab() {
  const [isDragging, setIsDragging] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [datosFactura, setDatosFactura] = useState<DatosFactura | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Solo se aceptan imágenes o archivos PDF");
      return;
    }

    setProcesando(true);
    setDatosFactura(null);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Create preview for images
      if (file.type.startsWith("image/")) {
        setImagenPreview(URL.createObjectURL(file));
      }

      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke("process-invoice-ocr", {
        body: { imageBase64: base64, fileName: file.name },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Error al procesar la factura");
      }

      setDatosFactura(data.data);
      toast.success("Factura procesada exitosamente");
    } catch (err: unknown) {
      console.error("Error processing invoice:", err);
      toast.error(extraerMensajeError(err));
    } finally {
      setProcesando(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleGuardarCompra = async () => {
    if (!datosFactura || datosFactura.insumos.length === 0) {
      toast.error("No hay insumos válidos para guardar");
      return;
    }

    setGuardando(true);

    try {
      // Update inventory for each insumo
      for (const insumo of datosFactura.insumos) {
        // First, try to find the insumo by name or type
        const { data: existingInsumo, error: searchError } = await supabase
          .from("insumos")
          .select("id, cantidad_disponible, costo_unitario")
          .or(`nombre.ilike.%${insumo.nombre}%,tipo.eq.${insumo.tipo_insumo}`)
          .limit(1)
          .maybeSingle();

        if (searchError) throw searchError;

        if (existingInsumo) {
          // Update existing insumo
          const nuevaCantidad = (existingInsumo.cantidad_disponible || 0) + insumo.cantidad;
          const nuevoCosto = insumo.precio_unitario; // Use the latest price

          const { error: updateError } = await supabase
            .from("insumos")
            .update({
              cantidad_disponible: nuevaCantidad,
              costo_unitario: nuevoCosto,
            })
            .eq("id", existingInsumo.id);

          if (updateError) throw updateError;

          // Register the movement
          const { error: movError } = await supabase
            .from("insumo_movimientos")
            .insert({
              insumo_id: existingInsumo.id,
              tipo_movimiento: "entrada",
              cantidad: insumo.cantidad,
              referencia: `Factura ${datosFactura.numero_factura} - ${datosFactura.proveedor}`,
            });

          if (movError) throw movError;
        } else {
          if (!esTipoInsumoValido(insumo.tipo_insumo)) {
            throw new Error(`Tipo de insumo no válido: ${insumo.tipo_insumo}`);
          }

          // Create new insumo if it doesn't exist
          const { data: newInsumo, error: insertError } = await supabase
            .from("insumos")
            .insert({
              nombre: insumo.nombre,
              tipo: insumo.tipo_insumo,
              cantidad_disponible: insumo.cantidad,
              costo_unitario: insumo.precio_unitario,
              cantidad_minima: 10,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          // Register the initial movement
          if (newInsumo) {
            const { error: movError } = await supabase
              .from("insumo_movimientos")
              .insert({
                insumo_id: newInsumo.id,
                tipo_movimiento: "entrada",
                cantidad: insumo.cantidad,
                referencia: `Factura ${datosFactura.numero_factura} - ${datosFactura.proveedor} (Alta inicial)`,
              });

            if (movError) throw movError;
          }
        }
      }

      toast.success("Inventario actualizado correctamente");
      setShowConfirmDialog(false);
      setDatosFactura(null);
      setImagenPreview(null);
    } catch (err: unknown) {
      console.error("Error saving purchase:", err);
      toast.error(extraerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const handleCancelar = () => {
    setDatosFactura(null);
    setImagenPreview(null);
    setShowConfirmDialog(false);
  };

  const tipoInsumoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      caja_plastica: "Caja Plástica",
      arpilla: "Arpilla",
      tarima: "Tarima",
      esquinero: "Esquinero",
      fleje: "Fleje",
      cera: "Cera",
      caja_carton: "Caja Cartón",
    };
    return labels[tipo] || tipo;
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <Card className={cn(
        "border-2 border-dashed transition-colors",
        isDragging && "border-primary bg-primary/5",
        procesando && "opacity-50 pointer-events-none"
      )}>
        <CardContent
          className="p-8"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center text-center">
            {procesando ? (
              <>
                <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium">Procesando factura con IA...</p>
                <p className="text-sm text-muted-foreground">Extrayendo información de insumos</p>
              </>
            ) : (
              <>
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Upload className="h-12 w-12 text-primary" />
                </div>
                <p className="text-lg font-medium mb-2">Arrastra una factura aquí</p>
                <p className="text-sm text-muted-foreground mb-4">
                  o haz clic para seleccionar un archivo (imagen o PDF)
                </p>
                <label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button variant="outline" className="cursor-pointer" asChild>
                    <span>
                      <Image className="h-4 w-4 mr-2" />
                      Seleccionar archivo
                    </span>
                  </Button>
                </label>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview and Results */}
      {datosFactura && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Image Preview */}
          {imagenPreview && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Imagen de Factura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={imagenPreview}
                  alt="Factura"
                  className="w-full rounded-lg border max-h-[400px] object-contain"
                />
              </CardContent>
            </Card>
          )}

          {/* Extracted Data */}
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Datos Extraídos
                </CardTitle>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  OCR Exitoso
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Invoice header info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Proveedor</Label>
                  <p className="font-medium">{datosFactura.proveedor}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">No. Factura</Label>
                  <p className="font-mono font-medium">{datosFactura.numero_factura}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha</Label>
                  <p>{datosFactura.fecha}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total</Label>
                  <p className="text-lg font-bold text-primary">
                    ${datosFactura.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Insumos Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Insumo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">P.Unit</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datosFactura.insumos.map((insumo, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{insumo.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tipoInsumoLabel(insumo.tipo_insumo)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{insumo.cantidad}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${insumo.precio_unitario.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          ${insumo.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={handleCancelar} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={() => setShowConfirmDialog(true)} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Actualizar Inventario
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Actualización de Inventario</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Se actualizarán las existencias de los siguientes insumos:
            </p>
            <div className="space-y-2">
              {datosFactura?.insumos.map((insumo, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="font-medium">{insumo.nombre}</span>
                  <Badge>+{insumo.cantidad} unidades</Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarCompra} disabled={guardando}>
              {guardando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
