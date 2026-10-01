import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  ExternalLink,
  Eye,
  Factory,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProductores } from "@/hooks/useProductores";
import {
  useFolioRecepcionPreview,
  useRecepcion,
} from "@/hooks/useRecepcion";
import {
  useTicketsRecientes,
  type TicketReciente,
} from "@/hooks/useTicketsRecientes";
import {
  useBoletasOffline,
  type TicketHistorial,
} from "@/hooks/useBoletasOffline";
import { supabase } from "@/integrations/supabase/client";
import {
  moneda,
  nombreDesdeEmail,
  VARIEDAD_UNICA,
} from "@/lib/recepcion/calculos";
import {
  copiarTextoTicket,
  formatearResumenCompartirBoleta,
} from "@/lib/recepcion/textoTicket";
import { urlLote } from "@/lib/urls";
import {
  TicketBascula,
  type TicketRecepcion,
} from "@/components/recepcion/TicketBascula";
import { ThermalReceiptPreview } from "@/components/recepcion/ThermalReceiptPreview";
import { RecepcionModal } from "@/components/recepcion/RecepcionModal";
import { NuevoProductorDialog } from "@/components/recepcion/NuevoProductorDialog";
import { payloadADatosRecepcion } from "@/components/recepcion/mapeo";
import type {
  ProductorOption,
  RecepcionPayload,
} from "@/components/recepcion/types";

const CLAVE_OPERADOR = "recepcion.operador_bascula";
const LIMITE_TICKETS = 15;

const formatearFechaHora = (fecha: Date): string =>
  fecha.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const formatearFechaTabla = (fechaISO: string): string =>
  new Date(fechaISO).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatearKilos = (valor: number): string =>
  valor.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface ResultadoGuardado {
  loteId: string;
  numeroLote: string;
  folioRecepcion: string | null;
  pesoNeto: number;
  total: number;
  productorNombre: string;
  ticket: TicketRecepcion;
  viaRespaldo: boolean;
}

/** Ticket guardado → modelo de la boleta imprimible. */
const ticketRecienteABoleta = (t: TicketReciente): TicketRecepcion => ({
  folioOficial: t.folioRecepcion ?? "",
  folioFisico: t.folioFisico ?? "",
  numeroLote: t.numeroLote,
  productor: t.productorNombre,
  origen: t.esCosechaPropia ? "Cosecha propia" : "Compra externa",
  huerto: "—",
  localidad: "",
  variedad: t.variedad || VARIEDAD_UNICA,
  operador: t.operadorBascula,
  pesoBruto: t.pesoBruto,
  tara: t.pesoTara,
  pesoNeto: t.pesoNeto,
  kilosMerma: t.kilosMerma,
  defectosPct: t.defectosPct,
  precioKg: t.precioKg,
  subtotal: t.subtotal,
  costoBascula: t.costoBascula,
  basculaFormaPago: t.basculaFormaPago,
  cuotaManiobraKg: t.cuotaManiobraKg,
  cuotaManiobraConcepto: t.cuotaManiobraConcepto,
  cuotaManiobra: t.cuotaManiobraTotal,
  totalDeducciones: t.totalDeducciones,
  total: t.total,
  precioNetoEfectivo: t.precioNetoEfectivo,
  fecha: formatearFechaHora(new Date(t.fechaRecepcion)),
  statusUrl: urlLote(t.id),
  borrador: false,
});

const etiquetaBoleta = (t: TicketHistorial): string =>
  t.folioRecepcion || t.folioFisico || t.numeroLote;

export default function Recepcion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const operadorSugerido = useMemo(() => {
    if (typeof localStorage === "undefined") return "";
    return (
      localStorage.getItem(CLAVE_OPERADOR) || nombreDesdeEmail(user?.email)
    );
  }, [user?.email]);

  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null);
  const [pendienteImpresion, setPendienteImpresion] = useState(false);
  const [boletaAbierta, setBoletaAbierta] = useState(false);
  const [dialogoProductor, setDialogoProductor] = useState(false);
  const [productorSugeridoBoleta, setProductorSugeridoBoleta] = useState<string | undefined>(undefined);
  const [ticketSelId, setTicketSelId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [preview, setPreview] = useState<TicketHistorial | null>(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const timerEliminar = useRef<number | null>(null);
  const timerImpresion = useRef<number | null>(null);

  const { productores } = useProductores();

  const {
    guardarRecepcion,
    loading: guardando,
    aviso,
    limpiarAviso,
  } = useRecepcion();

  const { data: folioOficialPreview } = useFolioRecepcionPreview();
  const { tickets, loading: cargandoTickets } = useTicketsRecientes(LIMITE_TICKETS);
  const {
    offline,
    totalOffline,
    cargandoOffline,
    enLinea,
    sincronizando,
    guardarOffline,
    eliminarOffline,
    sincronizar,
  } = useBoletasOffline(guardarRecepcion);

  useEffect(
    () => () => {
      if (timerEliminar.current !== null) window.clearTimeout(timerEliminar.current);
      if (timerImpresion.current !== null) window.clearTimeout(timerImpresion.current);
    },
    []
  );

  // Servidor + IndexedDB local, más recientes primero.
  const combinados = useMemo<TicketHistorial[]>(
    () =>
      [...offline, ...tickets].sort(
        (a, b) =>
          new Date(b.fechaRecepcion).getTime() - new Date(a.fechaRecepcion).getTime()
      ),
    [offline, tickets]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return combinados;
    return combinados.filter((t) =>
      [t.folioRecepcion, t.folioFisico, t.numeroLote, t.productorNombre]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(q))
    );
  }, [combinados, busqueda]);

  // Selecciona el más reciente al cargar para mostrar su detalle.
  // No espera al almacén offline: el espejo local es síncrono y el
  // servidor se fusiona al llegar sin mover la selección existente.
  useEffect(() => {
    if (ticketSelId === null && combinados.length > 0) {
      setTicketSelId(combinados[0].id);
    }
  }, [ticketSelId, combinados]);

  const productoresOpciones: ProductorOption[] = useMemo(
    () =>
      productores.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        localidad: null,
      })),
    [productores]
  );

  const guardarBoleta = useCallback(
    async (payload: RecepcionPayload, opts: { imprimir: boolean }) => {
      const nombreProductor =
        productores.find((p) => p.id === payload.productorId)?.nombre ??
        "SIN ASIGNAR";
      try {
        const res = await guardarRecepcion(payloadADatosRecepcion(payload));
        const ticket: TicketRecepcion = {
          folioOficial: res.folio_recepcion ?? folioOficialPreview ?? "",
          folioFisico: payload.folioBascula,
          numeroLote: res.numero_lote,
          productor: nombreProductor,
          origen: "Compra externa",
          huerto: "—",
          localidad: "",
          variedad: VARIEDAD_UNICA,
          operador: payload.operadorBascula,
          pesoBruto: payload.pesoBruto,
          tara: payload.pesoTara,
          pesoNeto: res.peso_neto,
          kilosMerma: 0,
          defectosPct: 0,
          precioKg: payload.precioKg,
          subtotal: payload.resumen.subtotalFruta,
          costoBascula: payload.cuotaBascula,
          basculaFormaPago: payload.formaPagoBascula,
          cuotaManiobraKg: payload.tarifaManiobraKg,
          cuotaManiobraConcepto: payload.conceptoManiobra,
          cuotaManiobra: payload.resumen.cargoManiobraTotal,
          totalDeducciones: payload.resumen.descuentoBascula + payload.resumen.cargoManiobraTotal,
          total: res.total_liquidar,
          precioNetoEfectivo: payload.resumen.precioNetoEfectivo,
          fecha: formatearFechaHora(new Date()),
          statusUrl: urlLote(res.id),
          borrador: false,
        };

        if (typeof localStorage !== "undefined" && payload.operadorBascula.trim()) {
          localStorage.setItem(CLAVE_OPERADOR, payload.operadorBascula.trim());
        }

        setResultado({
          loteId: res.id,
          numeroLote: res.numero_lote,
          folioRecepcion: res.folio_recepcion,
          pesoNeto: res.peso_neto,
          total: res.total_liquidar,
          productorNombre: nombreProductor,
          ticket,
          viaRespaldo: res.viaRespaldo,
        });
        setTicketSelId(res.id);

        queryClient.invalidateQueries({ queryKey: ["lotes"] });
        queryClient.invalidateQueries({ queryKey: ["productores"] });
        queryClient.invalidateQueries({ queryKey: ["recepcion"] });

        setBoletaAbierta(false);
        if (opts.imprimir) setPendienteImpresion(true);

        toast.success(`Lote ${res.numero_lote} recibido`, {
          description: `Folio ${res.folio_recepcion ?? "sin folio"} · ${res.peso_neto.toLocaleString(
            "es-MX"
          )} kg netos · ${moneda(res.total_liquidar)}`,
        });
      } catch (error) {
        // Sin conexión: la boleta queda en IndexedDB con badge OFFLINE
        // hasta la sincronización manual.
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          const datos = payloadADatosRecepcion(payload);
          const vista: TicketReciente = {
            id: "",
            numeroLote: "PENDIENTE",
            folioRecepcion: null,
            folioFisico: payload.folioBascula || null,
            fechaRecepcion: new Date().toISOString(),
            productorId: payload.productorId,
            productorNombre: nombreProductor,
            esCosechaPropia: false,
            estadoCalidad: "aceptado",
            pesoBruto: payload.pesoBruto,
            pesoTara: payload.pesoTara,
            pesoNeto: Math.max(0, payload.resumen.pesoNeto),
            kilosMerma: 0,
            defectosPct: 0,
            precioKg: payload.precioKg,
            subtotal: payload.resumen.subtotalFruta,
            costoBascula: payload.cuotaBascula,
            basculaFormaPago: payload.formaPagoBascula,
            basculaDescontada: payload.resumen.descuentoBascula,
            cuotaManiobraKg: payload.tarifaManiobraKg,
            cuotaManiobraConcepto: payload.conceptoManiobra,
            cuotaManiobraTotal: payload.resumen.cargoManiobraTotal,
            totalDeducciones:
              payload.resumen.descuentoBascula + payload.resumen.cargoManiobraTotal,
            total: payload.resumen.totalLiquidar,
            precioNetoEfectivo: payload.resumen.precioNetoEfectivo,
            operadorBascula: payload.operadorBascula,
            variedad: VARIEDAD_UNICA,
          };
          try {
            const guardada = await guardarOffline(datos, vista);
            setBoletaAbierta(false);
            setTicketSelId(guardada.id);
            toast.warning("Sin conexión: boleta guardada offline", {
              description:
                "Quedó en este equipo con badge OFFLINE. Sincronízala cuando vuelva la red.",
            });
          } catch {
            toast.error("No se pudo guardar la boleta offline", {
              description: "Intenta nuevamente",
            });
          }
          return;
        }
        toast.error("No se pudo registrar la boleta", {
          description:
            error instanceof Error ? error.message : "Intenta nuevamente",
        });
      }
    },
    [guardarRecepcion, guardarOffline, productores, folioOficialPreview, queryClient]
  );

  const imprimir = useCallback(() => {
    window.print();
  }, []);

  // Imprime cuando el ticket ya está en el DOM: tras guardar (resultado)
  // o al pedir impresión directa de una fila (selección). El timer vive
  // en un ref para que consumir el flag no cancele el disparo.
  useEffect(() => {
    if (!pendienteImpresion) return;
    if (!resultado && !ticketSelId) return;
    setPendienteImpresion(false);
    if (timerImpresion.current !== null) window.clearTimeout(timerImpresion.current);
    timerImpresion.current = window.setTimeout(() => window.print(), 150);
  }, [pendienteImpresion, resultado, ticketSelId]);

  const nuevaRecepcion = useCallback(() => {
    setResultado(null);
    setBoletaAbierta(true);
  }, []);

  const imprimirBoleta = useCallback((t: TicketHistorial) => {
    setResultado(null);
    setTicketSelId(t.id);
    setPendienteImpresion(true);
  }, []);

  const imprimirPreview = useCallback(() => {
    if (!preview) return;
    setResultado(null);
    setTicketSelId(preview.id);
    setPreview(null);
    setPendienteImpresion(true);
  }, [preview]);

  const compartirBoleta = useCallback(async (t: TicketHistorial) => {
    const texto = formatearResumenCompartirBoleta(ticketRecienteABoleta(t));
    const ok = await copiarTextoTicket(texto);
    if (ok) {
      toast.success("Resumen copiado", {
        description: "Pégalo en WhatsApp para enviarlo al productor.",
      });
    } else {
      toast.error("No se pudo copiar el resumen");
    }
  }, []);

  const ejecutarEliminacion = useCallback(
    async (t: TicketHistorial) => {
      setConfirmarEliminarId(null);
      if (t.offline) {
        await eliminarOffline(t.id);
        if (ticketSelId === t.id) setTicketSelId(null);
        toast.success("Boleta offline eliminada");
        return;
      }
      const { error } = await supabase.from("lotes").delete().eq("id", t.id);
      if (error) {
        toast.error("No se pudo eliminar la boleta", {
          description: error.message,
        });
        return;
      }
      if (ticketSelId === t.id) setTicketSelId(null);
      queryClient.invalidateQueries({ queryKey: ["recepcion"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success(`Boleta ${etiquetaBoleta(t)} eliminada`);
    },
    [eliminarOffline, ticketSelId, queryClient]
  );

  /** Eliminación en dos pasos: el primer clic arma, el segundo confirma. */
  const pedirEliminar = useCallback(
    (t: TicketHistorial) => {
      if (confirmarEliminarId !== t.id) {
        setConfirmarEliminarId(t.id);
        if (timerEliminar.current !== null) window.clearTimeout(timerEliminar.current);
        timerEliminar.current = window.setTimeout(() => setConfirmarEliminarId(null), 4000);
        return;
      }
      if (timerEliminar.current !== null) window.clearTimeout(timerEliminar.current);
      void ejecutarEliminacion(t);
    },
    [confirmarEliminarId, ejecutarEliminacion]
  );

  const sincronizarAhora = useCallback(async () => {
    const { ok, fallos } = await sincronizar();
    if (ok > 0) {
      toast.success(`${ok} boleta(s) sincronizada(s)`, {
        description: "Ya están en la base central con folio oficial.",
      });
    }
    if (fallos > 0) {
      toast.error(`${fallos} boleta(s) no se pudieron sincronizar`, {
        description: "Revisa la conexión e intenta de nuevo.",
      });
    }
    if (ok === 0 && fallos === 0) {
      toast.info("Sin pendientes por sincronizar");
    }
  }, [sincronizar]);

  const ticketSeleccionado = combinados.find((t) => t.id === ticketSelId) ?? null;
  const ticketMostrado = resultado?.ticket ?? (
    ticketSeleccionado ? ticketRecienteABoleta(ticketSeleccionado) : null
  );

  return (
    <MainLayout
      title="Recepción"
      subtitle="Pesaje de báscula, liquidación al productor y boleta de entrada"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Captura una boleta nueva o revisa los últimos tickets registrados.
          </p>
          <Button
            type="button"
            onClick={() => setBoletaAbierta(true)}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            <ReceiptText className="mr-2 h-4 w-4" aria-hidden="true" />
            Nueva Boleta de Recepción &amp; Pesaje
          </Button>
        </div>

        {aviso && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p className="flex-1 text-sm text-amber-900">{aviso}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={limpiarAviso}
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}

        {resultado && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Lote {resultado.numeroLote} registrado y disponible en producción
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-emerald-700">Folio oficial</p>
                  <p className="font-mono text-lg font-bold text-emerald-900">
                    {resultado.folioRecepcion ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Peso neto</p>
                  <p className="font-mono text-lg font-bold text-emerald-900">
                    {resultado.pesoNeto.toLocaleString("es-MX")} kg
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Total a liquidar</p>
                  <p className="font-mono text-lg font-bold text-emerald-900">
                    {moneda(resultado.total)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Productor</p>
                  <p className="truncate text-lg font-bold text-emerald-900">
                    {resultado.productorNombre}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                  <Link to={`/lotes/${resultado.loteId}`}>
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                    Ver expediente del lote
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/produccion">
                    <Factory className="mr-2 h-4 w-4" aria-hidden="true" />
                    Ir a Producción
                  </Link>
                </Button>
                <Button variant="outline" onClick={imprimir}>
                  <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                  Imprimir boleta
                </Button>
                <Button variant="ghost" onClick={nuevaRecepcion}>
                  Nueva recepción
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="space-y-3 border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Historial de Boletas
                </h2>
                <p className="text-xs text-slate-500">
                  {combinados.length} recepción(es)
                  {totalOffline > 0 && ` · ${totalOffline} offline`} · selecciona
                  una boleta para ver su detalle e imprimirla.
                </p>
              </div>
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por folio, ticket de báscula o productor…"
                aria-label="Buscar boletas"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          {totalOffline > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
              <CloudOff className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="flex-1 text-sm font-medium text-amber-900">
                {totalOffline} boleta(s) pendiente(s) de sincronización
                {!enLinea && " · sin conexión: se sincronizarán al restablecer la red"}
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => void sincronizarAhora()}
                disabled={!enLinea || sincronizando}
                className="bg-amber-500 text-amber-950 hover:bg-amber-400"
              >
                {sincronizando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Sincronizar ahora
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
                <th className="px-3 py-2">Folio</th>
                <th className="px-3 py-2">Fecha / Hora</th>
                <th className="px-3 py-2">Productor</th>
                <th className="px-3 py-2 text-right">Peso Bruto</th>
                <th className="px-3 py-2 text-right">Tara</th>
                <th className="px-3 py-2 text-right">Peso Neto</th>
                <th className="px-3 py-2 text-right">Precio / Total</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => {
                const seleccionado = t.id === ticketSelId;
                const armado = confirmarEliminarId === t.id;
                return (
                  <tr
                    key={t.id}
                    onClick={() => {
                      setResultado(null);
                      setTicketSelId(t.id);
                    }}
                    className={`cursor-pointer border-t border-slate-100 ${
                      t.offline
                        ? "bg-amber-50/50"
                        : seleccionado
                          ? "bg-emerald-50"
                          : "hover:bg-slate-50"
                    }`}
                  >
                    <td
                      className={`px-3 py-2 ${t.offline ? "border-l-4 border-l-amber-500" : ""}`}
                    >
                      <p className="font-mono font-bold">
                        {t.folioRecepcion || t.numeroLote}
                      </p>
                      {t.folioFisico && (
                        <p className="font-mono text-[11px] text-slate-500">
                          Báscula: {t.folioFisico}
                        </p>
                      )}
                      {t.offline && (
                        <Badge className="mt-1 border-amber-300 bg-amber-100 text-[10px] text-amber-800 hover:bg-amber-100">
                          <CloudOff className="mr-1 h-3 w-3" aria-hidden="true" />
                          OFFLINE
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatearFechaTabla(t.fechaRecepcion)}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{t.productorNombre}</p>
                      <p className="text-[11px] text-slate-500">
                        {t.variedad || VARIEDAD_UNICA}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatearKilos(t.pesoBruto)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-rose-600">
                      -{formatearKilos(t.pesoTara)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 font-mono font-black text-emerald-900">
                        {formatearKilos(t.pesoNeto)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <p className="font-mono text-[11px] text-slate-500">
                        {moneda(t.precioKg)}/kg
                      </p>
                      <p className="font-mono font-black">{moneda(t.total)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Imprimir directo"
                          aria-label={`Imprimir directo ${etiquetaBoleta(t)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            imprimirBoleta(t);
                          }}
                          className="h-8 w-8 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          <Printer className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Ver ticket"
                          aria-label={`Ver ticket ${etiquetaBoleta(t)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreview(t);
                          }}
                          className="h-8 w-8 text-slate-600 hover:bg-slate-100"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Compartir por WhatsApp"
                          aria-label={`Compartir por WhatsApp ${etiquetaBoleta(t)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void compartirBoleta(t);
                          }}
                          className="h-8 w-8 text-sky-700 hover:bg-sky-50"
                        >
                          <Share2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size={armado ? "sm" : "icon"}
                          title={armado ? "Clic de nuevo para confirmar" : "Eliminar boleta"}
                          aria-label={
                            armado
                              ? `Confirmar eliminación de ${etiquetaBoleta(t)}`
                              : `Eliminar boleta ${etiquetaBoleta(t)}`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            pedirEliminar(t);
                          }}
                          className={
                            armado
                              ? "h-8 bg-rose-600 px-2 text-xs font-bold text-white hover:bg-rose-700 hover:text-white"
                              : "h-8 w-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          }
                        >
                          {armado ? (
                            "¿Confirmar?"
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(cargandoTickets || cargandoOffline) && combinados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Cargando tickets…
                  </td>
                </tr>
              )}
              {!cargandoTickets && !cargandoOffline && combinados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    Sin tickets registrados. Crea la primera boleta.
                  </td>
                </tr>
              )}
              {!cargandoTickets &&
                !cargandoOffline &&
                combinados.length > 0 &&
                filtrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      Sin resultados para “{busqueda.trim()}”.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
          </div>
        </section>

        {ticketMostrado && (
          <TicketBascula ticket={ticketMostrado} onImprimir={imprimir} />
        )}
      </div>

      {preview && (
        <ThermalReceiptPreview
          open
          onClose={() => setPreview(null)}
          ticket={ticketRecienteABoleta(preview)}
          onImprimir={imprimirPreview}
        />
      )}

      <RecepcionModal
        open={boletaAbierta}
        onClose={() => setBoletaAbierta(false)}
        productores={productoresOpciones}
        folioPreview={folioOficialPreview ?? ""}
        operadorSugerido={operadorSugerido}
        onRequestNuevoProductor={() => setDialogoProductor(true)}
        productorIdSugerido={productorSugeridoBoleta}
        onSave={guardarBoleta}
        isSaving={guardando}
      />
      <NuevoProductorDialog
        open={dialogoProductor}
        onOpenChange={setDialogoProductor}
        hideTrigger
        onProductorCreated={(id) => setProductorSugeridoBoleta(id)}
      />
    </MainLayout>
  );
}
