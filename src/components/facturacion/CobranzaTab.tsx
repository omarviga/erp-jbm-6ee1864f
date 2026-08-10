import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Receipt, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClienteMoroso {
  id: string;
  nombre: string;
  saldo: number;
  diasVencido: number;
  limite: number;
  nivelRiesgo: "alto" | "medio" | "seguimiento";
}

export function CobranzaTab() {
  const [clientesMorosos, setClientesMorosos] = useState<ClienteMoroso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarClientesMorosos = async () => {
      try {
        const { data, error } = await supabase
          .from("clientes")
          .select(`
            *,
            clientes_sensible (
              limite_credito
            )
          `)
          .gt("saldo_deudor", 0)
          .order("saldo_deudor", { ascending: false });

        if (error) throw error;

        const clientesTransformados: ClienteMoroso[] = (data || []).map((c) => ({
          id: c.id,
          nombre: c.nombre,
          saldo: c.saldo_deudor,
          limite: c.clientes_sensible?.limite_credito || 0,
          diasVencido: c.saldo_deudor >= (c.clientes_sensible?.limite_credito || 0) && c.saldo_deudor > 0
            ? 31
            : c.saldo_deudor > ((c.clientes_sensible?.limite_credito || 0) * 0.5)
            ? 16
            : 7,
          nivelRiesgo: c.saldo_deudor >= (c.clientes_sensible?.limite_credito || 0) && c.saldo_deudor > 0
            ? "alto"
            : c.saldo_deudor > ((c.clientes_sensible?.limite_credito || 0) * 0.5)
            ? "medio"
            : "seguimiento",
        }));

        setClientesMorosos(clientesTransformados);
      } catch (error) {
        console.error("Error cargando clientes morosos:", error);
      } finally {
        setLoading(false);
      }
    };

    cargarClientesMorosos();
  }, []);

  const handleCobrarCliente = async (clienteId: string, clienteNombre: string) => {
    try {
      const clienteMoroso = clientesMorosos.find((c) => c.id === clienteId);
      if (!clienteMoroso) return;

      const { error } = await supabase.from("pagos_clientes").insert({
        cliente_id: clienteId,
        monto: clienteMoroso.saldo,
        forma_pago: "transferencia",
        referencia: `PAGO-${Date.now()}`,
      });

      if (error) throw error;

      const { error: errorUpdate } = await supabase
        .from("clientes")
        .update({ saldo_deudor: 0 })
        .eq("id", clienteId);

      if (errorUpdate) throw errorUpdate;

      toast.success(`Pago registrado para ${clienteNombre}`);
      setClientesMorosos((prev) => prev.filter((c) => c.id !== clienteId));
    } catch (error) {
      console.error("Error al registrar pago:", error);
      toast.error("No se pudo registrar el pago");
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Cargando cobranza...</div>
      </div>
    );
  }

  return (
    <Card className="module-card">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Antigüedad de Saldos
            </CardTitle>
            <CardDescription>Clientes con facturas vencidas o por vencer</CardDescription>
          </div>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              Moroso (+30d)
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Vencido (+15d)
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {clientesMorosos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No hay clientes con saldos pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientesMorosos.map((cliente) => {
              const dias = cliente.diasVencido;
              const borderClass =
                dias > 30
                  ? "border-l-destructive"
                  : dias > 15
                  ? "border-l-amber-500"
                  : "border-l-muted";
              const estatusLabel =
                cliente.nivelRiesgo === "alto"
                  ? "Atencion inmediata"
                  : cliente.nivelRiesgo === "medio"
                  ? "Cobro prioritario"
                  : "Seguimiento";

              return (
                <div
                  key={cliente.id}
                  className={cn(
                    "p-4 rounded-r-lg border border-l-4 bg-card shadow-sm hover:shadow-md transition-shadow",
                    borderClass
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{cliente.nombre}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            cliente.nivelRiesgo === "alto"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : cliente.nivelRiesgo === "medio"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          )}
                        >
                          {estatusLabel}
                        </Badge>
                      </div>
                      <div className="flex gap-6 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Receipt className="h-3 w-3" /> Límite: ${cliente.limite.toLocaleString()}
                        </span>
                        <span
                          className={cn(
                            "font-bold flex items-center gap-1",
                            dias > 15 ? "text-destructive" : "text-muted-foreground"
                          )}
                        >
                          <AlertTriangle className="h-3 w-3" /> {dias} dias de seguimiento
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase">Deuda Total</p>
                        <p
                          className={cn(
                            "text-2xl font-black",
                            dias > 30 ? "text-destructive" : "text-foreground"
                          )}
                        >
                          ${cliente.saldo.toLocaleString()}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => handleCobrarCliente(cliente.id, cliente.nombre)}>
                        Registrar Pago <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
