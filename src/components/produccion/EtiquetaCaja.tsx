import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, Tag, Plus, Minus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EtiquetaInfo {
  numeroLote: string;
  calibre: string;
  color: string;
  presentacion: string;
  pesoKg: number;
  fecha: Date;
  productor?: string;
  huerto?: string;
}

interface EtiquetaCajaProps {
  etiquetaInfo: EtiquetaInfo;
  disabled?: boolean;
}

export function EtiquetaCaja({ etiquetaInfo, disabled }: EtiquetaCajaProps) {
  const [open, setOpen] = useState(false);
  const [cantidadEtiquetas, setCantidadEtiquetas] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas - ${etiquetaInfo.numeroLote}</title>
          <style>
            @page {
              size: 100mm 70mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Arial', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .etiqueta-container {
              display: flex;
              flex-wrap: wrap;
              gap: 2mm;
              padding: 2mm;
            }
            .etiqueta {
              width: 100mm;
              height: 70mm;
              border: 1px solid #000;
              padding: 3mm;
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #76c820;
              padding-bottom: 2mm;
              margin-bottom: 2mm;
            }
            .logo-text {
              font-size: 14pt;
              font-weight: bold;
              color: #76c820;
            }
            .lote-numero {
              font-size: 12pt;
              font-weight: bold;
              font-family: monospace;
              background: #f0f0f0;
              padding: 1mm 2mm;
              border-radius: 2mm;
            }
            .content {
              display: flex;
              flex: 1;
              gap: 3mm;
            }
            .info-section {
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 1.5mm;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              font-size: 9pt;
              border-bottom: 1px dotted #ccc;
              padding-bottom: 1mm;
            }
            .info-label {
              font-weight: bold;
              color: #555;
            }
            .info-value {
              font-weight: 600;
              text-align: right;
            }
            .calibre-badge {
              display: inline-block;
              background: #76c820;
              color: white;
              padding: 1mm 3mm;
              border-radius: 2mm;
              font-size: 11pt;
              font-weight: bold;
              text-align: center;
              margin-top: 1mm;
            }
            .qr-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 1mm;
            }
            .qr-label {
              font-size: 6pt;
              color: #666;
              margin-top: 1mm;
            }
            .footer {
              border-top: 1px solid #ddd;
              padding-top: 2mm;
              margin-top: auto;
              display: flex;
              justify-content: space-between;
              font-size: 7pt;
              color: #666;
            }
            .caja-num {
              position: absolute;
              top: 3mm;
              right: 3mm;
              font-size: 8pt;
              color: #999;
            }
            @media print {
              .etiqueta {
                page-break-after: always;
              }
              .etiqueta:last-child {
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const getColorLabel = (color: string) => {
    const colores: Record<string, string> = {
      verde_oscuro: "Verde Oscuro",
      verde: "Verde",
      alimonado: "Alimonado",
      amarillo: "Amarillo"
    };
    return colores[color] || color;
  };

  const getCalibreLabel = (calibre: string) => {
    const calibres: Record<string, string> = {
      "200": "Cal. 200 (XG)",
      "300": "Cal. 300 (G)",
      "400": "Cal. 400 (M)",
      "500": "Cal. 500 (CH)",
      "600": "Cal. 600 (XCH)",
      "extras": "Extras"
    };
    return calibres[calibre] || `Cal. ${calibre}`;
  };

  const qrData = JSON.stringify({
    lote: etiquetaInfo.numeroLote,
    calibre: etiquetaInfo.calibre,
    color: etiquetaInfo.color,
    peso: etiquetaInfo.pesoKg,
    fecha: format(etiquetaInfo.fecha, "yyyy-MM-dd")
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="gap-2">
          <Tag className="h-4 w-4" />
          Generar Etiquetas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Generador de Etiquetas para Cajas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cantidad de etiquetas */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Cantidad de etiquetas:</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCantidadEtiquetas(Math.max(1, cantidadEtiquetas - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={cantidadEtiquetas}
                onChange={(e) => setCantidadEtiquetas(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
                min={1}
                max={100}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCantidadEtiquetas(Math.min(100, cantidadEtiquetas + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Badge variant="secondary">{cantidadEtiquetas} etiqueta(s)</Badge>
          </div>

          {/* Vista previa de etiqueta */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground mb-3">Vista previa (tamaño: 100mm x 70mm):</p>
            <div className="flex justify-center">
              <div className="bg-white border-2 border-dashed border-primary/30 rounded-lg p-4 w-[350px] h-[245px] shadow-sm">
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b-2 border-primary pb-2 mb-2">
                    <span className="text-lg font-bold text-primary">JBM Cítricos</span>
                    <span className="font-mono text-sm font-bold bg-muted px-2 py-1 rounded">
                      {etiquetaInfo.numeroLote}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 gap-3">
                    {/* Info */}
                    <div className="flex-1 space-y-1.5 text-xs">
                      <div className="flex justify-between border-b border-dotted border-muted-foreground/30 pb-1">
                        <span className="text-muted-foreground">Calibre:</span>
                        <span className="font-semibold">{getCalibreLabel(etiquetaInfo.calibre)}</span>
                      </div>
                      <div className="flex justify-between border-b border-dotted border-muted-foreground/30 pb-1">
                        <span className="text-muted-foreground">Color:</span>
                        <span className="font-semibold">{getColorLabel(etiquetaInfo.color)}</span>
                      </div>
                      <div className="flex justify-between border-b border-dotted border-muted-foreground/30 pb-1">
                        <span className="text-muted-foreground">Presentación:</span>
                        <span className="font-semibold">{etiquetaInfo.presentacion}</span>
                      </div>
                      <div className="flex justify-between border-b border-dotted border-muted-foreground/30 pb-1">
                        <span className="text-muted-foreground">Peso:</span>
                        <span className="font-semibold">{etiquetaInfo.pesoKg} kg</span>
                      </div>
                      {etiquetaInfo.productor && (
                        <div className="flex justify-between border-b border-dotted border-muted-foreground/30 pb-1">
                          <span className="text-muted-foreground">Origen:</span>
                          <span className="font-semibold truncate max-w-[120px]">{etiquetaInfo.productor}</span>
                        </div>
                      )}
                      <div className="pt-1">
                        <Badge className="bg-primary text-primary-foreground text-xs">
                          {getCalibreLabel(etiquetaInfo.calibre)}
                        </Badge>
                      </div>
                    </div>

                    {/* QR */}
                    <div className="flex flex-col items-center justify-center">
                      <QRCodeSVG value={qrData} size={70} level="M" />
                      <span className="text-[8px] text-muted-foreground mt-1">Escanear para trazabilidad</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-muted-foreground/20 pt-2 mt-auto flex justify-between text-[10px] text-muted-foreground">
                    <span>Fecha: {format(etiquetaInfo.fecha, "dd/MM/yyyy", { locale: es })}</span>
                    <span>Limón Persa - México</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contenido oculto para impresión */}
          <div ref={printRef} className="hidden">
            <div className="etiqueta-container">
              {Array.from({ length: cantidadEtiquetas }).map((_, index) => (
                <div key={index} className="etiqueta" style={{ position: 'relative' }}>
                  <span className="caja-num">#{index + 1}</span>
                  <div className="header">
                    <span className="logo-text">JBM Cítricos</span>
                    <span className="lote-numero">{etiquetaInfo.numeroLote}</span>
                  </div>
                  <div className="content">
                    <div className="info-section">
                      <div className="info-row">
                        <span className="info-label">Calibre:</span>
                        <span className="info-value">{getCalibreLabel(etiquetaInfo.calibre)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Color:</span>
                        <span className="info-value">{getColorLabel(etiquetaInfo.color)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Presentación:</span>
                        <span className="info-value">{etiquetaInfo.presentacion}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Peso:</span>
                        <span className="info-value">{etiquetaInfo.pesoKg} kg</span>
                      </div>
                      {etiquetaInfo.productor && (
                        <div className="info-row">
                          <span className="info-label">Origen:</span>
                          <span className="info-value">{etiquetaInfo.productor}</span>
                        </div>
                      )}
                      <div className="calibre-badge">
                        {getCalibreLabel(etiquetaInfo.calibre)}
                      </div>
                    </div>
                    <div className="qr-section">
                      <QRCodeSVG value={qrData} size={80} level="M" />
                      <span className="qr-label">Escanear para trazabilidad</span>
                    </div>
                  </div>
                  <div className="footer">
                    <span>Fecha: {format(etiquetaInfo.fecha, "dd/MM/yyyy", { locale: es })}</span>
                    <span>Limón Persa - México</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botón de impresión */}
          <Button onClick={handlePrint} className="w-full" size="lg">
            <Printer className="h-5 w-5 mr-2" />
            Imprimir {cantidadEtiquetas} Etiqueta{cantidadEtiquetas > 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
