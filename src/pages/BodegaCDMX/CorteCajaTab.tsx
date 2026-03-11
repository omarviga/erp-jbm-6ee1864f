import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, DollarSign, Loader2, Lock } from "lucide-react";

export default function CorteCajaTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [efectivoFisico, setEfectivoFisico] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<{ teorico: number; fisico: number; diferencia: number } | null>(null);

  const { data: historial } = useQuery({
    queryKey: ["cortes-caja-cdmx-rebuild"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cortes_caja_bodega")
        .select("*")
        .order("fecha_corte", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const ultimo = historial?.[0];

  const periodoInicio = useMemo(() => {
    if (ultimo?.fecha_fin) return ultimo.fecha_fin;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [ultimo]);

  const cerrarCorte = async () => {
    const fisico = Number(efectivoFisico);
    if (!Number.isFinite(fisico) || fisico < 0) {
      toast.error("Captura un monto fisico valido");
      return;
    }

    setSaving(true);
    try {
      const fechaFin = new Date().toISOString();

      const { data: teorico, error: rpcError } = await supabase.rpc("calcular_efectivo_teorico_corte", {
        p_fecha_inicio: periodoInicio,
        p_fecha_fin: fechaFin,
      });
      if (rpcError) throw rpcError;

      const valorTeorico = Number(teorico || 0);
      const diferencia = fisico - valorTeorico;
      const folio = `CC-CDMX-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(2, 12)}`;

      const { error: insertError } = await supabase.from("cortes_caja_bodega").insert({
        folio,
        fecha_inicio: periodoInicio,
        fecha_fin: fechaFin,
        estado: "cerrado",
        efectivo_teorico: valorTeorico,
        efectivo_fisico: fisico,
        total_ventas: valorTeorico,
        total_efectivo: valorTeorico,
        total_tarjeta: 0,
        total_transferencia: 0,
        cerrado_por: user?.id || null,
        notas: notas || null,
      });
      if (insertError) throw insertError;

      setResultado({ teorico: valorTeorico, fisico, diferencia });
      setEfectivoFisico("");
      setNotas("");
      await queryClient.invalidateQueries({ queryKey: ["cortes-caja-cdmx-rebuild"] });

      if (diferencia === 0) toast.success("Corte cuadrado");
      if (diferencia > 0) toast.warning(`Sobrante: $${diferencia.toFixed(2)}`);
      if (diferencia < 0) toast.error(`Faltante: $${Math.abs(diferencia).toFixed(2)}`);
    } catch (error: any) {
      toast.error("No se pudo cerrar el corte", { description: error?.message || "Error desconocido" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Corte de Caja CDMX</h1>
        <p className="text-sm text-muted-foreground">Auditoria ciega: el operador declara efectivo sin ver teorico.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Corte ciego</CardTitle>
            <CardDescription>
              Captura solo el efectivo fisico. El teorico se calcula y se muestra hasta confirmar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Efectivo fisico contado</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="pl-9 text-2xl font-mono h-14"
                  value={efectivoFisico}
                  onChange={(e) => setEfectivoFisico(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones del corte" />
            </div>

            <Button className="w-full" onClick={cerrarCorte} disabled={saving || !efectivoFisico}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cerrando...</> : "Cerrar corte"}
            </Button>

            {resultado && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/40">
                <div className="flex items-center gap-2 font-semibold">
                  {resultado.diferencia === 0 ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  Resultado del corte
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>Teorico: <strong className="font-mono">${resultado.teorico.toFixed(2)}</strong></div>
                  <div>Fisico: <strong className="font-mono">${resultado.fisico.toFixed(2)}</strong></div>
                  <div>Diferencia: <strong className="font-mono">${resultado.diferencia.toFixed(2)}</strong></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            {!historial?.length ? (
              <p className="text-sm text-muted-foreground">Sin cortes registrados.</p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                {historial.map((corte) => {
                  const diff = corte.diferencia || 0;
                  const variant = diff === 0 ? "default" : diff > 0 ? "secondary" : "destructive";
                  return (
                    <div key={corte.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold">{corte.folio}</span>
                        <Badge variant={variant}>{diff === 0 ? "Cuadrado" : diff > 0 ? "Sobrante" : "Faltante"}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(corte.fecha_corte).toLocaleString("es-MX")}
                      </div>
                      <div className="mt-2 text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">${(corte.efectivo_fisico || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
