// SeccionOrigen.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Truck, User, Phone, Home } from "lucide-react";
import type { LoteWithRelations } from '../../types';

interface SeccionOrigenProps {
  lote: LoteWithRelations;
}

const SeccionOrigen: React.FC<SeccionOrigenProps> = ({ lote }) => {
  const valorCompra = lote.precio_pactado_kg && lote.peso_neto
    ? lote.precio_pactado_kg * lote.peso_neto
    : 0;

  return (
    <Card className="module-card">
      <CardHeader>
        <CardTitle className="text-primary flex items-center">
          <Truck className="mr-2 h-5 w-5" />
          Origen del Lote
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* INFORMACIÓN DEL PRODUCTOR/HUERTO */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {lote.es_cosecha_propia ? 'HUERTO' : 'PRODUCTOR'}
              </p>

              {lote.es_cosecha_propia ? (
                <>
                  <h3 className="text-lg font-semibold mb-1">
                    {lote.huerto?.nombre || 'Huerto no especificado'}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Home className="h-4 w-4 mr-1" />
                    {lote.huerto?.ubicacion || 'Sin ubicación'}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-1 flex items-center">
                    <User className="h-5 w-5 mr-1" />
                    {lote.productor?.nombre || 'Productor no especificado'}
                  </h3>

                  {lote.productor?.telefono && (
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Phone className="h-4 w-4 mr-1" />
                      {lote.productor.telefono}
                    </p>
                  )}

                  {lote.productor?.rfc && (
                    <Badge variant="outline" className="mt-2">
                      RFC: {lote.productor.rfc}
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* CORTADORES (si es cosecha propia) */}
            {lote.es_cosecha_propia && lote.lote_cortadores && lote.lote_cortadores.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  CORTADORES ASIGNADOS
                </p>
                {lote.lote_cortadores.map((item, index) => (
                  <div key={index} className="flex justify-between items-center mb-1">
                    <span>{item.cortadores?.nombre}</span>
                    <Badge variant="secondary">
                      {item.cajas_recolectadas} cajas
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PESOS Y VALOR */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                DATOS DE PESADA
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Peso Bruto</p>
                  <p className="text-sm font-medium">{lote.peso_bruto.toLocaleString()} kg</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Tara</p>
                  <p className="text-sm font-medium">{lote.peso_tara.toLocaleString()} kg</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Peso Neto</p>
                  <p className="text-sm font-bold text-green-600">{lote.peso_neto?.toLocaleString()} kg</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Precio Pactado</p>
                  <p className="text-sm font-medium">${lote.precio_pactado_kg?.toFixed(2) || '0.00'} /kg</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* VALOR TOTAL */}
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">
                VALOR DE COMPRA DEL LOTE
              </p>
              <p className="text-2xl font-bold text-green-600">
                ${valorCompra.toLocaleString('es-MX', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {lote.peso_neto?.toLocaleString()} kg × ${lote.precio_pactado_kg?.toFixed(2)}/kg
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SeccionOrigen;