import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Lock, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function CorteCajaTab() {
  const { user, isAdmin } = useAuth();
  const [efectivoFisico, setEfectivoFisico] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [processing, setProcessing] = useState(false);
  const [resultado, setResultado] = useState<{
    efectivo_teorico: number;
    efectivo_fisico: number;
    diferencia: number;
  } | null>(null);

  // Fetch previous cortes
  const { data: cortesHistorial, refetch: refetchCortes } = useQuery({
    queryKey: ['cortes-caja-cdmx'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cortes_caja_bodega')
        .select('*')
        .order('fecha_corte', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const ultimoCorte = cortesHistorial?.[0];

  const realizarCorte = async () => {
    const efectivo = parseFloat(efectivoFisico);
    if (isNaN(efectivo) || efectivo < 0) {
      toast.error("Ingresa una cantidad válida");
      return;
    }

    setProcessing(true);

    try {
      // Determine the period: from last closed corte to now
      const fechaInicio = ultimoCorte?.fecha_fin || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const fechaFin = new Date().toISOString();

      // Call the DB function to calculate theoretical cash
      // BLIND AUDIT: operator NEVER sees this before submitting
      const { data: efectivoTeorico, error: rpcError } = await supabase.rpc('calcular_efectivo_teorico_corte', {
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
      });

      if (rpcError) throw rpcError;

      const teorico = efectivoTeorico || 0;
      const diferencia = efectivo - teorico;

      // Generate folio
      const folio = `CC-CDMX-${format(new Date(), 'yyMMdd-HHmm')}`;

      // Save the corte - IMMUTABLE once created
      const { error: insertError } = await supabase
        .from('cortes_caja_bodega')
        .insert({
          folio,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          efectivo_teorico: teorico,
          efectivo_fisico: efectivo,
          diferencia,
          total_ventas: teorico,
          total_efectivo: teorico,
          total_tarjeta: 0,
          total_transferencia: 0,
          estado: 'cerrado',
          cerrado_por: user?.id,
          notas: notas || null,
        });

      if (insertError) throw insertError;

      // NOW reveal the result to the operator AFTER submission
      setResultado({
        efectivo_teorico: teorico,
        efectivo_fisico: efectivo,
        diferencia,
      });

      refetchCortes();

      if (diferencia < 0) {
        toast.error(`Faltante detectado: $${Math.abs(diferencia).toFixed(2)}`, {
          description: "Este faltante queda registrado permanentemente."
        });
      } else if (diferencia > 0) {
        toast.warning(`Sobrante: $${diferencia.toFixed(2)}`, {
          description: "El sobrante ha sido registrado."
        });
      } else {
        toast.success("Corte cuadrado. ¡Excelente!");
      }

    } catch (err: any) {
      console.error("Error en corte:", err);
      toast.error("Error al procesar el corte", { description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const resetear = () => {
    setResultado(null);
    setEfectivoFisico('');
    setNotas('');
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Corte de Caja</h1>
        <p className="text-sm text-muted-foreground">Auditoría ciega de efectivo — Bodega CDMX</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 flex-1">
        {/* Left: Blind cash count form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Corte Ciego
            </CardTitle>
            <CardDescription>
              Cuenta el dinero físico en el cajón y registra el monto. El sistema calculará la diferencia automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!resultado ? (
              <>
                <div className="bg-muted/50 rounded-lg p-6 text-center">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-lg font-semibold text-foreground">¿Cuánto dinero físico tienes en el cajón?</p>
                  <p className="text-sm text-muted-foreground mt-1">Cuenta todos los billetes y monedas antes de teclear</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Efectivo Físico</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={efectivoFisico}
                      onChange={(e) => setEfectivoFisico(e.target.value)}
                      className="h-16 pl-10 text-3xl font-mono font-bold text-center"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    placeholder="Observaciones del cierre..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full h-14 text-lg font-bold bg-[#1E5128] hover:bg-[#1E5128]/90"
                  onClick={realizarCorte}
                  disabled={processing || !efectivoFisico}
                >
                  {processing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Procesando...</>
                  ) : (
                    'Cerrar Corte de Caja'
                  )}
                </Button>
              </>
            ) : (
              /* Result revealed AFTER submission - AUDIT COMPLETE */
              <div className="space-y-6">
                <div className={`rounded-lg p-6 text-center ${
                  resultado.diferencia === 0 ? 'bg-green-50 border border-green-200' :
                  resultado.diferencia < 0 ? 'bg-red-50 border border-red-200' :
                  'bg-amber-50 border border-amber-200'
                }`}>
                  {resultado.diferencia === 0 ? (
                    <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-3" />
                  ) : (
                    <AlertTriangle className="h-12 w-12 mx-auto text-red-600 mb-3" />
                  )}
                  <p className="text-lg font-bold">
                    {resultado.diferencia === 0 ? '✅ Corte Cuadrado' :
                     resultado.diferencia < 0 ? `❌ Faltante de $${Math.abs(resultado.diferencia).toFixed(2)}` :
                     `⚠️ Sobrante de $${resultado.diferencia.toFixed(2)}`}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Efectivo Teórico</p>
                    <p className="text-xl font-bold font-mono">${resultado.efectivo_teorico.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Efectivo Declarado</p>
                    <p className="text-xl font-bold font-mono">${resultado.efectivo_fisico.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Diferencia</p>
                    <p className={`text-xl font-bold font-mono ${
                      resultado.diferencia < 0 ? 'text-red-600' :
                      resultado.diferencia > 0 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      ${resultado.diferencia.toFixed(2)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Este registro es permanente y no puede ser modificado.
                </p>

                <Button variant="outline" className="w-full" onClick={resetear}>
                  Nuevo Corte
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: History */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Cortes</CardTitle>
          </CardHeader>
          <CardContent>
            {!cortesHistorial || cortesHistorial.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin cortes registrados</p>
            ) : (
              <div className="space-y-3">
                {cortesHistorial.map((corte) => (
                  <div
                    key={corte.id}
                    className={`border rounded-lg p-3 ${
                      (corte.diferencia || 0) < 0 ? 'border-red-200 bg-red-50' :
                      (corte.diferencia || 0) > 0 ? 'border-amber-200 bg-amber-50' :
                      'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-bold">{corte.folio}</span>
                      <Badge variant={
                        (corte.diferencia || 0) < 0 ? 'destructive' :
                        (corte.diferencia || 0) > 0 ? 'secondary' : 'default'
                      }>
                        {(corte.diferencia || 0) === 0 ? 'Cuadrado' :
                         (corte.diferencia || 0) < 0 ? `Faltante $${Math.abs(corte.diferencia || 0).toFixed(2)}` :
                         `Sobrante $${(corte.diferencia || 0).toFixed(2)}`}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(corte.fecha_corte), "dd MMM yyyy HH:mm", { locale: es })}
                    </div>
                    {/* Full details only for admin */}
                    {isAdmin && (
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>Teórico: <strong className="font-mono">${corte.efectivo_teorico}</strong></div>
                        <div>Físico: <strong className="font-mono">${corte.efectivo_fisico || 0}</strong></div>
                        <div>Diff: <strong className="font-mono">${corte.diferencia || 0}</strong></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
