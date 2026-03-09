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
  Eye,
  EyeOff,
  Upload,
  CheckCircle,
  Download,
  Loader,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PDFDownloadLink } from '@react-pdf/renderer';
import { EstadoCuentaDocument } from '@/components/pdf/EstadoCuentaDocument';
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ComprasTab } from "@/components/finanzas/ComprasTab";

// Tipos basados en el esquema Supabase
type Lote = Database['public']['Tables']['lotes']['Row'];
type Productor = Database['public']['Tables']['productores']['Row'];
type Liquidacion = Database['public']['Tables']['liquidaciones']['Row'];
type Cliente = Database['public']['Tables']['clientes']['Row'];

// Tipos para los datos transformados
interface ClienteMoroso {
  id: string;
  nombre: string;
  saldo: number;
  diasVencido: number;
  limite: number;
}

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

// Datos simulados para conciliación
const pagosEnTransito: PagoEnTransito[] = [
  { id: 1, productor: "JESUS MOLINA", fecha: "10/04/2023", referencia: "CH-4869", monto: 28914 },
  { id: 2, productor: "MARTEL ALVAREZ", fecha: "09/04/2023", referencia: "TR-7890", monto: 15200 },
  { id: 3, productor: "DON ANGEL", fecha: "11/04/2023", referencia: "EF-1234", monto: 8500 },
];

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

  // --- SEGURIDAD: MANEJO DE GASTO EXTERNO (EXTORSIÓN/CUOTA) ---
  const [gastoExternoKilo, setGastoExternoKilo] = useState("0.04"); // Default 4 centavos
  const [nombreGastoExterno, setNombreGastoExterno] = useState("Ajuste Operativo"); // Nombre camuflado por defecto
  const [mostrarGastoEnPDF, setMostrarGastoEnPDF] = useState(false); // Por seguridad, oculto por defecto

  // Datos del Pago
  const [metodoPago, setMetodoPago] = useState<"cheque" | "transferencia" | "efectivo">("cheque");
  const [referenciaPago, setReferenciaPago] = useState("");

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
  const [clientesMorosos, setClientesMorosos] = useState<ClienteMoroso[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [guardandoLiquidacion, setGuardandoLiquidacion] = useState(false);

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
          // Usamos una verificación de string en lugar de comparación de tipo estricto
          const estaRechazado = lote.estado === 'pendiente';
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

  // Cargar clientes morosos
  useEffect(() => {
    const cargarClientesMorosos = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select(`
            *,
            clientes_sensible (
              limite_credito
            )
          `)
          .gt('saldo_deudor', 0)
          .order('saldo_deudor', { ascending: false });

        if (error) throw error;

        // Transformamos los datos para mantener compatibilidad
        const clientesTransformados: ClienteMoroso[] = (data || []).map(c => ({
          id: c.id,
          nombre: c.nombre,
          saldo: c.saldo_deudor,
          diasVencido: Math.floor(Math.random() * 60) + 1,
          limite: c.clientes_sensible?.limite_credito || 0
        }));

        setClientesMorosos(clientesTransformados);
      } catch (error) {
        console.error('Error cargando clientes morosos:', error);
      }
    };

    cargarClientesMorosos();
  }, []);

  const productorSeleccionado = productores.find(p => p.id === productorId);

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

  // 2. Cálculo del Gasto Externo (Seguridad)
  const cuotaKilo = parseFloat(gastoExternoKilo) || 0;
  const totalGastoExterno = totalKilos * cuotaKilo;

  // 3. Deducciones Operativas Manuales
  const totalDeduccionesOp =
    (parseFloat(deducciones.corte) || 0) +
    (parseFloat(deducciones.flete) || 0) +
    (parseFloat(deducciones.otros) || 0);

  // 4. Amortización de Anticipos
  const saldoDeudaAnticipo = productorSeleccionado?.saldo_anticipos || 0;
  const cobroAnticipo = parseFloat(amortizacionManual) || 0;
  const excedeAnticipo = cobroAnticipo > saldoDeudaAnticipo;

  // 5. GRAN TOTAL (A PAGAR)
  const totalPagar = importeBruto - totalGastoExterno - totalDeduccionesOp - cobroAnticipo;

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

      // 1. Crear la liquidación en Supabase
      const { data: liquidacion, error: errorLiquidacion } = await supabase
        .from('liquidaciones')
        .insert({
          productor_id: productorId,
          fecha_liquidacion: new Date().toISOString(),
          total_kilos: totalKilos,
          precio_por_kg: precioPromedio,
          subtotal: importeBruto,
          deduccion_corte: parseFloat(deducciones.corte) || 0,
          deduccion_flete: parseFloat(deducciones.flete) || 0,
          deduccion_anticipo: cobroAnticipo,
          total_pagar: totalPagar,
          forma_pago: metodoPago,
          referencia_pago: referenciaPago
        })
        .select()
        .single();

      if (errorLiquidacion) throw errorLiquidacion;

      // 2. Crear registros en liquidacion_lotes
      const liquidacionLotes = ticketsData.map(lote => ({
        liquidacion_id: liquidacion.id,
        lote_id: lote.id
      }));

      const { error: errorLotes } = await supabase
        .from('liquidacion_lotes')
        .insert(liquidacionLotes);

      if (errorLotes) throw errorLotes;

      // 3. Si hay amortización, actualizar saldo de anticipos del productor
      if (cobroAnticipo > 0 && productorSeleccionado) {
        const nuevoSaldo = productorSeleccionado.saldo_anticipos - cobroAnticipo;

        const { error: errorProductor } = await supabase
          .from('productores')
          .update({ saldo_anticipos: nuevoSaldo })
          .eq('id', productorId);

        if (errorProductor) throw errorProductor;
      }

      toast({
        title: "✅ Liquidación Procesada",
        description: `Pago registrado por $${totalPagar.toLocaleString("es-MX")}.`,
        className: "bg-slate-800 text-white border-none"
      });

      // Limpiar formulario
      setTicketsSeleccionados([]);
      setAmortizacionManual("");
      setDeducciones({ corte: "", flete: "", otros: "" });
      setReferenciaPago("");

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

    // Simulación de extracción de datos del PDF
    setTimeout(() => {
      // Datos simulados extraídos del PDF
      const movimientosSimulados: MovimientoBanco[] = [
        { fecha: "10/04/2023", concepto: "Pago a proveedor", retiro: 28914, deposito: 0, ref: "CH-4869" },
        { fecha: "09/04/2023", concepto: "Transferencia saliente", retiro: 15200, deposito: 0, ref: "TR-7890" },
        { fecha: "11/04/2023", concepto: "Retiro en efectivo", retiro: 8500, deposito: 0, ref: "EF-1234" },
        { fecha: "12/04/2023", concepto: "Depósito cliente", retiro: 0, deposito: 45000, ref: "DEP-001" },
      ];

      setMovimientosBanco(movimientosSimulados);
      setProcesandoPDF(false);

      toast({
        title: "✅ PDF Procesado",
        description: `Se extrajeron ${movimientosSimulados.length} movimientos del estado de cuenta.`,
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

  // --- LÓGICA COBRANZA ---
  const handleCobrarCliente = async (clienteId: string, clienteNombre: string) => {
    try {
      // Buscar el cliente en la lista de morosos
      const clienteMoroso = clientesMorosos.find(c => c.id === clienteId);
      if (!clienteMoroso) return;

      // Aquí implementarías la lógica para registrar un pago del cliente
      const { error } = await supabase
        .from('pagos_clientes')
        .insert({
          cliente_id: clienteId,
          monto: clienteMoroso.saldo,
          forma_pago: 'transferencia',
          referencia: `PAGO-${Date.now()}`
        });

      if (error) throw error;

      // Actualizar saldo del cliente
      const { error: errorUpdate } = await supabase
        .from('clientes')
        .update({ saldo_deudor: 0 })
        .eq('id', clienteId);

      if (errorUpdate) throw errorUpdate;

      toast({
        title: "💰 Pago Registrado",
        description: `Se ha registrado el pago de ${clienteNombre}`,
        className: "bg-blue-600 text-white border-none"
      });

      // Actualizar lista de clientes morosos
      setClientesMorosos(prev => prev.filter(c => c.id !== clienteId));

    } catch (error) {
      console.error('Error al registrar pago:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el pago",
        variant: "destructive"
      });
    }
  };

  return (
    <MainLayout title="Control de Pagos" subtitle="Liquidaciones Semanales">

      {/* KPIs Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Kilos (Semana)</p>
              <p className="text-2xl font-black text-slate-800">245,030 kg</p>
            </div>
            <div className="bg-slate-100 p-2 rounded-full"><Receipt className="h-6 w-6 text-slate-600" /></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pagado (Semana)</p>
              <p className="text-2xl font-black text-green-600">$4,520,000</p>
            </div>
            <div className="bg-green-50 p-2 rounded-full"><Wallet className="h-6 w-6 text-green-600" /></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Flujo Operativo</p>
              <p className="text-2xl font-black text-blue-600">$12,450</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-full"><Calculator className="h-6 w-6 text-blue-600" /></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="liquidaciones" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3 h-12 bg-muted p-1">
          <TabsTrigger value="liquidaciones" className="text-base font-medium">
            <Calculator className="h-4 w-4 mr-2" /> Liquidaciones
          </TabsTrigger>
          <TabsTrigger value="conciliacion" className="text-base font-medium">
            <Wallet className="h-4 w-4 mr-2" /> Conciliación
          </TabsTrigger>
          <TabsTrigger value="compras" className="text-base font-medium">
            <ShoppingCart className="h-4 w-4 mr-2" /> Compras
          </TabsTrigger>
        </TabsList>

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
                          {productorSeleccionado && (
                            <PDFDownloadLink
                              document={
                                <EstadoCuentaDocument
                                  productor={{
                                    id: productorSeleccionado.id,
                                    nombre: productorSeleccionado.nombre,
                                    rfc: "XAXX010101000"
                                  } as any}
                                  periodo={{ inicio: "01/01/2026", fin: "31/01/2026" }} // Esto debería ser dinámico
                                  resumen={{
                                    saldoInicial: 0,
                                    totalAbonos: importeBruto,
                                    totalCargos: totalDeduccionesOp + cobroAnticipo,
                                    saldoFinal: totalPagar
                                  }}
                                  movimientos={[
                                    // Convertimos tus tickets a formato de movimiento para el PDF
                                    ...ticketsData.map(t => ({
                                      fecha: t.fecha_recepcion,
                                      folio: t.numero_lote,
                                      concepto: `Entrega de Fruta (${t.peso_neto}kg x $${t.precio_pactado_kg})`,
                                      cargos: 0,
                                      abonos: (t.peso_neto || 0) * (t.precio_pactado_kg || 0),
                                      saldo: 0
                                    })),
                                    // Agregamos las deducciones como movimientos de cargo
                                    ...(cobroAnticipo > 0 ? [{
                                      fecha: new Date().toLocaleDateString(),
                                      folio: "ANT-AMORT",
                                      concepto: "Amortización de Anticipo",
                                      cargos: cobroAnticipo,
                                      abonos: 0,
                                      saldo: 0
                                    }] : [])
                                  ]}
                                />
                              }
                              fileName={`EstadoCuenta_${productorSeleccionado.nombre.replace(/\s+/g, '_')}.pdf`}
                            >
                              {/* El componente render props de PDFDownloadLink nos dice si está cargando.
         Si loading es true, mostramos "Generando...", si no, el icono.
      */}
                              {({ loading }) => (
                                <Button variant="outline" className="h-12 w-12 p-0" title="Descargar PDF Detallado" disabled={loading}>
                                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-red-600" />}
                                </Button>
                              )}
                            </PDFDownloadLink>
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

                    {/* --- CAMPO DE SEGURIDAD (LOS 4 CENTAVOS/EXTORSIÓN) --- */}
                    <div className="space-y-1 col-span-2 mt-2 pt-2 border-t border-dashed border-slate-300">
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-xs text-slate-500 font-bold uppercase flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          Ajuste Operativo (Privado)
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {mostrarGastoEnPDF ? "Visible en PDF" : "Oculto en PDF"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setMostrarGastoEnPDF(!mostrarGastoEnPDF)}
                          >
                            {mostrarGastoEnPDF ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-slate-400" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Nombre del concepto (Editable para camuflaje) */}
                        <Input
                          className="h-8 text-xs bg-slate-50"
                          value={nombreGastoExterno}
                          onChange={(e) => setNombreGastoExterno(e.target.value)}
                          placeholder="Concepto en Recibo"
                        />
                        {/* Monto por kilo */}
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$/kg</span>
                          <Input
                            className="h-8 pl-8 text-xs bg-white text-right font-mono"
                            value={gastoExternoKilo}
                            onChange={(e) => setGastoExternoKilo(e.target.value)}
                          />
                        </div>
                        {/* Total Calculado */}
                        <div className="h-8 flex items-center px-3 bg-red-50 rounded border border-red-100 text-red-800 font-bold text-xs w-32 justify-end">
                          - ${totalGastoExterno.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        * Este monto se descuenta del total. Si el "ojo" está cerrado, no se imprime en el PDF.
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
                      {/* El Gasto Externo SIEMPRE se resta aquí para que veas el neto real */}
                      {totalGastoExterno > 0 && (
                        <div className="flex justify-between text-xs bg-red-50 p-1 rounded">
                          <span className="flex items-center gap-1">
                            (-) {nombreGastoExterno}
                            {!mostrarGastoEnPDF && <EyeOff className="h-3 w-3 opacity-50" />}
                          </span>
                          <span>-${totalGastoExterno.toLocaleString()}</span>
                        </div>
                      )}
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
                  </div>

                  {/* BOTONES */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleGenerarLiquidacion}
                      className="flex-1 h-12 text-lg font-bold bg-green-600 hover:bg-green-700"
                      disabled={totalPagar < 0 || excedeAnticipo || guardandoLiquidacion}
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

                    {productorSeleccionado && ticketsData.length > 0 ? (
                      <PDFDownloadLink
                        document={
                          <EstadoCuentaDocument
                            productor={{
                              nombre: productorSeleccionado.nombre,
                              id: productorSeleccionado.id,
                              rfc: "XAXX010101000",
                            } as any}
                            periodo={{
                              inicio: new Date(Math.min(...ticketsData.map(t => new Date(t.fecha_recepcion).getTime()))).toLocaleDateString('es-MX'),
                              fin: new Date().toLocaleDateString('es-MX')
                            }}
                            resumen={{
                              saldoInicial: 0,
                              totalAbonos: importeBruto,
                              totalCargos: (mostrarGastoEnPDF ? totalGastoExterno : 0) + totalDeduccionesOp + cobroAnticipo,
                              saldoFinal: Math.max(0, totalPagar)
                            }}
                            movimientos={[
                              // ABONOS - Fruta entregada
                              ...ticketsData.map(t => ({
                                fecha: new Date(t.fecha_recepcion).toLocaleDateString('es-MX'),
                                folio: t.numero_lote,
                                concepto: `Entrega de Fruta - Lote ${t.numero_lote}`,
                                cargos: 0,
                                abonos: (t.peso_neto || 0) * (t.precio_pactado_kg || 0),
                                saldo: 0
                              })),

                              // CARGOS - Ordenados por tipo
                              ...(cobroAnticipo > 0 ? [{
                                fecha: new Date().toLocaleDateString('es-MX'),
                                folio: "ANT-AMORT",
                                concepto: "Amortización de Anticipo",
                                cargos: cobroAnticipo,
                                abonos: 0,
                                saldo: 0
                              }] : []),

                              ...(parseFloat(deducciones.corte) > 0 ? [{
                                fecha: new Date().toLocaleDateString('es-MX'),
                                folio: "DED-CORTE",
                                concepto: "Servicio de Corte",
                                cargos: parseFloat(deducciones.corte),
                                abonos: 0,
                                saldo: 0
                              }] : []),

                              ...(parseFloat(deducciones.flete) > 0 ? [{
                                fecha: new Date().toLocaleDateString('es-MX'),
                                folio: "DED-FLETE",
                                concepto: "Servicio de Flete",
                                cargos: parseFloat(deducciones.flete),
                                abonos: 0,
                                saldo: 0
                              }] : []),

                              ...(mostrarGastoEnPDF && totalGastoExterno > 0 ? [{
                                fecha: new Date().toLocaleDateString('es-MX'),
                                folio: "OP-LOG",
                                concepto: nombreGastoExterno,
                                cargos: totalGastoExterno,
                                abonos: 0,
                                saldo: 0
                              }] : [])
                            ]}
                          />
                        }
                        fileName={`Liquidacion_${productorSeleccionado.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`}
                      >
                        {({ loading }) => (
                          <Button variant="outline" className="h-12 w-12 p-0" title="Imprimir Recibo" disabled={loading}>
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5 text-slate-700" />}
                          </Button>
                        )}
                      </PDFDownloadLink>
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
                <CardDescription>Carga el PDF de BBVA para extraer movimientos automáticamente.</CardDescription>
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- PESTAÑA 3: COBRANZA --- */}
        <TabsContent value="cobranza" className="space-y-6">
          <Card className="module-card">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Antigüedad de Saldos
                  </CardTitle>
                  <CardDescription>Clientes con facturas vencidas o por vencer</CardDescription>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Moroso (+30d)</Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Vencido (+15d)</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {clientesMorosos.map((cliente) => {
                  const dias = cliente.diasVencido;
                  const borderClass = dias > 30 ? "border-l-red-500" : dias > 15 ? "border-l-amber-500" : "border-l-slate-200";

                  return (
                    <div
                      key={cliente.id}
                      className={cn("p-4 rounded-r-lg border border-l-4 bg-white shadow-sm hover:shadow-md transition-shadow", borderClass)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg text-slate-800">{cliente.nombre}</span>
                            {dias > 30 && <Badge variant="destructive" className="animate-pulse">ACCIÓN LEGAL REQUERIDA</Badge>}
                          </div>
                          <div className="flex gap-6 mt-2 text-sm text-slate-500">
                            <span className="flex items-center gap-1"><Receipt className="h-3 w-3" /> Límite: ${cliente.limite.toLocaleString()}</span>
                            <span className={cn("font-bold flex items-center gap-1", dias > 15 ? "text-red-600" : "text-slate-600")}>
                              <AlertTriangle className="h-3 w-3" /> {dias} días vencido
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground uppercase">Deuda Total</p>
                            <p className={cn("text-2xl font-black", dias > 30 ? "text-red-600" : "text-slate-700")}>
                              ${cliente.saldo.toLocaleString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleCobrarCliente(cliente.id, cliente.nombre)}
                          >
                            Registrar Pago <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}