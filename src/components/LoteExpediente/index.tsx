// components/LoteExpediente/index.tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useLote } from '../../hooks/useLote';
import SeccionOrigen from './SeccionOrigen';
import SeccionProduccion from './SeccionProduccion';
import SeccionCamaraFria from './SeccionCamaraFria';
import SeccionRentabilidad from './SeccionRentabilidad';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Package, Calendar, Scale } from "lucide-react";
import type { LoteWithRelations } from '../../types';

const LoteExpediente: React.FC = () => {
  const { loteId } = useParams<{ loteId: string }>();
  const { lote, produccion, rentabilidad, loading, error } = useLote(loteId || '');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (error || !lote) {
    return (
      <Alert className="mt-3">
        <AlertDescription>
          {error || 'Lote no encontrado'}
        </AlertDescription>
      </Alert>
    );
  }

  // Cast lote to LoteWithRelations using spread + defaults
  const loteForComponents = {
    ...lote,
    calidad_defectos: null,
    cliente_maquila_id: null,
    costo_bascula: null,
    created_at: lote.fecha_recepcion,
    updated_at: lote.fecha_recepcion,
    es_maquila: null,
    estado_calidad: null,
    folio_fisico: null,
    huerto_id: lote.huerto?.id ?? null,
    kilos_merma: null,
    origen: null,
    peso_pagable: null,
    productor_id: lote.productor?.id ?? null,
    usuario_id: null,
    zona_asignada: null,
    productor: lote.productor ? { ...lote.productor, created_at: '', updated_at: '', saldo_anticipos: 0, saldo_pendiente: 0 } : undefined,
    produccion: produccion || [],
  } as LoteWithRelations;

  return (
    <div className="p-6 space-y-6">
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-4 flex items-center">
                <Package className="mr-2 h-6 w-6" />
                Expediente Digital: {lote.numero_lote}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={lote.es_cosecha_propia ? "default" : "secondary"}>
                  {lote.es_cosecha_propia ? 'COSECHA PROPIA' : 'COMPRA A TERCEROS'}
                </Badge>
                <Badge variant={
                  lote.estado === 'liquidado' ? "default" :
                    lote.estado === 'en_proceso' ? "secondary" : "outline"
                }>
                  {lote.estado.toUpperCase()}
                </Badge>
                <p className="text-sm flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Recepción: {lote.fecha_recepcion}
                </p>
                <p className="text-sm flex items-center">
                  <Scale className="h-4 w-4 mr-1" />
                  Peso Neto: {lote.peso_neto?.toLocaleString()} kg
                </p>
              </div>
            </div>
            <div className="md:text-right">
              <div className="text-sm text-muted-foreground">Código QR próximamente</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SeccionOrigen lote={loteForComponents} />
          <SeccionProduccion produccion={produccion || []} />
        </div>
        <div className="space-y-6">
          <SeccionCamaraFria produccion={produccion || []} />
          <SeccionRentabilidad lote={loteForComponents} analisis={rentabilidad} />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-6">
        <Button variant="outline" onClick={() => window.print()}>📄 Exportar Expediente</Button>
        <Button onClick={() => alert(`Crear guía para ${lote.numero_lote}`)}>🚚 Crear Guía de Salida</Button>
        {lote.productor && (
          <Button variant="default" onClick={() => alert(`Liquidar a ${lote.productor?.nombre}`)}>
            💰 Liquidar a Productor
          </Button>
        )}
      </div>
    </div>
  );
};

export default LoteExpediente;