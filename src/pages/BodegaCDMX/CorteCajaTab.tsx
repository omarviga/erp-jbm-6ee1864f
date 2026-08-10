import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCdmx } from "@/integrations/supabase/cdmx";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Lock, DollarSign, AlertTriangle, CheckCircle, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  construirResumenPeriodoCorte,
  construirConciliacionPeriodo,
  esCorteHistoricoInconsistente,
  normalizarMensajeErrorCorte,
  obtenerIncidenciasAuditoria,
  resumirAuditoriaGranelPeriodo,
  type AuditoriaGranelPeriodo,
  type ResumenPeriodoCorte,
  type TicketPeriodoCorte,
  type VentaAuditadaCorte,
} from "./corteCaja.utils";

export default function CorteCajaTab() {
  const { user, isAdmin, hasRole } = useAuth();
  const [efectivoFisico, setEfectivoFisico] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<"todos" | "efectivo" | "transferencia" | "cheque">("todos");
  const [fechaFiltroDesde, setFechaFiltroDesde] = useState("");
  const [fechaFiltroHasta, setFechaFiltroHasta] = useState("");
  const [resultado, setResultado] = useState<{
    efectivo_teorico: number;
    efectivo_fisico: number;
    diferencia: number;
    total_ventas: number;
    total_efectivo: number;
    total_transferencia: number;
    total_cheque: number;
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
  const fechaInicioPeriodo = ultimoCorte?.fecha_fin || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const fechaFinPreview = new Date().toISOString();

  const {
    data: resumenPeriodo,
    isLoading: loadingResumenPeriodo,
    refetch: refetchResumenPeriodo,
  } = useQuery({
    queryKey: ['corte-caja-cdmx-resumen', fechaInicioPeriodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          id,
          numero_venta,
          total,
          created_at,
          pagos_clientes(
            id,
            monto,
            forma_pago
          )
        `)
        .eq('tipo', 'pos_cdmx')
        .gte('created_at', fechaInicioPeriodo)
        .lt('created_at', fechaFinPreview);

      if (error) throw error;
      return construirResumenPeriodoCorte((data || []) as VentaAuditadaCorte[]);
    },
  });

  const efectivoTeoricoPreview = resumenPeriodo?.totalEfectivo || 0;
  const loadingPreview = loadingResumenPeriodo;

  const {
    data: auditoriaGranelPeriodo = [],
    isLoading: loadingAuditoriaGranel,
  } = useQuery({
    queryKey: ["corte-caja-cdmx-granel", fechaInicioPeriodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_inventario_cdmx")
        .select("cantidad, created_at, motivo")
        .gte("created_at", fechaInicioPeriodo)
        .lt("created_at", fechaFinPreview);

      if (error) throw error;
      return (data || []) as AuditoriaGranelPeriodo[];
    },
  });

  const {
    data: ticketsPeriodo = [],
    isLoading: loadingTicketsPeriodo,
  } = useQuery({
    queryKey: ['corte-caja-cdmx-tickets-periodo', fechaInicioPeriodo],
    queryFn: async () => {
      const { data, error } = await supabaseCdmx
        .from('tickets_pos_cdmx')
        .select('id, venta_id, numero_venta, cliente_nombre, metodo_pago, total, created_at, items')
        .gte('created_at', fechaInicioPeriodo)
        .lt('created_at', fechaFinPreview)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map((ticket) => ({
        id: ticket.id,
        venta_id: ticket.venta_id,
        numero_venta: ticket.numero_venta,
        cliente_nombre: ticket.cliente_nombre,
        metodo_pago: ticket.metodo_pago,
        total: Number(ticket.total || 0),
        created_at: ticket.created_at,
        items: Array.isArray(ticket.items)
          ? ticket.items.map((item, index) => ({
              id: String(item.id || item.nombre || index),
              nombre: String(item.nombre || 'Producto'),
              cantidad: Number(item.cantidad || 0),
              precio_venta: Number(item.precio_venta || 0),
            }))
          : [],
      })) as TicketPeriodoCorte[];
    },
  });

  const {
    data: ventasConciliacion = [],
    isLoading: loadingConciliacion,
  } = useQuery({
    queryKey: ['corte-caja-cdmx-conciliacion', fechaInicioPeriodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          id,
          numero_venta,
          total,
          created_at,
          pagos_clientes(
            id,
            monto,
            forma_pago
          )
        `)
        .eq('tipo', 'pos_cdmx')
        .gte('created_at', fechaInicioPeriodo)
        .lt('created_at', fechaFinPreview)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as VentaAuditadaCorte[];
    },
  });

  const ticketsFiltrados = useMemo(() => {
    return ticketsPeriodo.filter((ticket) => {
      if (filtroMetodoPago !== "todos" && ticket.metodo_pago !== filtroMetodoPago) {
        return false;
      }

      const fechaTicket = new Date(ticket.created_at);

      if (fechaFiltroDesde) {
        const desde = new Date(`${fechaFiltroDesde}T00:00:00`);
        if (fechaTicket < desde) {
          return false;
        }
      }

      if (fechaFiltroHasta) {
        const hasta = new Date(`${fechaFiltroHasta}T23:59:59.999`);
        if (fechaTicket > hasta) {
          return false;
        }
      }

      return true;
    });
  }, [ticketsPeriodo, filtroMetodoPago, fechaFiltroDesde, fechaFiltroHasta]);

  const resumenActual = resultado ? {
    totalVentas: resultado.total_ventas,
    totalEfectivo: resultado.total_efectivo,
    totalTransferencia: resultado.total_transferencia,
    totalCheque: resultado.total_cheque,
  } : (resumenPeriodo || {
    totalVentas: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalCheque: 0,
  });

  const resumenGranelPeriodo = useMemo(
    () => resumirAuditoriaGranelPeriodo(auditoriaGranelPeriodo),
    [auditoriaGranelPeriodo],
  );

  const {
    data: ventasAuditadas,
    isLoading: loadingVentasAuditadas,
  } = useQuery({
    queryKey: ['corte-caja-cdmx-auditoria', fechaInicioPeriodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          id,
          numero_venta,
          total,
          created_at,
          pagos_clientes(
            id,
            monto,
            forma_pago
          )
        `)
        .eq('tipo', 'pos_cdmx')
        .gte('created_at', fechaInicioPeriodo)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data || []) as VentaAuditadaCorte[];
    },
  });

  const incidenciasAuditoria = obtenerIncidenciasAuditoria(ventasAuditadas || []);
  const puedeCerrarCorte = isAdmin || hasRole("ventas") || hasRole("almacen");

  const conciliacionPeriodo = useMemo(
    () => construirConciliacionPeriodo(ticketsPeriodo, ventasConciliacion),
    [ticketsPeriodo, ventasConciliacion]
  );

  const obtenerResumenPeriodoAlCerrar = async (fechaInicio: string, fechaFin: string) => {
    const { data, error } = await supabase
      .from('ventas')
      .select(`
        id,
        numero_venta,
        total,
        created_at,
        pagos_clientes(
          id,
          monto,
          forma_pago
        )
      `)
      .eq('tipo', 'pos_cdmx')
      .gte('created_at', fechaInicio)
      .lt('created_at', fechaFin);

    if (error) throw error;

    return construirResumenPeriodoCorte((data || []) as VentaAuditadaCorte[]);
  };

  const realizarCorte = async () => {
    const efectivo = parseFloat(efectivoFisico);
    if (isNaN(efectivo) || efectivo < 0) {
      toast.error("Ingresa una cantidad válida");
      return;
    }

    if (loadingResumenPeriodo || !resumenPeriodo) {
      toast.error("Espera un momento", {
        description: "Todavía se están cargando las ventas del periodo para calcular el corte.",
      });
      return;
    }

    setProcessing(true);

    try {
      // Determine the period: from last closed corte to now
      const fechaInicio = fechaInicioPeriodo;
      const fechaFin = new Date().toISOString();
      const resumenCierre = await obtenerResumenPeriodoAlCerrar(fechaInicio, fechaFin);
      const teorico = Number(resumenCierre.totalEfectivo || 0);
      const diferencia = efectivo - teorico;
      const totalVentas = Number(resumenCierre.totalVentas || 0);
      const totalEfectivo = Number(resumenCierre.totalEfectivo || 0);
      const totalTransferencia = Number(resumenCierre.totalTransferencia || 0);
      const totalCheque = Number(resumenCierre.totalCheque || 0);

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
          total_ventas: totalVentas,
          total_efectivo: totalEfectivo,
          total_tarjeta: totalCheque,
          total_transferencia: totalTransferencia,
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
        total_ventas: totalVentas,
        total_efectivo: totalEfectivo,
        total_transferencia: totalTransferencia,
        total_cheque: totalCheque,
      });

      await Promise.all([
        refetchCortes(),
        refetchResumenPeriodo(),
      ]);

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

    } catch (err: unknown) {
      const message = normalizarMensajeErrorCorte(err);
      console.error("Error en corte:", err);
      toast.error("Error al procesar el corte", { description: message });
    } finally {
      setProcessing(false);
    }
  };

  const resetear = () => {
    setResultado(null);
    setEfectivoFisico('');
    setNotas('');
  };

  const imprimirTicketPeriodo = (ticket: TicketPeriodoCorte) => {
    const ticketWindow = window.open("", "_blank", "width=420,height=720");
    if (!ticketWindow) {
      toast.error("No se pudo abrir la ventana de impresión");
      return;
    }

    const filas = ticket.items.map((item) => `
      <tr>
        <td>${item.nombre}</td>
        <td style="text-align:center;">${item.cantidad}</td>
        <td style="text-align:right;">$${item.precio_venta.toFixed(2)}</td>
        <td style="text-align:right;">$${(item.cantidad * item.precio_venta).toFixed(2)}</td>
      </tr>
    `).join("");

    ticketWindow.document.write(`
      <html>
        <head>
          <title>${ticket.numero_venta}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
            .ticket { max-width: 320px; margin: 0 auto; }
            .title { text-align: center; font-weight: 700; font-size: 20px; margin-bottom: 4px; }
            .subtitle { text-align: center; font-size: 12px; color: #4b5563; margin-bottom: 16px; }
            .meta { font-size: 12px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 6px 0; border-bottom: 1px dashed #d1d5db; }
            .totals { margin-top: 12px; font-size: 13px; }
            .totals div { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .total { font-weight: 700; font-size: 16px; }
            .footer { margin-top: 16px; text-align: center; font-size: 11px; color: #6b7280; }
            @media print {
              body { padding: 0; }
              .ticket { max-width: none; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="title">JBM Bodega CDMX</div>
            <div class="subtitle">Ticket de venta</div>
            <div class="meta">
              <div><strong>Folio:</strong> ${ticket.numero_venta}</div>
              <div><strong>Fecha:</strong> ${new Date(ticket.created_at).toLocaleString("es-MX")}</div>
              <div><strong>Cliente:</strong> ${ticket.cliente_nombre}</div>
              <div><strong>Pago:</strong> ${ticket.metodo_pago}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="text-align:left;">Producto</th>
                  <th style="text-align:center;">Cant.</th>
                  <th style="text-align:right;">P.U.</th>
                  <th style="text-align:right;">Subt.</th>
                </tr>
              </thead>
              <tbody>${filas}</tbody>
            </table>
            <div class="totals">
              <div class="total"><span>Total</span><span>$${ticket.total.toFixed(2)}</span></div>
            </div>
            <div class="footer">
              Reimpresion desde Corte de Caja
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    ticketWindow.document.close();
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-auto bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Corte de Caja</h1>
        <p className="text-sm text-muted-foreground">Cierre operativo de efectivo y conciliación de ventas en Bodega CDMX</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 flex-1">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Corte de Caja
            </CardTitle>
            <CardDescription>
              Revisa el efectivo teórico del periodo y registra el efectivo físico para cerrar el corte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!resultado ? (
              <>
                {!puedeCerrarCorte && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    No tienes permiso para cerrar corte de caja con tu rol actual. Se requiere `admin`, `ventas` o `almacen`.
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-muted/50 rounded-lg p-6 text-center">
                    <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-lg font-semibold text-foreground">Efectivo teórico del periodo</p>
                    <p className="mt-2 text-3xl font-black font-mono text-[#1E5128]">
                      {loadingPreview ? "..." : `$${Number(efectivoTeoricoPreview).toFixed(2)}`}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Desde {format(new Date(fechaInicioPeriodo), "dd MMM yyyy HH:mm", { locale: es })}
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-6 text-center">
                    <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-lg font-semibold text-foreground">¿Cuánto dinero físico tienes en el cajón?</p>
                    <p className="text-sm text-muted-foreground mt-1">Cuenta billetes y monedas antes de confirmar el cierre</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs uppercase text-muted-foreground">Ventas del periodo</p>
                    <p className="mt-1 text-lg font-bold font-mono">${resumenActual.totalVentas.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs uppercase text-muted-foreground">Cobrado en efectivo</p>
                    <p className="mt-1 text-lg font-bold font-mono">${resumenActual.totalEfectivo.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs uppercase text-muted-foreground">Transferencias</p>
                    <p className="mt-1 text-lg font-bold font-mono">${resumenActual.totalTransferencia.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs uppercase text-muted-foreground">Cheques</p>
                    <p className="mt-1 text-lg font-bold font-mono">${resumenActual.totalCheque.toFixed(2)}</p>
                  </div>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-foreground">Resumen operativo de granel</p>
                    <p className="text-xs text-muted-foreground">
                      Movimiento de apertura y merma durante el mismo periodo del corte.
                    </p>
                  </div>

                  {loadingAuditoriaGranel ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-xs uppercase text-muted-foreground">Cajas Abiertas</p>
                        <p className="mt-1 text-lg font-bold font-mono">{resumenGranelPeriodo.cajasAbiertas.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-xs uppercase text-muted-foreground">Kg Generados</p>
                        <p className="mt-1 text-lg font-bold font-mono">{resumenGranelPeriodo.kilosGenerados.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-xs uppercase text-muted-foreground">Kg Merma</p>
                        <p className="mt-1 text-lg font-bold font-mono">{resumenGranelPeriodo.kilosMermados.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  )}
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
                  disabled={processing || !efectivoFisico || !puedeCerrarCorte}
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border bg-white p-3 text-center">
                    <p className="text-xs uppercase text-muted-foreground">Ventas</p>
                    <p className="mt-1 font-bold font-mono">${resultado.total_ventas.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-3 text-center">
                    <p className="text-xs uppercase text-muted-foreground">Efectivo</p>
                    <p className="mt-1 font-bold font-mono">${resultado.total_efectivo.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-3 text-center">
                    <p className="text-xs uppercase text-muted-foreground">Transferencias</p>
                    <p className="mt-1 font-bold font-mono">${resultado.total_transferencia.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-3 text-center">
                    <p className="text-xs uppercase text-muted-foreground">Cheques</p>
                    <p className="mt-1 font-bold font-mono">${resultado.total_cheque.toFixed(2)}</p>
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
            <div className="mb-6 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Reconciliacion tickets vs pagos</p>
                <p className="text-xs text-muted-foreground">
                  Cruce entre `tickets_pos_cdmx`, ventas POS y pagos asociados del periodo.
                </p>
              </div>

              {loadingConciliacion || loadingTicketsPeriodo ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-xs uppercase text-muted-foreground">Ventas POS</p>
                      <p className="mt-1 text-lg font-bold font-mono">{conciliacionPeriodo.totalVentas}</p>
                    </div>
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-xs uppercase text-muted-foreground">Tickets bitacora</p>
                      <p className="mt-1 text-lg font-bold font-mono">{conciliacionPeriodo.totalTickets}</p>
                    </div>
                    <div className={`rounded-lg border p-3 ${conciliacionPeriodo.cuadrado ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                      <p className="text-xs uppercase text-muted-foreground">Estado</p>
                      <p className={`mt-1 text-sm font-bold ${conciliacionPeriodo.cuadrado ? 'text-green-700' : 'text-amber-700'}`}>
                        {conciliacionPeriodo.cuadrado ? 'Cuadrado' : `${conciliacionPeriodo.incidencias.length} incidencia(s)`}
                      </p>
                    </div>
                  </div>

                  {conciliacionPeriodo.incidencias.length > 0 ? (
                    <div className="space-y-2">
                      {conciliacionPeriodo.incidencias.slice(0, 8).map((incidencia) => (
                        <div key={`${incidencia.ventaId}-${incidencia.detalle}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-sm font-bold text-amber-800">{incidencia.numeroVenta}</span>
                            <Badge variant="secondary">Revisar</Badge>
                          </div>
                          <div className="mt-2 text-xs text-amber-800">
                            {incidencia.detalle}
                            {" · "}
                            <strong>{format(new Date(incidencia.createdAt), "dd MMM yyyy HH:mm", { locale: es })}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                      Tickets, ventas y pagos del periodo cuadran entre si.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mb-6 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Tickets POS del periodo</p>
                <p className="text-xs text-muted-foreground">
                  Bitácora separada de tickets emitidos en CDMX durante el periodo actual.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="ticket-fecha-desde" className="text-xs">Desde</Label>
                  <Input
                    id="ticket-fecha-desde"
                    type="date"
                    value={fechaFiltroDesde}
                    onChange={(e) => setFechaFiltroDesde(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ticket-fecha-hasta" className="text-xs">Hasta</Label>
                  <Input
                    id="ticket-fecha-hasta"
                    type="date"
                    value={fechaFiltroHasta}
                    onChange={(e) => setFechaFiltroHasta(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Método de pago</Label>
                  <Select
                    value={filtroMetodoPago}
                    onValueChange={(value: "todos" | "efectivo" | "transferencia" | "cheque") => setFiltroMetodoPago(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loadingTicketsPeriodo ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : ticketsFiltrados.length > 0 ? (
                <div className="space-y-2">
                  {ticketsFiltrados.map((ticket) => (
                    <div key={ticket.id} className="rounded-lg border bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-bold">{ticket.numero_venta}</span>
                        <Badge variant="outline" className="uppercase">
                          {ticket.metodo_pago}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Cliente: <strong className="text-foreground">{ticket.cliente_nombre}</strong></div>
                        <div>Total: <strong className="font-mono text-foreground">${Number(ticket.total || 0).toFixed(2)}</strong></div>
                        <div className="col-span-2">
                          Hora: <strong className="text-foreground">{format(new Date(ticket.created_at), "dd MMM yyyy HH:mm", { locale: es })}</strong>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => imprimirTicketPeriodo(ticket)}
                          className="gap-2"
                        >
                          <Printer className="h-4 w-4" />
                          Reimprimir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No hay tickets registrados con los filtros actuales.
                </div>
              )}
            </div>

            <div className="mb-6 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Auditoría ligera POS</p>
                <p className="text-xs text-muted-foreground">
                  Revisa que cada venta del periodo tenga exactamente un pago asociado y montos cuadrados.
                </p>
              </div>

              {loadingVentasAuditadas ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : incidenciasAuditoria.length > 0 ? (
                <div className="space-y-2">
                  {incidenciasAuditoria.map((venta) => {
                    const pagos = venta.pagos_clientes || [];
                    const totalPagos = pagos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);

                    return (
                      <div key={venta.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-sm font-bold text-red-700">{venta.numero_venta}</span>
                          <Badge variant="destructive">
                            {pagos.length === 0
                              ? 'Sin pago'
                              : pagos.length > 1
                              ? 'Pago duplicado'
                              : 'Monto descuadrado'}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-red-700">
                          Venta: <strong className="font-mono">${Number(venta.total || 0).toFixed(2)}</strong>
                          {" · "}
                          Pagos: <strong className="font-mono">${totalPagos.toFixed(2)}</strong>
                          {" · "}
                          Registros: <strong>{pagos.length}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  Las ventas POS recientes del periodo tienen pago único y monto cuadrado.
                </div>
              )}

              {!loadingVentasAuditadas && (ventasAuditadas || []).length > 0 && (
                <div className="space-y-2">
                  {(ventasAuditadas || []).map((venta) => {
                    const pagos = venta.pagos_clientes || [];
                    const totalPagos = pagos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
                    const ventaCuadrada = pagos.length === 1 && Math.abs(totalPagos - Number(venta.total || 0)) <= 0.009;

                    return (
                      <div key={venta.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-sm font-bold">{venta.numero_venta}</span>
                          <Badge variant={ventaCuadrada ? "default" : "secondary"}>
                            {ventaCuadrada ? "OK" : "Revisar"}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>Total: <strong className="font-mono text-foreground">${Number(venta.total || 0).toFixed(2)}</strong></div>
                          <div>Pagado: <strong className="font-mono text-foreground">${totalPagos.toFixed(2)}</strong></div>
                          <div>Forma: <strong className="text-foreground">{pagos[0]?.forma_pago || 'Sin pago'}</strong></div>
                          <div>Hora: <strong className="text-foreground">{format(new Date(venta.created_at), "dd MMM HH:mm", { locale: es })}</strong></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!cortesHistorial || cortesHistorial.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin cortes registrados</p>
            ) : (
              <div className="space-y-3">
                {cortesHistorial.map((corte) => (
                  <div
                    key={corte.id}
                    className={`border rounded-lg p-3 ${
                      esCorteHistoricoInconsistente(corte)
                        ? 'border-rose-200 bg-rose-50'
                        : (corte.diferencia || 0) < 0
                        ? 'border-red-200 bg-red-50'
                        : (corte.diferencia || 0) > 0
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-bold">{corte.folio}</span>
                      <Badge variant={
                        esCorteHistoricoInconsistente(corte)
                          ? 'destructive'
                          : (corte.diferencia || 0) < 0
                          ? 'destructive'
                          : (corte.diferencia || 0) > 0
                          ? 'secondary'
                          : 'default'
                      }>
                        {esCorteHistoricoInconsistente(corte)
                          ? 'Registro inconsistente'
                          : (corte.diferencia || 0) === 0
                          ? 'Cuadrado'
                          : (corte.diferencia || 0) < 0
                          ? `Faltante $${Math.abs(corte.diferencia || 0).toFixed(2)}`
                          : `Sobrante $${(corte.diferencia || 0).toFixed(2)}`}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(corte.fecha_corte), "dd MMM yyyy HH:mm", { locale: es })}
                    </div>
                    {/* Full details only for admin */}
                    {isAdmin && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>Teórico: <strong className="font-mono">${corte.efectivo_teorico}</strong></div>
                        <div>Físico: <strong className="font-mono">${corte.efectivo_fisico || 0}</strong></div>
                      </div>
                    )}
                    {esCorteHistoricoInconsistente(corte) && (
                      <div className="mt-2 text-xs text-rose-700">
                        Este corte se guardó con cálculo anterior inconsistente. Conviene tomarlo sólo como referencia histórica.
                      </div>
                    )}
                    {isAdmin && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Efectivo: <strong className="font-mono text-foreground">${Number(corte.total_efectivo || 0).toFixed(2)}</strong></div>
                        <div>Transferencia: <strong className="font-mono text-foreground">${Number(corte.total_transferencia || 0).toFixed(2)}</strong></div>
                        <div>Cheques: <strong className="font-mono text-foreground">${Number(corte.total_tarjeta || 0).toFixed(2)}</strong></div>
                        <div>Ventas: <strong className="font-mono text-foreground">${Number(corte.total_ventas || 0).toFixed(2)}</strong></div>
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
