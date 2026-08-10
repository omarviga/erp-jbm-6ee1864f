import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ArrowRight,
  Calculator,
  Printer,
  Loader2,
  CreditCard,
  Upload,
  CheckCircle,
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
type Lote = Database['public']['Tables']['lotes']['Row'];
type Productor = Database['public']['Tables']['productores']['Row'];
type Liquidacion = Database['public']['Tables']['liquidaciones']['Row'];
type Cliente = Database['public']['Tables']['clientes']['Row'];
type AdelantoResultado = Database['public']['Functions']['registrar_adelanto_productor']['Returns'][number];
type LiquidacionResultado = Database['public']['Functions']['procesar_liquidacion_productor']['Returns'][number];

// Tipos para los datos transformados

interface LiquidacionPasada {
  id: string;
  fecha: string;
  productor: string;
  monto: number;
  estatus: string;
  ref: string;
}

interface MovimientoBanco {
  fecha: string;
  concepto: string;
  retiro: number;
  deposito: number;
  ref: string;
}

interface PagoEnTransito {
  id: number;
  productor: string;
  fecha: string;
  referencia: string;
  monto: number;
}

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

const pagosEnTransito: PagoEnTransito[] = [];
export const CXP_LOTES_SELECT_FIELDS =
  'id, productor_id, numero_lote, fecha_recepcion, peso_neto, precio_pactado_kg, costo_bascula, estado_calidad';

// Función para obtener la semana del año
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export default function Finanzas() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ESTADOS LIQUIDACIONES ---
  const [productorId, setProductorId] = useState("");
  const [ticketsSeleccionados, setTicketsSeleccionados] = useState<string[]>([]);

  // Estados financieros
  const [amortizacionManual, setAmortizacionManual] = useState("");

  // Datos del Pago
  const [metodoPago, setMetodoPago] = useState<"cheque" | "transferencia" | "efectivo">("cheque");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [montoAdelanto, setMontoAdelanto] = useState("");
  const [metodoPagoCxp, setMetodoPagoCxp] = useState<"cheque" | "transferencia" | "efectivo">("transferencia");
  const [referenciaPagoCxp, setReferenciaPagoCxp] = useState("");
  const [montoAdelantoCxp, setMontoAdelantoCxp] = useState("");

  // Deducciones Operativas Normales
  const [deducciones, setDeducciones] = useState({
    corte: "",
    flete: "",
    otros: ""
  });

  // --- ESTADOS CONCILIACIÓN ---
  const [movimientosBanco, setMovimientosBanco] = useState<MovimientoBanco[]>([]);
  const [procesandoPDF, setProcesandoPDF] = useState(false);

  // --- ESTADOS PARA DATOS DE SUPABASE ---
  // CORREGIDO: Ya no declaramos loadingProductores aquí, viene del hook
  const [productores, setProductores] = useState<Productor[]>([]);
  const [lotesPendientes, setLotesPendientes] = useState<Lote[]>([]);
  const [liquidacionesPasadas, setLiquidacionesPasadas] = useState<LiquidacionPasada[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [guardandoLiquidacion, setGuardandoLiquidacion] = useState(false);
  const [registrandoAdelanto, setRegistrandoAdelanto] = useState(false);
  const [generandoEstadoCuentaPdf, setGenerandoEstadoCuentaPdf] = useState(false);
  const [generandoLiquidacionPdf, setGenerandoLiquidacionPdf] = useState(false);
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

  // Ejemplo de uso:

  // Cargar lotes pendientes cuando se selecciona un productor
  useEffect(() => {
    const cargarLotesPendientes = async () => {
      if (!productorId) {
        setLotesPendientes([]);
        return;
      }

      try {
        setLoadingLotes(true);

        // Primero obtenemos las liquidaciones existentes
        const { data: liquidaciones, error: errorLiquidaciones } = await supabase
          .from('liquidaciones')
          .select('id')
          .eq('productor_id', productorId);

        if (errorLiquidaciones) throw errorLiquidaciones;

        // Obtenemos los lotes ya liquidados
        const liquidacionIds = liquidaciones?.map(l => l.id) || [];
        let lotesLiquidados: string[] = [];

        if (liquidacionIds.length > 0) {
          const { data: lotesLiquidadosData, error: errorLotesLiquidados } = await supabase
            .from('liquidacion_lotes')
            .select('lote_id')
            .in('liquidacion_id', liquidacionIds);

          if (errorLotesLiquidados) throw errorLotesLiquidados;
          lotesLiquidados = lotesLiquidadosData?.map(l => l.lote_id) || [];
        }

        // Obtenemos todos los lotes del productor y filtramos los no liquidados
        const { data: todosLotes, error: errorLotes } = await supabase
          .from('lotes')
          .select(`
            *,
            huertos:huerto_id (
              nombre
            )
          `)
          .eq('productor_id', productorId)
          .order('fecha_recepcion', { ascending: true });

        if (errorLotes) throw errorLotes;

        // Filtramos lotes que no están en liquidacion_lotes y no están rechazados
        const lotesPendientes = todosLotes?.filter(lote => {
          const estaLiquidado = lotesLiquidados.includes(lote.id);
          const estadoCalidad = (lote.estado_calidad || '').toLowerCase();
          const estaRechazado = estadoCalidad === 'rechazado';
          return !estaLiquidado && !estaRechazado;
        }) || [];

        setLotesPendientes(lotesPendientes);
      } catch (error) {
        console.error('Error cargando lotes pendientes:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los lotes pendientes",
          variant: "destructive"
        });
      } finally {
        setLoadingLotes(false);
      }
    };

    cargarLotesPendientes();
  }, [productorId, toast]);

  // Cargar liquidaciones pasadas
  useEffect(() => {
    const cargarLiquidacionesPasadas = async () => {
      try {
        const { data, error } = await supabase
          .from('liquidaciones')
          .select(`
            *,
            productores:productor_id (
              nombre
            )
          `)
          .order('fecha_liquidacion', { ascending: false })
          .limit(10);

        if (error) throw error;

        // Transformamos los datos para mantener compatibilidad
        const liquidacionesTransformadas: LiquidacionPasada[] = (data || []).map(l => ({
          id: l.id,
          fecha: new Date(l.fecha_liquidacion).toLocaleDateString('es-MX'),
          productor: l.productores?.nombre || 'N/A',
          monto: l.total_pagar || 0,
          estatus: 'pagado',
          ref: l.referencia_pago || ''
        }));

        setLiquidacionesPasadas(liquidacionesTransformadas);
      } catch (error) {
        console.error('Error cargando liquidaciones pasadas:', error);
      }
    };

    cargarLiquidacionesPasadas();
  }, []);

  useEffect(() => {
    const cargarResumenCxp = async () => {
      try {
        setCargandoCxp(true);

        const [{ data: cxpData, error: errorCxp }, { data: liquidacionesData, error: errorLiquidaciones }] = await Promise.all([
          supabase
            .from('cuentas_por_pagar')
            .select('id, productor_id, numero_lote, fecha_ticket, kilos_netos, precio_kg, monto_total, monto_pagado, saldo_pendiente, estado')
            .gt('saldo_pendiente', 0)
            .order('fecha_ticket', { ascending: true }),
          supabase
            .from('liquidaciones')
            .select('productor_id, total_pagar'),
        ]);

        if (errorCxp) throw errorCxp;
        if (errorLiquidaciones) throw errorLiquidaciones;
        const pagosPorProductor = (liquidacionesData || []).reduce<Record<string, number>>((acc, liquidacion) => {
          const key = liquidacion.productor_id || '';
          if (!key) return acc;
          acc[key] = (acc[key] || 0) + (liquidacion.total_pagar || 0);
          return acc;
        }, {});

        const ahora = new Date();
        const resumen = productores
          .map((productor) => {
            const ticketsPendientes = (cxpData || [])
              .filter((ticket) => ticket.productor_id === productor.id)
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

            const deudaTotal = ticketsPendientes.reduce((sum, ticket) => sum + ticket.importe, 0);
            const saldoVivo = ticketsPendientes.reduce((sum, ticket) => sum + ticket.saldoPendiente, 0);
            const masAntiguoDias = ticketsPendientes.reduce((max, ticket) => Math.max(max, ticket.antiguedadDias), 0);

            return {
              productorId: productor.id,
              productor: productor.nombre,
              deudaTotal,
              pagado: pagosPorProductor[productor.id] || 0,
              saldoVivo,
              tickets: ticketsPendientes.length,
              masAntiguoDias,
              detalleTickets: ticketsPendientes,
            };
          })
          .filter((item) => item.deudaTotal > 0 || item.saldoVivo > 0 || item.tickets > 0)
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

  const productorSeleccionado = productores.find(p => p.id === productorId);
  const productorPdf = productorSeleccionado
    ? {
        ...productorSeleccionado,
        rfc: productorSeleccionado.rfc || "XAXX010101000",
      }
    : null;
  const handleDescargarEstadoCuenta = async () => {
    if (!productorPdf || !productorSeleccionado) return;

    setGenerandoEstadoCuentaPdf(true);
    try {
      openPrintDocument(
        `EstadoCuenta_${productorSeleccionado.nombre.replace(/\s+/g, "_")}.pdf`,
        renderEstadoCuentaHtml({
          productor: productorPdf,
          periodo: { inicio: "01/01/2026", fin: "31/01/2026" },
          resumen: {
            saldoInicial: 0,
            totalAbonos: importeBruto,
            totalCargos: totalDeduccionesOp + cobroAnticipo,
            saldoFinal: totalPagar,
          },
          movimientos: [
            ...ticketsData.map((t) => ({
              fecha: t.fecha_recepcion,
              folio: t.numero_lote,
              concepto: `Entrega de Fruta (${t.peso_neto}kg x $${t.precio_pactado_kg})`,
              cargos: 0,
              abonos: (t.peso_neto || 0) * (t.precio_pactado_kg || 0),
              saldo: 0,
            })),
            ...(cobroAnticipo > 0
              ? [{
                  fecha: new Date().toLocaleDateString(),
                  folio: "ANT-AMORT",
                  concepto: "Amortización de Anticipo",
                  cargos: cobroAnticipo,
                  abonos: 0,
                  saldo: 0,
                }]
              : []),
          ],
        }),
      );
    } finally {
      setGenerandoEstadoCuentaPdf(false);
    }
  };

  const handleDescargarLiquidacionPdf = async () => {
    if (!productorPdf || !productorSeleccionado || ticketsData.length === 0) return;

    setGenerandoLiquidacionPdf(true);
    try {
      openPrintDocument(
        `Liquidacion_${productorSeleccionado.nombre.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
        renderEstadoCuentaHtml({
          productor: productorPdf,
          periodo: {
            inicio: new Date(Math.min(...ticketsData.map((t) => new Date(t.fecha_recepcion).getTime()))).toLocaleDateString("es-MX"),
            fin: new Date().toLocaleDateString("es-MX"),
          },
          resumen: {
            saldoInicial: 0,
            totalAbonos: importeBruto,
            totalCargos: totalDeduccionesOp + cobroAnticipo,
            saldoFinal: Math.max(0, totalPagar),
          },
          movimientos: [
            ...ticketsData.map((t) => ({
              fecha: new Date(t.fecha_recepcion).toLocaleDateString("es-MX"),
              folio: t.numero_lote,
              concepto: `Entrega de Fruta - Lote ${t.numero_lote}`,
              cargos: 0,
              abonos: (t.peso_neto || 0) * (t.precio_pactado_kg || 0),
              saldo: 0,
            })),
            ...(cobroAnticipo > 0
              ? [{
                  fecha: new Date().toLocaleDateString("es-MX"),
                  folio: "ANT-AMORT",
                  concepto: "Amortización de Anticipo",
                  cargos: cobroAnticipo,
                  abonos: 0,
                  saldo: 0,
                }]
              : []),
            ...(parseFloat(deducciones.corte) > 0
              ? [{
                  fecha: new Date().toLocaleDateString("es-MX"),
                  folio: "DED-CORTE",
                  concepto: "Servicio de Corte",
                  cargos: parseFloat(deducciones.corte),
                  abonos: 0,
                  saldo: 0,
                }]
              : []),
            ...(parseFloat(deducciones.flete) > 0
              ? [{
                  fecha: new Date().toLocaleDateString("es-MX"),
                  folio: "DED-FLETE",
                  concepto: "Servicio de Flete",
                  cargos: parseFloat(deducciones.flete),
                  abonos: 0,
                  saldo: 0,
                }]
              : []),
          ],
        }),
      );
    } finally {
      setGenerandoLiquidacionPdf(false);
    }
  };
  const productorCxpDetalle = cxpResumen.find((item) => item.productorId === productorCxpSeleccionado) || cxpResumen[0];
  const montoAdelantoCxpNum = parseFloat(montoAdelantoCxp) || 0;
  const ticketsAplicablesCxp = productorCxpDetalle
    ? productorCxpDetalle.detalleTickets.filter((ticket) => ticketsCxpSeleccionados.includes(ticket.id))
    : [];
  const saldoSeleccionadoCxp = ticketsAplicablesCxp.reduce((sum, ticket) => sum + ticket.saldoPendiente, 0);
  const saldoProyectadoCxp = productorCxpDetalle
    ? Math.max(0, productorCxpDetalle.saldoVivo - Math.min(montoAdelantoCxpNum, saldoSeleccionadoCxp))
    : 0;

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

  // --- LÓGICA DE CÁLCULO ---
  const toggleTicket = (id: string) => {
    setTicketsSeleccionados(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const ticketsData = lotesPendientes.filter(t => ticketsSeleccionados.includes(t.id));

  // 1. Totales Básicos
  const totalKilos = ticketsData.reduce((sum, t) => sum + (t.peso_neto || 0), 0);
  const importeBruto = ticketsData.reduce((sum, t) => sum + ((t.peso_neto || 0) * (t.precio_pactado_kg || 0)), 0);
  const precioPromedio = totalKilos > 0 ? (importeBruto / totalKilos) : 0;

  const totalGastoExterno = 0;

  // 2. Deducciones Operativas Manuales
  const totalDeduccionesOp =
    (parseFloat(deducciones.corte) || 0) +
    (parseFloat(deducciones.flete) || 0) +
    (parseFloat(deducciones.otros) || 0);

  // 3. Amortización de Anticipos
  const saldoDeudaAnticipo = productorSeleccionado?.saldo_anticipos || 0;
  const cobroAnticipo = parseFloat(amortizacionManual) || 0;
  const excedeAnticipo = cobroAnticipo > saldoDeudaAnticipo;

  // 4. GRAN TOTAL (A PAGAR)
  const totalPagar = importeBruto - totalDeduccionesOp - cobroAnticipo;

  const handleRegistrarAdelanto = async (overrideProductorId?: string) => {
    const productorObjetivoId = overrideProductorId || productorId;
    const productorObjetivo = productores.find((productor) => productor.id === productorObjetivoId);

    if (!productorObjetivoId || !productorObjetivo) {
      toast({
        title: "⚠️ Selecciona un productor",
        description: "Debes elegir un productor antes de registrar un adelanto.",
        variant: "destructive"
      });
      return;
    }

    const monto = parseFloat(montoAdelanto) || 0;
    if (monto <= 0) {
      toast({
        title: "⚠️ Monto inválido",
        description: "Ingresa un monto mayor a cero para registrar el adelanto.",
        variant: "destructive"
      });
      return;
    }

    if ((metodoPago === 'cheque' || metodoPago === 'transferencia') && !referenciaPago.trim()) {
      toast({
        title: "⚠️ Falta referencia",
        description: metodoPago === "cheque"
          ? "Ingresa el número de cheque para registrar el adelanto."
          : "Ingresa la referencia de transferencia para registrar el adelanto.",
        variant: "destructive"
      });
      return;
    }

    try {
      setRegistrandoAdelanto(true);

      const { data, error } = await supabase.rpc('registrar_adelanto_productor' as never, {
        p_productor_id: productorObjetivoId,
        p_monto: monto,
        p_forma_pago: metodoPago,
        p_referencia: referenciaPago.trim() || null,
      } as never);

      if (error) throw error;

      const resultado = Array.isArray(data) ? (data as AdelantoResultado[])[0] : null;
      if (!resultado?.success) {
        throw new Error(resultado?.mensaje || "No se pudo registrar el adelanto");
      }

      await refreshProductores();
      setCxpRefreshKey((prev) => prev + 1);

      toast({
        title: "✅ Adelanto registrado",
        description: `Se registró un adelanto por $${monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} para ${productorObjetivo.nombre}.`,
        className: "bg-slate-800 text-white border-none"
      });

      setMontoAdelanto("");
      setReferenciaPago("");
    } catch (error) {
      console.error('Error al registrar adelanto:', error);
      const errorMessage = error instanceof Error ? error.message : "No se pudo registrar el adelanto";
      toast({
        title: "❌ Error al registrar adelanto",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setRegistrandoAdelanto(false);
    }
  };

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
      const { data: abonoData, error: abonoError } = await supabase
        .from('abonos_productor')
        .insert({
          productor_id: productorObjetivoId,
          monto,
          metodo_pago: metodoPagoCxp,
          referencia: referenciaPagoCxp.trim() || null,
          notas: `Aplicación parcial a ${ticketsAplicablesCxp.length} nota(s) desde CxP`,
          usuario_id: userData.user?.id || null,
        })
        .select('id')
        .single();

      if (abonoError || !abonoData) throw abonoError || new Error("No se pudo crear el abono");

      let restante = monto;
      const ticketsOrdenados = [...ticketsAplicablesCxp].sort((a, b) => b.antiguedadDias - a.antiguedadDias);

      for (const ticket of ticketsOrdenados) {
        if (restante <= 0) break;
        const aplicar = Math.min(restante, ticket.saldoPendiente);
        if (aplicar <= 0) continue;

        const nuevoMontoPagado = ticket.montoPagado + aplicar;
        const nuevoSaldoPendiente = Math.max(0, ticket.saldoPendiente - aplicar);
        const nuevoEstado = nuevoSaldoPendiente <= 0 ? 'pagado' : 'pendiente';

        const { error: updateError } = await supabase
          .from('cuentas_por_pagar')
          .update({
            monto_pagado: nuevoMontoPagado,
            saldo_pendiente: nuevoSaldoPendiente,
            estado: nuevoEstado,
          })
          .eq('id', ticket.id);

        if (updateError) throw updateError;

        const { error: asignacionError } = await supabase
          .from('abono_asignaciones')
          .insert({
            abono_id: abonoData.id,
            cxp_id: ticket.id,
            monto_aplicado: aplicar,
          });

        if (asignacionError) throw asignacionError;
        restante -= aplicar;
      }

      if (restante > 0.009) {
        throw new Error("No se pudo aplicar el monto completo a las notas seleccionadas.");
      }

      await refreshProductores();
      setCxpRefreshKey((prev) => prev + 1);
      if (productores.length > 0) {
        const productoresActualizados = [...productores];
        setProductores(productoresActualizados);
      }

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
      console.error('Error al registrar adelanto:', error);
      const errorMessage = error instanceof Error ? error.message : "No se pudo registrar el adelanto";
      toast({
        title: "❌ Error al registrar adelanto",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setRegistrandoAdelanto(false);
    }
  };

  const handleGenerarLiquidacion = async () => {
    if (ticketsData.length === 0) {
      toast({ title: "⚠️ Sin lotes seleccionados", description: "Selecciona al menos un lote para liquidar", variant: "destructive" });
      return;
    }

    if (totalPagar < 0) {
      toast({ title: "⚠️ Saldo Negativo", description: "El cálculo resulta en saldo negativo.", variant: "destructive" });
      return;
    }

    if (metodoPago === 'cheque' && !referenciaPago) {
      toast({ title: "⚠️ Falta Cheque", description: "Ingresa el número de cheque.", variant: "destructive" });
      return;
    }

    try {
      setGuardandoLiquidacion(true);

      const { data, error } = await supabase.rpc('procesar_liquidacion_productor' as never, {
        p_productor_id: productorId,
        p_lote_ids: ticketsData.map((lote) => lote.id),
        p_total_kilos: totalKilos,
        p_precio_por_kg: precioPromedio,
        p_deduccion_corte: parseFloat(deducciones.corte) || 0,
        p_deduccion_flete: parseFloat(deducciones.flete) || 0,
        p_deduccion_anticipo: cobroAnticipo,
        p_total_pagar: totalPagar,
        p_forma_pago: metodoPago,
        p_referencia_pago: referenciaPago.trim() || null,
      } as never);

      if (error) throw error;

      const resultado = Array.isArray(data) ? (data as LiquidacionResultado[])[0] : null;
      if (!resultado?.success) {
        throw new Error(resultado?.mensaje || "No se pudo guardar la liquidación");
      }

      toast({
        title: "✅ Liquidación Procesada",
        description: `Pago registrado por $${totalPagar.toLocaleString("es-MX")}.`,
        className: "bg-slate-800 text-white border-none"
      });

      // Limpiar formulario
      setTicketsSeleccionados([]);
      setAmortizacionManual("");
      setMontoAdelanto("");
      setDeducciones({ corte: "", flete: "", otros: "" });
      setReferenciaPago("");
      await refreshProductores();
      setCxpRefreshKey((prev) => prev + 1);

      const { data: liquidacionesRecientes, error: liquidacionesRecientesError } = await supabase
        .from('liquidaciones')
        .select(`
          *,
          productores:productor_id (
            nombre
          )
        `)
        .order('fecha_liquidacion', { ascending: false })
        .limit(10);

      if (!liquidacionesRecientesError) {
        setLiquidacionesPasadas((liquidacionesRecientes || []).map((l) => ({
          id: l.id,
          fecha: new Date(l.fecha_liquidacion).toLocaleDateString('es-MX'),
          productor: l.productores?.nombre || 'N/A',
          monto: l.total_pagar || 0,
          estatus: 'pagado',
          ref: l.referencia_pago || ''
        })));
      }

      // Recargar lotes pendientes
      setLotesPendientes(prev => prev.filter(l => !ticketsSeleccionados.includes(l.id)));

    } catch (error) {
      console.error('Error al guardar liquidación:', error);
      const errorMessage = error instanceof Error ? error.message : "No se pudo guardar la liquidación";
      toast({
        title: "❌ Error al guardar",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setGuardandoLiquidacion(false);
    }
  };

  // --- LÓGICA CONCILIACIÓN BANCARIA ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcesandoPDF(true);

    setTimeout(() => {
      setMovimientosBanco([]);
      setProcesandoPDF(false);

      toast({
        title: "Archivo recibido",
        description: `Se cargó ${file.name}. Ya puedes usar este espacio para revisar y conciliar movimientos.`,
        className: "bg-blue-600 text-white"
      });

      // Limpiar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, 1500);
  };

  const esMatch = (montoRetiro: number, montoPago: number) => {
    // Comparación con tolerancia de 1 peso por redondeos
    return Math.abs(montoRetiro - montoPago) < 1;
  };

  return (
    <MainLayout title="Control de Pagos" subtitle="Liquidaciones Semanales">

      <Tabs defaultValue="cxp" className="space-y-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-5 h-12 bg-muted p-1">
          <TabsTrigger value="cxp" className="text-base font-medium">
            <Receipt className="h-4 w-4 mr-2" /> CxP
          </TabsTrigger>
          <TabsTrigger value="liquidaciones" className="text-base font-medium">
            <Calculator className="h-4 w-4 mr-2" /> Liquidaciones
          </TabsTrigger>
          <TabsTrigger value="resumen" className="text-base font-medium">
            <Wallet className="h-4 w-4 mr-2" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="conciliacion" className="text-base font-medium">
            <CreditCard className="h-4 w-4 mr-2" /> Conciliación
          </TabsTrigger>
          <TabsTrigger value="compras" className="text-base font-medium">
            <ShoppingCart className="h-4 w-4 mr-2" /> Compras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cxp" className="space-y-6">
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
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tickets Pendientes</p>
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
                          <th className="px-4 py-3 text-center font-medium">Tickets</th>
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
                            <p className="text-xs text-slate-500">Detalle de tickets pendientes ordenados por antigüedad.</p>
                          </div>
                          <Badge variant="secondary">{productorCxpDetalle.tickets} tickets</Badge>
                        </div>
                        <div className="space-y-3">
                          {productorCxpDetalle.detalleTickets.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin tickets pendientes.</p>
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
                            <span>Registrar adelanto</span>
                            <span className="text-slate-500 normal-case">Disponible desde CxP</span>
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
                              placeholder="Monto del adelanto"
                              value={montoAdelantoCxp}
                              onChange={(e) => setMontoAdelantoCxp(e.target.value)}
                            />
                          </div>
                          <p className="text-xs text-slate-600">
                            Saldo seleccionado:
                            <span className="ml-1 font-semibold text-slate-800">
                              ${saldoSeleccionadoCxp.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                          <p className="text-xs text-slate-600">
                            Saldo proyectado después del adelanto:
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
                            {registrandoAdelanto ? "Registrando..." : `Registrar adelanto a ${productorCxpDetalle.productor}`}
                          </Button>
                        </div>
                        <div className="mt-6 rounded-lg bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Saldo actual</p>
                          <p className="mt-1 text-2xl font-black text-slate-800">
                            ${productorCxpDetalle.saldoVivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </p>
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

        <TabsContent value="liquidaciones" className="space-y-6">
          <div className="grid lg:grid-cols-12 gap-6">

            {/* --- COLUMNA IZQUIERDA: SELECCIÓN Y GASTOS (7 cols) --- */}
            <div className="lg:col-span-7 space-y-6">

              {/* 1. SELECCIÓN PRODUCTOR */}
              <Card className="shadow-md border-l-4 border-l-blue-600">
                <CardHeader className="pb-3"><CardTitle className="text-lg">1. Seleccionar Productor</CardTitle></CardHeader>
                <CardContent>
                  <Select
                    value={productorId}
                    onValueChange={(v) => {
                      setProductorId(v);
                      setTicketsSeleccionados([]);
                      setAmortizacionManual("");
                    }}
                    disabled={cargandoProductores} // CORREGIDO: Usa cargandoProductores en lugar de loadingProductores
                  >
                    <SelectTrigger className="h-12 bg-slate-50 font-medium">
                      {cargandoProductores ? ( // CORREGIDO: Usa cargandoProductores
                        <div className="flex gap-3 pt-2">
                          <Button onClick={handleGenerarLiquidacion} className="flex-1 h-12 text-lg font-bold bg-green-600 hover:bg-green-700" disabled={totalPagar < 0 || excedeAnticipo}>
                            Generar Pago
                          </Button>

                          {/* Botón de PDF Dinámico */}
                          {productorPdf && (
                            <Button
                              variant="outline"
                              className="h-12 w-12 p-0"
                              title="Descargar PDF Detallado"
                              disabled={generandoEstadoCuentaPdf}
                              onClick={() => void handleDescargarEstadoCuenta()}
                            >
                              {generandoEstadoCuentaPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-red-600" />}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <SelectValue placeholder="Buscar por Nombre o Alias..." />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {productores.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="py-2">
                          <span className="font-bold text-slate-900">{p.nombre}</span>
                          {p.saldo_anticipos > 0 && (
                            <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700">
                              Anticipo: ${p.saldo_anticipos.toLocaleString()}
                            </Badge>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Tabla de Tickets */}
                  {productorId && (
                    <div className="mt-6 border rounded-lg overflow-hidden">
                      {loadingLotes ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                          <span className="ml-2 text-slate-600">Cargando lotes pendientes...</span>
                        </div>
                      ) : (
                        <>
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                              <tr>
                                <th className="p-3">Sel.</th>
                                <th className="p-3">Nota</th>
                                <th className="p-3">Fecha</th>
                                <th className="p-3 text-right">Kilos Netos</th>
                                <th className="p-3 text-right">Precio</th>
                                <th className="p-3 text-right">Importe</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lotesPendientes.map((lote) => (
                                <tr key={lote.id}
                                  className={cn("border-t hover:bg-blue-50 cursor-pointer", ticketsSeleccionados.includes(lote.id) && "bg-blue-50")}
                                  onClick={() => toggleTicket(lote.id)}
                                >
                                  <td className="p-3">
                                    <Checkbox checked={ticketsSeleccionados.includes(lote.id)} />
                                  </td>
                                  <td className="p-3 font-bold text-slate-700">{lote.numero_lote}</td>
                                  <td className="p-3 text-slate-500">
                                    {new Date(lote.fecha_recepcion).toLocaleDateString('es-MX')}
                                  </td>
                                  <td className="p-3 text-right font-mono">{lote.peso_neto?.toLocaleString() || "0"}</td>
                                  <td className="p-3 text-right font-mono">${lote.precio_pactado_kg?.toFixed(2) || "0.00"}</td>
                                  <td className="p-3 text-right font-bold text-slate-900">
                                    ${((lote.peso_neto || 0) * (lote.precio_pactado_kg || 0)).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="p-2 bg-slate-50 text-xs text-center text-muted-foreground border-t">
                            {ticketsSeleccionados.length} notas seleccionadas de {lotesPendientes.length} disponibles
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 2. DEDUCCIONES Y CAMPO ESPECIAL (SEGURIDAD) */}
              {ticketsSeleccionados.length > 0 && (
                <Card className="shadow-md border-l-4 border-l-amber-500">
                  <CardHeader className="pb-3 flex flex-row justify-between items-center">
                    <CardTitle className="text-lg">2. Deducciones Operativas</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Corte ($)</Label>
                      <Input type="number" placeholder="0.00" value={deducciones.corte} onChange={e => setDeducciones({ ...deducciones, corte: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Flete ($)</Label>
                      <Input type="number" placeholder="0.00" value={deducciones.flete} onChange={e => setDeducciones({ ...deducciones, flete: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Otros Gastos ($)</Label>
                      <Input type="number" placeholder="0.00" value={deducciones.otros} onChange={e => setDeducciones({ ...deducciones, otros: e.target.value })} />
                    </div>

                    <div className="space-y-1 col-span-2 mt-2 pt-2 border-t border-dashed border-slate-300">
                      <Label className="text-xs text-slate-500 font-bold uppercase flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        Ajuste operativo desactivado
                      </Label>
                      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Este concepto está desactivado y no afecta cálculos ni documentos de liquidación.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* --- COLUMNA DERECHA: RESUMEN DE PAGO (5 cols) --- */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="sticky top-6 border-t-8 border-t-slate-800 shadow-xl bg-slate-50/50">
                <CardHeader className="bg-white border-b border-dashed pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle>Liquidación Semanal</CardTitle>
                    <Badge variant="outline" className="font-mono font-bold">
                      SEMANA #{getWeekNumber(new Date())}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">

                  {/* DESGLOSE */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Kilos:</span>
                      <span className="font-bold">{totalKilos.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-slate-600">Subtotal (Bruto):</span>
                      <span className="font-bold text-lg">${importeBruto.toLocaleString()}</span>
                    </div>

                    {/* Lista de Restas */}
                    <div className="space-y-1 text-red-600">
                      {totalDeduccionesOp > 0 && (
                        <div className="flex justify-between text-xs">
                          <span>(-) Gastos Operativos:</span>
                          <span>-${totalDeduccionesOp.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ANTICIPOS */}
                  <div className="bg-white p-3 rounded border space-y-2 mt-2">
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                      <span>Anticipos / Préstamos</span>
                      <span className="text-xs text-muted-foreground">
                        Saldo: ${saldoDeudaAnticipo.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs">$</span>
                        <Input
                          className="h-7 pl-4 text-xs text-right border-red-200 text-red-700 font-bold"
                          placeholder="0.00"
                          value={amortizacionManual}
                          onChange={(e) => setAmortizacionManual(e.target.value)}
                        />
                      </div>
                      {excedeAnticipo && (
                        <span className="text-xs text-red-600">Excede el saldo de anticipo</span>
                      )}
                    </div>
                  </div>

                  {/* TOTAL A PAGAR */}
                  <div className="bg-slate-900 text-white p-4 rounded-lg shadow-lg mt-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-medium text-slate-300">Neto a Pagar</span>
                      <span className="text-3xl font-black text-green-400">
                        ${Math.max(0, totalPagar).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* DATOS BANCARIOS */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 space-y-3">
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase">
                      <CreditCard className="h-3 w-3" /> Datos del Pago
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={metodoPago} onValueChange={(value: "cheque" | "transferencia" | "efectivo") => setMetodoPago(value)}>
                        <SelectTrigger className="h-9 text-xs bg-white col-span-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="transferencia">Transf.</SelectItem>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-9 text-xs bg-white col-span-2 font-mono"
                        placeholder={metodoPago === 'cheque' ? "No. Cheque" : "Referencia"}
                        value={referenciaPago}
                        onChange={(e) => setReferenciaPago(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 rounded-md border border-blue-200 bg-white p-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase text-blue-800">
                        <span>Registrar Adelanto</span>
                        <span className="text-slate-500 normal-case">Pago parcial / anticipo</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          className="h-9 text-xs bg-white col-span-2 font-mono"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Monto del adelanto"
                          value={montoAdelanto}
                          onChange={(e) => setMontoAdelanto(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 text-xs"
                          onClick={() => handleRegistrarAdelanto()}
                          disabled={registrandoAdelanto || !productorId}
                        >
                          {registrandoAdelanto ? "Registrando..." : "Registrar"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* BOTONES */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleGenerarLiquidacion}
                      className="flex-1 h-12 text-lg font-bold bg-green-600 hover:bg-green-700"
                      disabled={totalPagar < 0 || excedeAnticipo || guardandoLiquidacion || registrandoAdelanto}
                    >
                      {guardandoLiquidacion ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        "Registrar Liquidación"
                      )}
                    </Button>

                    {productorPdf && ticketsData.length > 0 ? (
                      <Button
                        variant="outline"
                        className="h-12 w-12 p-0"
                        title="Imprimir Recibo"
                        disabled={generandoLiquidacionPdf}
                        onClick={() => void handleDescargarLiquidacionPdf()}
                      >
                        {generandoLiquidacionPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5 text-slate-700" />}
                      </Button>
                    ) : (
                      <Button variant="outline" className="h-12 w-12 p-0" disabled><Printer className="h-5 w-5" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* --- PESTAÑA 2: CONCILIACIÓN BANCARIA (BBVA) --- */}
        <TabsContent value="conciliacion" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">

            {/* IZQUIERDA: CARGA DE PDF */}
            <Card className="h-full border-blue-200 shadow-md">
              <CardHeader className="bg-blue-50/50 pb-4 border-b">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-blue-600" /><CardTitle className="text-base">Movimientos Bancarios</CardTitle></div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={procesandoPDF}
                    >
                      {procesandoPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Subir Estado de Cuenta
                    </Button>
                  </div>
                </div>
                <CardDescription>Carga el PDF de BBVA para revisar movimientos bancarios en esta vista.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {movimientosBanco.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Upload className="h-12 w-12 mb-2 opacity-20" />
                    <p>Sin archivo cargado</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-[500px] overflow-y-auto">
                    {movimientosBanco.map((mov, idx) => (
                      <div key={idx} className="p-3 hover:bg-slate-50 flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", mov.retiro > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>
                            {mov.retiro > 0 ? <ArrowRight className="h-3 w-3 rotate-45" /> : <ArrowRight className="h-3 w-3 -rotate-135" />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-700">{mov.concepto}</p>
                            <p className="text-[10px] text-muted-foreground">{mov.fecha} • {mov.ref}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-mono font-bold", mov.retiro > 0 ? "text-red-600" : "text-green-600")}>
                            {mov.retiro > 0 ? `-$${mov.retiro.toLocaleString()}` : `+$${mov.deposito.toLocaleString()}`}
                          </p>
                          {pagosEnTransito.some(p => esMatch(mov.retiro, p.monto)) && (
                            <Badge className="bg-green-100 text-green-800 border-green-200 mt-1 h-4 text-[10px]">Coincide</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DERECHA: ERP */}
            <Card className="h-full border-slate-200">
              <CardHeader className="pb-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-slate-500" /> Pagos en ERP
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {pagosEnTransito.length > 0 ? (
                  <div className="divide-y">
                    {pagosEnTransito.map((pago) => {
                      const match = movimientosBanco.find(m => esMatch(m.retiro, pago.monto));
                      return (
                        <div key={pago.id} className={cn("p-4 flex justify-between items-center transition-colors", match ? "bg-green-50/50" : "bg-white")}>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{pago.productor}</p>
                              {match && <CheckCircle className="h-4 w-4 text-green-600" />}
                            </div>
                            <p className="text-xs text-muted-foreground">{pago.fecha} • {pago.referencia}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-mono font-medium text-slate-700">${pago.monto.toLocaleString()}</p>
                            {match ? (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                                onClick={() => toast({ title: "Conciliado" })}
                              >
                                Conciliar
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-slate-400">Pendiente</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-12 text-center text-sm text-slate-500">
                    No hay pagos del ERP disponibles para conciliar en este momento.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
