import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Factory,
  Loader2,
  Printer,
  ReceiptText,
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
  moneda,
  nombreDesdeEmail,
  VARIEDAD_UNICA,
} from "@/lib/recepcion/calculos";
import {
  TicketBascula,
  type TicketRecepcion,
} from "@/components/recepcion/TicketBascula";
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

const formatearFechaCorta = (fechaISO: string): string =>
  new Date(fechaISO).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
  statusUrl: `${window.location.origin}/lotes/${t.id}`,
  borrador: false,
});

const claseEstadoCalidad = (estado: string | null): string => {
  switch ((estado ?? "").toLowerCase()) {
    case "aceptado":
      return "bg-emerald-100 text-emerald-800";
    case "observado":
      return "bg-amber-100 text-amber-800";
    case "rechazado":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

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

  const { productores } = useProductores();

  const {
    guardarRecepcion,
    loading: guardando,
    aviso,
    limpiarAviso,
  } = useRecepcion();

  const { data: folioOficialPreview } = useFolioRecepcionPreview();
  const { tickets, loading: cargandoTickets } = useTicketsRecientes(LIMITE_TICKETS);

  // Selecciona el más reciente al cargar para mostrar su detalle.
  useEffect(() => {
    if (!cargandoTickets && ticketSelId === null && tickets.length > 0) {
      setTicketSelId(tickets[0].id);
    }
  }, [cargandoTickets, ticketSelId, tickets]);

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
      try {
        const res = await guardarRecepcion(payloadADatosRecepcion(payload));
        const nombreProductor =
          productores.find((p) => p.id === payload.productorId)?.nombre ??
          "SIN ASIGNAR";
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
          statusUrl: `${window.location.origin}/lotes/${res.id}`,
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
        toast.error("No se pudo registrar la boleta", {
          description:
            error instanceof Error ? error.message : "Intenta nuevamente",
        });
      }
    },
    [guardarRecepcion, productores, folioOficialPreview, queryClient]
  );

  const imprimir = useCallback(() => {
    window.print();
  }, []);

  // Imprime sólo cuando el ticket guardado ya está en el DOM.
  useEffect(() => {
    if (!pendienteImpresion || !resultado) return;
    setPendienteImpresion(false);
    const id = window.setTimeout(() => window.print(), 150);
    return () => window.clearTimeout(id);
  }, [pendienteImpresion, resultado]);

  const nuevaRecepcion = useCallback(() => {
    setResultado(null);
    setBoletaAbierta(true);
  }, []);

  const ticketSeleccionado = tickets.find((t) => t.id === ticketSelId) ?? null;
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

        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-black text-slate-900">
              Últimos tickets
            </h2>
            <p className="text-xs text-slate-500">
              Selecciona un ticket para ver su detalle e imprimirlo.
            </p>
          </div>
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2">Productor</th>
                <th className="px-3 py-2 text-right">Kilos netos</th>
                <th className="px-3 py-2 text-right">Precio/kg</th>
                <th className="px-3 py-2 text-right">Total neto</th>
                <th className="px-3 py-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const seleccionado = t.id === ticketSelId;
                return (
                  <tr
                    key={t.id}
                    onClick={() => {
                      setResultado(null);
                      setTicketSelId(t.id);
                    }}
                    className={`cursor-pointer border-t border-slate-100 ${seleccionado ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatearFechaCorta(t.fechaRecepcion)}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-mono font-bold">
                        {t.folioRecepcion || t.numeroLote}
                      </p>
                      {t.folioFisico && (
                        <p className="font-mono text-[11px] text-slate-500">
                          {t.folioFisico}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{t.productorNombre}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.pesoNeto.toLocaleString("es-MX")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {moneda(t.precioKg)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-black">
                      {moneda(t.total)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${claseEstadoCalidad(t.estadoCalidad)}`}
                      >
                        {t.estadoCalidad ?? "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {cargandoTickets && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Cargando tickets…
                  </td>
                </tr>
              )}
              {!cargandoTickets && tickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Sin tickets registrados. Crea la primera boleta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {ticketMostrado && (
          <TicketBascula ticket={ticketMostrado} onImprimir={imprimir} />
        )}
      </div>

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
