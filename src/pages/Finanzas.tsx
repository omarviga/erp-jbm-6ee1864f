import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProductores } from "@/hooks/useProductores";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Wallet,
  Users,
  AlertTriangle,
  Receipt,
  Loader2,
  Download,
  Loader,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { openPrintDocument } from "@/lib/print/openPrintDocument";
import { renderEstadoCuentaHtml } from "@/lib/print/renderEstadoCuentaHtml";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ComprasTab } from "@/components/finanzas/ComprasTab";
import { GastosResumenTab } from "@/components/finanzas/GastosResumenTab";

// Tipos basados en el esquema Supabase
type Productor = Database['public']['Tables']['productores']['Row'];
type AplicarPagoCxpResultado = Database['public']['Functions']['aplicar_pago_cxp']['Returns'][number];

// Tipos para los datos transformados

interface CxPTicketDetalle {
  id: string;
  folio: string;
  fecha: string;
  kilos: number;
  precio: number;
  importe: number;
  saldoPendiente: number;
  montoPagado: number;
  antiguedadDias: number;
}

interface CxPProductorResumen {
  productorId: string;
  productor: string;
  deudaTotal: number;
  pagado: number;
  saldoVivo: number;
  tickets: number;
  masAntiguoDias: number;
  detalleTickets: CxPTicketDetalle[];
}

interface CxPBitacoraItem {
  id: string;
  cxpId: string;
  folio: string;
  fecha: string;
  montoAplicado: number;
  metodoPago: string;
  referencia: string;
}

const getEstadoAplicacionTicket = (ticket: CxPTicketDetalle) => {
  if (ticket.saldoPendiente <= 0.009) {
    return {
      label: "Aplicado total",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  }

  if (ticket.montoPagado > 0) {
    return {
      label: "Aplicado parcial",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    };
  }

  return {
    label: "Pendiente",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  };
};

export const CXP_LOTES_SELECT_FIELDS =
  'id, productor_id, numero_lote, fecha_recepcion, peso_neto, precio_pactado_kg, costo_bascula, estado_calidad';

export default function Finanzas() {
  const { toast } = useToast();

  // Datos del Pago CxP
  const [metodoPagoCxp, setMetodoPagoCxp] = useState<"cheque" | "transferencia" | "efectivo">("transferencia");
  const [referenciaPagoCxp, setReferenciaPagoCxp] = useState("");
  const [montoAdelantoCxp, setMontoAdelantoCxp] = useState("");

  // --- ESTADOS PARA DATOS DE SUPABASE ---
  // CORREGIDO: Ya no declaramos loadingProductores aquí, viene del hook
  const [productores, setProductores] = useState<Productor[]>([]);
  const [registrandoAdelanto, setRegistrandoAdelanto] = useState(false);
  const [generandoEstadoCuentaPdf, setGenerandoEstadoCuentaPdf] = useState(false);
  const [cxpResumen, setCxpResumen] = useState<CxPProductorResumen[]>([]);
  const [cargandoCxp, setCargandoCxp] = useState(false);
  const [productorCxpSeleccionado, setProductorCxpSeleccionado] = useState<string>("");
  const [cxpRefreshKey, setCxpRefreshKey] = useState(0);
  const [bitacoraCxp, setBitacoraCxp] = useState<CxPBitacoraItem[]>([]);
  const [cargandoBitacoraCxp, setCargandoBitacoraCxp] = useState(false);
  const [ticketsCxpSeleccionados, setTicketsCxpSeleccionados] = useState<string[]>([]);
  // Cargar productores desde Supabase - CORREGIDO
  const {
    productores: productoresDB, // Productores del hook
    loading: cargandoProductores, // CORREGIDO: nombre diferente para evitar duplicación
    error: errorProductores,
    refetch: refreshProductores
  } = useProductores();

  // Sincronizar productores del hook con estado local
  useEffect(() => {
    if (productoresDB) {
      setProductores(productoresDB as Productor[]);
    }
  }, [productoresDB]);

  // Cargar resumen CxP
  useEffect(() => {
    const cargarResumenCxp = async () => {
      try {
        setCargandoCxp(true);

        const { data: cxpData, error: errorCxp } = await supabase
          .from('cuentas_por_pagar')
          .select('id, productor_id, numero_lote, fecha_ticket, kilos_netos, precio_kg, monto_total, monto_pagado, saldo_pendiente, estado')
          .order('fecha_ticket', { ascending: true });

        if (errorCxp) throw errorCxp;

        const ahora = new Date();
        const resumen = productores
          .map((productor) => {
            const ticketsProductor = (cxpData || []).filter((ticket) => ticket.productor_id === productor.id);
            const ticketsPendientes = ticketsProductor
              .filter((ticket) => (ticket.saldo_pendiente ?? 0) > 0.009)
              .map((ticket) => {
                const kilos = ticket.kilos_netos ?? 0;
                const precio = ticket.precio_kg ?? 0;
                const importe = ticket.monto_total ?? 0;
                const saldoPendiente = ticket.saldo_pendiente ?? 0;
                const montoPagado = ticket.monto_pagado ?? 0;
                const fecha = new Date(ticket.fecha_ticket);
                const antiguedadDias = Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / 86400000));

                return {
                  id: ticket.id,
                  folio: ticket.numero_lote,
                  fecha: ticket.fecha_ticket,
                  kilos,
                  precio,
                  importe,
                  saldoPendiente,
                  montoPagado,
                  antiguedadDias,
                };
              });

            const deudaTotal = ticketsProductor.reduce((sum, ticket) => sum + (ticket.monto_total ?? 0), 0);
            const pagado = ticketsProductor.reduce((sum, ticket) => sum + (ticket.monto_pagado ?? 0), 0);
            const saldoVivo = ticketsProductor.reduce((sum, ticket) => sum + (ticket.saldo_pendiente ?? 0), 0);
            const masAntiguoDias = ticketsPendientes.reduce((max, ticket) => Math.max(max, ticket.antiguedadDias), 0);

            return {
              productorId: productor.id,
              productor: productor.nombre,
              deudaTotal,
              pagado,
              saldoVivo,
              tickets: ticketsPendientes.length,
              masAntiguoDias,
              detalleTickets: ticketsPendientes,
            };
          })
          .filter((item) => item.saldoVivo > 0.009)
          .sort((a, b) => b.saldoVivo - a.saldoVivo);

        setCxpResumen(resumen);
        setProductorCxpSeleccionado((actual) => {
          const target = actual || resumen[0]?.productorId || "";
          const detalle = resumen.find((item) => item.productorId === target);
          setTicketsCxpSeleccionados(detalle?.detalleTickets.map((ticket) => ticket.id) || []);
          return target;
        });
      } catch (error) {
        console.error('Error cargando resumen CxP:', error);
      } finally {
        setCargandoCxp(false);
      }
    };

    if (productores.length > 0) {
      cargarResumenCxp();
    } else {
      setCxpResumen([]);
      setProductorCxpSeleccionado("");
    }
  }, [productores, cxpRefreshKey]);

  useEffect(() => {
    const cargarBitacoraCxp = async () => {
      if (!productorCxpSeleccionado) {
        setBitacoraCxp([]);
        return;
      }

      try {
        setCargandoBitacoraCxp(true);

        const cxpIds = (cxpResumen.find((item) => item.productorId === productorCxpSeleccionado)?.detalleTickets || [])
          .map((ticket) => ticket.id);

        if (cxpIds.length === 0) {
          setBitacoraCxp([]);
          return;
        }

        const { data, error } = await supabase
          .from('abono_asignaciones')
          .select(`
            id,
            cxp_id,
            monto_aplicado,
            created_at,
            cuentas_por_pagar:cxp_id (
              numero_lote
            ),
            abonos_productor:abono_id (
              metodo_pago,
              referencia
            )
          `)
          .in('cxp_id', cxpIds)
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) throw error;

        const bitacora = (data || []).map((row) => ({
          id: row.id,
          cxpId: row.cxp_id,
          folio: row.cuentas_por_pagar?.numero_lote || "N/A",
          fecha: row.created_at,
          montoAplicado: row.monto_aplicado || 0,
          metodoPago: row.abonos_productor?.metodo_pago || "N/A",
          referencia: row.abonos_productor?.referencia || "—",
        }));

        setBitacoraCxp(bitacora);
      } catch (error) {
        console.error('Error cargando bitácora CxP:', error);
        setBitacoraCxp([]);
      } finally {
        setCargandoBitacoraCxp(false);
      }
    };

    void cargarBitacoraCxp();
  }, [productorCxpSeleccionado, cxpResumen, cxpRefreshKey]);

  const productorCxpDetalle = cxpResumen.find((item) => item.productorId === productorCxpSeleccionado) || cxpResumen[0];
  const montoAdelantoCxpNum = parseFloat(montoAdelantoCxp) || 0;
  const ticketsAplicablesCxp = productorCxpDetalle
    ? productorCxpDetalle.detalleTickets.filter((ticket) => ticketsCxpSeleccionados.includes(ticket.id))
    : [];
  const saldoSeleccionadoCxp = ticketsAplicablesCxp.reduce((sum, ticket) => sum + ticket.saldoPendiente, 0);
  const saldoProyectadoCxp = productorCxpDetalle
    ? Math.max(0, productorCxpDetalle.saldoVivo - Math.min(montoAdelantoCxpNum, saldoSeleccionadoCxp))
    : 0;

  const productorPdf = productorCxpDetalle
    ? productores.find(p => p.id === productorCxpDetalle.productorId) || null
    : null;

  const handleDescargarEstadoCuenta = async () => {
    const productor = productorPdf;
    if (!productor || !productorCxpDetalle) return;

    setGenerandoEstadoCuentaPdf(true);
    try {
      const [{ data: notasData, error: errorNotas }, { data: abonosData, error: errorAbonos }] = await Promise.all([
        supabase
          .from('cuentas_por_pagar')
          .select('id, numero_lote, fecha_ticket, kilos_netos, precio_kg, monto_total, monto_pagado, saldo_pendiente, estado')
          .eq('productor_id', productorCxpDetalle.productorId)
          .order('fecha_ticket', { ascending: true }),
        supabase
          .from('abonos_productor')
          .select('id, monto, metodo_pago, referencia, created_at')
          .eq('productor_id', productorCxpDetalle.productorId)
          .order('created_at', { ascending: true }),
      ]);

      if (errorNotas) throw errorNotas;
      if (errorAbonos) throw errorAbonos;

      const notas = (notasData || []).map((n) => ({
        fecha: new Date(n.fecha_ticket).toLocaleDateString("es-MX"),
        folio: n.numero_lote || "N/A",
        kilos: n.kilos_netos || 0,
        precio: n.precio_kg || 0,
        importe: n.monto_total || 0,
        pagado: n.monto_pagado || 0,
        saldo: n.saldo_pendiente || 0,
      }));

      const pagos = (abonosData || []).map((a) => ({
        fecha: new Date(a.created_at).toLocaleDateString("es-MX"),
        metodo: a.metodo_pago || "efectivo",
        referencia: a.referencia || "—",
        monto: a.monto || 0,
      }));

      const fechas = (notasData || []).map((n) => new Date(n.fecha_ticket).getTime()).filter(Boolean);
      const inicio = fechas.length > 0
        ? new Date(Math.min(...fechas)).toLocaleDateString("es-MX")
        : new Date().toLocaleDateString("es-MX");

      openPrintDocument(
        `EstadoCuenta_${productor.nombre.replace(/\s+/g, "_")}.pdf`,
        renderEstadoCuentaHtml({
          productor: { nombre: productor.nombre, rfc: productor.rfc || "XAXX010101000" },
          periodo: { inicio, fin: new Date().toLocaleDateString("es-MX") },
          notas,
          pagos,
          resumen: {
            valorFruta: notas.reduce((sum, n) => sum + n.importe, 0),
            totalPagado: pagos.reduce((sum, p) => sum + p.monto, 0),
            saldoPendiente: notas.reduce((sum, n) => sum + n.saldo, 0),
          },
        }),
      );
    } catch (error) {
      console.error('Error generando estado de cuenta:', error);
      const errorMessage =
        (error as { message?: string })?.message ||
        (error as { details?: string })?.details ||
        "No se pudo generar el estado de cuenta";
      toast({ title: "❌ Error", description: errorMessage, variant: "destructive" });
    } finally {
      setGenerandoEstadoCuentaPdf(false);
    }
  };
  useEffect(() => {
    if (!productorCxpDetalle) {
      setTicketsCxpSeleccionados([]);
      return;
    }

    setTicketsCxpSeleccionados((prev) => {
      const validIds = new Set(productorCxpDetalle.detalleTickets.map((ticket) => ticket.id));
      const filtered = prev.filter((id) => validIds.has(id));
      if (filtered.length > 0) return filtered;
      return productorCxpDetalle.detalleTickets.map((ticket) => ticket.id);
    });
  }, [productorCxpDetalle]);
  const deudaTotalCxp = cxpResumen.reduce((sum, item) => sum + item.saldoVivo, 0);
  const productoresConSaldo = cxpResumen.filter((item) => item.saldoVivo > 0).length;
  const ticketsPendientesCxp = cxpResumen.reduce((sum, item) => sum + item.tickets, 0);

  const handleRegistrarAdelantoCxp = async (productorObjetivoId: string) => {
    const productorObjetivo = productores.find((productor) => productor.id === productorObjetivoId);

    if (!productorObjetivo) {
      toast({
        title: "⚠️ Selecciona un productor",
        description: "Debes elegir un productor antes de registrar un adelanto.",
        variant: "destructive"
      });
      return;
    }

    const monto = parseFloat(montoAdelantoCxp) || 0;
    if (monto <= 0) {
      toast({
        title: "⚠️ Monto inválido",
        description: "Ingresa un monto mayor a cero para registrar el adelanto.",
        variant: "destructive"
      });
      return;
    }

    if (ticketsAplicablesCxp.length === 0) {
      toast({
        title: "⚠️ Selecciona notas",
        description: "Debes seleccionar al menos una nota para aplicar el pago parcial.",
        variant: "destructive"
      });
      return;
    }

    if (monto > saldoSeleccionadoCxp) {
      toast({
        title: "⚠️ Monto excedido",
        description: "El monto del pago parcial supera el saldo seleccionado de las notas.",
        variant: "destructive"
      });
      return;
    }

    if ((metodoPagoCxp === 'cheque' || metodoPagoCxp === 'transferencia') && !referenciaPagoCxp.trim()) {
      toast({
        title: "⚠️ Falta referencia",
        description: metodoPagoCxp === "cheque"
          ? "Ingresa el número de cheque para registrar el adelanto."
          : "Ingresa la referencia de transferencia para registrar el adelanto.",
        variant: "destructive"
      });
      return;
    }

    try {
      setRegistrandoAdelanto(true);

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc('aplicar_pago_cxp' as never, {
        p_productor_id: productorObjetivoId,
        p_cxp_ids: ticketsAplicablesCxp.map((ticket) => ticket.id),
        p_monto: monto,
        p_forma_pago: metodoPagoCxp,
        p_referencia: referenciaPagoCxp.trim() || null,
        p_usuario_id: userData.user?.id || null,
      } as never);

      if (error) throw error;

      const resultado = Array.isArray(data) ? (data as AplicarPagoCxpResultado[])[0] : null;
      if (!resultado?.success) {
        throw new Error(resultado?.mensaje || "No se pudo registrar el adelanto");
      }

      await refreshProductores();
      setCxpRefreshKey((prev) => prev + 1);

      toast({
        title: "✅ Pago parcial aplicado",
        description: `Se aplicó $${monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} a ${ticketsAplicablesCxp.length} nota(s) de ${productorObjetivo.nombre}.`,
        className: "bg-slate-800 text-white border-none"
      });

      setMontoAdelantoCxp("");
      setReferenciaPagoCxp("");
      // Recargar resumen para reflejar saldos por nota actualizados
      setProductorCxpSeleccionado(productorObjetivoId);
    } catch (error) {
      console.error('Error al aplicar pago CxP:', error);
      const rawMessage =
        (error as { message?: string })?.message ||
        (error as { details?: string })?.details ||
        "No se pudo registrar el adelanto";
      toast({
        title: "❌ Error al aplicar el pago",
        description: rawMessage,
        variant: "destructive"
      });
    } finally {
      setRegistrandoAdelanto(false);
    }
  };

  return (
    <MainLayout title="Control de Pagos" subtitle="Cuentas por Pagar">

      <Tabs defaultValue="cxp" className="space-y-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-3 h-12 bg-muted p-1">
          <TabsTrigger value="cxp" className="text-base font-medium">
            <Receipt className="h-4 w-4 mr-2" /> CxP
          </TabsTrigger>
          <TabsTrigger value="resumen" className="text-base font-medium">
            <Wallet className="h-4 w-4 mr-2" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="compras" className="text-base font-medium">
            <ShoppingCart className="h-4 w-4 mr-2" /> Compras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cxp" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Consulta las cuentas por pagar pendientes por productor y aplica pagos parciales a sus notas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deuda Total Viva</p>
                  <p className="text-2xl font-black text-red-500">
                    ${deudaTotalCxp.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-red-50 p-2 rounded-full"><AlertTriangle className="h-6 w-6 text-red-500" /></div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Productores con Saldo</p>
                  <p className="text-2xl font-black text-slate-800">{productoresConSaldo}</p>
                </div>
                <div className="bg-slate-100 p-2 rounded-full"><Users className="h-6 w-6 text-slate-500" /></div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notas Pendientes</p>
                  <p className="text-2xl font-black text-slate-800">{ticketsPendientesCxp}</p>
                </div>
                <div className="bg-green-50 p-2 rounded-full"><Receipt className="h-6 w-6 text-green-600" /></div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Cuentas por Pagar por Productor</CardTitle>
              <CardDescription>Ordenado por mayor deuda. Click para ver detalle.</CardDescription>
            </CardHeader>
            <CardContent>
              {cargandoCxp ? (
                <div className="flex items-center justify-center py-10 text-slate-500">
                  <Loader className="mr-2 h-5 w-5 animate-spin" />
                  Cargando resumen de CxP...
                </div>
              ) : cxpResumen.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                  No hay cuentas por pagar pendientes para mostrar.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Productor</th>
                          <th className="px-4 py-3 text-right font-medium">Deuda Total</th>
                          <th className="px-4 py-3 text-right font-medium">Pagado</th>
                          <th className="px-4 py-3 text-right font-medium">Saldo Vivo</th>
                          <th className="px-4 py-3 text-center font-medium">Notas</th>
                          <th className="px-4 py-3 text-center font-medium">M&aacute;s Antiguo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cxpResumen.map((item) => (
                          <tr
                            key={item.productorId}
                            className={cn(
                              "cursor-pointer border-b transition-colors hover:bg-slate-50",
                              productorCxpDetalle?.productorId === item.productorId && "bg-slate-50"
                            )}
                            onClick={() => {
                              setProductorCxpSeleccionado(item.productorId);
                              setTicketsCxpSeleccionados(item.detalleTickets.map((ticket) => ticket.id));
                            }}
                          >
                            <td className="px-4 py-4 font-semibold text-slate-800">{item.productor}</td>
                            <td className="px-4 py-4 text-right font-mono">
                              ${item.deudaTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-4 text-right font-mono text-green-600">
                              ${item.pagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-4 text-right font-mono font-bold text-red-500">
                              ${item.saldoVivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <Badge variant="outline">{item.tickets}</Badge>
                            </td>
                            <td className="px-4 py-4 text-center">{item.masAntiguoDias}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {productorCxpDetalle && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{productorCxpDetalle.productor}</p>
                            <p className="text-xs text-slate-500">Detalle de notas pendientes ordenadas por antigüedad.</p>
                          </div>
                          <Badge variant="secondary">{productorCxpDetalle.tickets} notas</Badge>
                        </div>
                        <div className="space-y-3">
                          {productorCxpDetalle.detalleTickets.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin notas pendientes.</p>
                          ) : (
                            productorCxpDetalle.detalleTickets.map((ticket) => (
                              <div key={ticket.id} className="rounded-md border bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      checked={ticketsCxpSeleccionados.includes(ticket.id)}
                                      onCheckedChange={(checked) => {
                                        setTicketsCxpSeleccionados((prev) => checked
                                          ? [...prev, ticket.id]
                                          : prev.filter((id) => id !== ticket.id));
                                      }}
                                    />
                                    <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-slate-800">{ticket.folio}</p>
                                      <Badge
                                        variant="outline"
                                        className={getEstadoAplicacionTicket(ticket).className}
                                      >
                                        {getEstadoAplicacionTicket(ticket).label}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      {new Date(ticket.fecha).toLocaleDateString("es-MX")} · {ticket.antiguedadDias}d
                                    </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-mono font-semibold text-red-500">
                                      ${ticket.saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      de ${ticket.importe.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  {ticket.kilos.toLocaleString("es-MX")} kg × ${ticket.precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}/kg
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border p-4">
                        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                          <div className="flex items-center justify-between text-xs font-bold uppercase text-blue-800">
                            <span>Aplicar pago parcial</span>
                            <span className="text-slate-500 normal-case">Abona a las notas seleccionadas del productor</span>
                          </div>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Select value={metodoPagoCxp} onValueChange={(value: "cheque" | "transferencia" | "efectivo") => setMetodoPagoCxp(value)}>
                              <SelectTrigger className="h-9 bg-white text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cheque">Cheque</SelectItem>
                                <SelectItem value="transferencia">Transf.</SelectItem>
                                <SelectItem value="efectivo">Efectivo</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-9 bg-white text-xs font-mono"
                              placeholder={metodoPagoCxp === 'cheque' ? "No. Cheque" : "Referencia"}
                              value={referenciaPagoCxp}
                              onChange={(e) => setReferenciaPagoCxp(e.target.value)}
                            />
                            <Input
                              className="h-9 bg-white text-xs font-mono"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Monto del pago"
                              value={montoAdelantoCxp}
                              onChange={(e) => setMontoAdelantoCxp(e.target.value)}
                            />
                          </div>
                          <p className="text-xs text-slate-600">
                            Saldo seleccionado: (se aplica primero a la nota más antigua)
                            <span className="ml-1 font-semibold text-slate-800">
                              ${saldoSeleccionadoCxp.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                          <p className="text-xs text-slate-600">
                            Saldo proyectado después del pago:
                            <span className="ml-1 font-semibold text-slate-800">
                              ${saldoProyectadoCxp.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                          <Button
                            type="button"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleRegistrarAdelantoCxp(productorCxpDetalle.productorId)}
                            disabled={
                              registrandoAdelanto ||
                              montoAdelantoCxpNum <= 0 ||
                              ticketsCxpSeleccionados.length === 0 ||
                              montoAdelantoCxpNum > saldoSeleccionadoCxp ||
                              ((metodoPagoCxp === "cheque" || metodoPagoCxp === "transferencia") && !referenciaPagoCxp.trim())
                            }
                          >
                            {registrandoAdelanto ? "Registrando..." : `Aplicar pago parcial a ${productorCxpDetalle.productor}`}
                          </Button>
                        </div>
                        <div className="mt-6 rounded-lg bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Saldo actual</p>
                          <p className="mt-1 text-2xl font-black text-slate-800">
                            ${productorCxpDetalle.saldoVivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </p>
                          <Button
                            variant="outline"
                            className="mt-3 w-full text-xs"
                            onClick={() => void handleDescargarEstadoCuenta()}
                            disabled={generandoEstadoCuentaPdf}
                          >
                            {generandoEstadoCuentaPdf ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            Descargar Estado de Cuenta
                          </Button>
                        </div>

                        <div className="mt-4 rounded-lg border bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Bitácora de aplicaciones
                            </p>
                            <Badge variant="outline">{bitacoraCxp.length}</Badge>
                          </div>

                          {cargandoBitacoraCxp ? (
                            <div className="flex items-center justify-center py-4 text-sm text-slate-500">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Cargando bitácora...
                            </div>
                          ) : bitacoraCxp.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin aplicaciones registradas para este productor.</p>
                          ) : (
                            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                              {bitacoraCxp.map((item) => (
                                <div key={item.id} className="rounded-md border bg-slate-50 p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-slate-700">
                                      Nota: {item.folio}
                                    </p>
                                    <p className="text-xs font-mono font-bold text-green-700">
                                      ${item.montoAplicado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <p className="text-[11px] text-slate-500">
                                    {new Date(item.fecha).toLocaleString("es-MX")} · {item.metodoPago.toUpperCase()} · Ref: {item.referencia}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* --- PESTAÑA: RESUMEN INGRESOS VS EGRESOS --- */}
        <TabsContent value="resumen" className="space-y-6">
          <GastosResumenTab />
        </TabsContent>

        {/* --- PESTAÑA: COMPRAS --- */}
        <TabsContent value="compras" className="space-y-6">
          <ComprasTab />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
