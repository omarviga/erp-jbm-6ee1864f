import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import logoJBM from "@/assets/logo-jbm.png";

interface QRGeneratorProps {
  numeroLote: string;
  size?: number;
}

export function QRGenerator({ numeroLote, size = 200 }: QRGeneratorProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  
  // URL de trazabilidad (puede ser la URL de tu app en producción)
  const traceUrl = `${window.location.origin}/lotes/${numeroLote}`;

  const handleDownload = () => {
    if (!qrRef.current) return;
    
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    // Crear canvas para exportar
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size + 40;
    canvas.height = size + 80;

    // Fondo blanco
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convertir SVG a imagen
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 20, 20, size, size);
      
      // Agregar texto del lote
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(numeroLote, canvas.width / 2, size + 50);
      ctx.font = "10px Inter, sans-serif";
      ctx.fillText("JBM Cítricos", canvas.width / 2, size + 68);

      // Descargar
      const link = document.createElement("a");
      link.download = `QR-${numeroLote}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  return (
    <Card className="module-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Código QR de Trazabilidad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div 
          ref={qrRef}
          className="flex items-center justify-center p-4 bg-white rounded-lg border"
        >
          <QRCodeSVG
            value={traceUrl}
            size={size}
            level="H"
            includeMargin
            imageSettings={{
              src: logoJBM,
              x: undefined,
              y: undefined,
              height: 40,
              width: 40,
              excavate: true,
            }}
          />
        </div>
        
        <div className="text-center">
          <p className="font-mono font-semibold text-sm">{numeroLote}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Escanea para ver trazabilidad completa
          </p>
        </div>

        <Button 
          onClick={handleDownload} 
          variant="outline" 
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          Descargar PNG
        </Button>
      </CardContent>
    </Card>
  );
}
