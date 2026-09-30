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
  Printer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProductores } from "@/hooks/useProductores";
import {
  useFolioFisicoDuplicado,
  useFolioRecepcionPreview,
  useHistorialPreciosProductor,
  useRecepcion,
  type CortadorDelLote,
} from "@/hooks/useRecepcion";
import {
  aNumero,
  calcularRecepcion,
  HISTORIAL_PRECIOS_VACIO,
  moneda,
  nombreDesdeEmail,
  obtenerDictamen,
  validarRecepcion,
  VARIEDAD_UNICA,
} from "@/lib/recepcion/calculos";
import { SeccionOrigen } from "@/components/recepcion/SeccionOrigen";
import { SeccionPesaje } from "@/components/recepcion/SeccionPesaje";
import { SeccionCalidad } from "@/components/recepcion/SeccionCalidad";
import { SeccionCortadores } from "@/components/recepcion/SeccionCortadores";
import { SeccionBascula } from "@/components/recepcion/SeccionBascula";
import { SeccionCargos } from "@/components/recepcion/SeccionCargos";
import { ResumenLiquidacion } from "@/components/recepcion/ResumenLiquidacion";
import { SeccionCierre } from "@/components/recepcion/SeccionCierre";
import { DestinoYChecklistCard } from "@/components/recepcion/DestinoYChecklistCard";
import { HistorialPreciosCard } from "@/components/recepcion/HistorialPreciosCard";
import {
  TicketBascula,
  type TicketRecepcion,
} from "@/components/recepcion/TicketBascula";
import {
  crearEstadoInicial,
  type ItemChecklist,
  type PropsSeccionRecepcion,
  type RecepcionFormState,
} from "@/components/recepcion/tipos";

const CLAVE_OPERADOR = "recepcion.operador_bascula";

const formatearFechaHora = (fecha: Date): string =>
  fecha.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

export default function Recepcion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const operadorSugerido = useMemo(() => {
    if (typeof localStorage === "undefined") return "";
    return (
      localStorage.getItem(CLAVE_OPERADOR) || nombreDesdeEmail(user?.email)
    );
  }, [user?.email]);

  const [form, setForm] = useState<RecepcionFormState>(() =>
    crearEstadoInicial(operadorSugerido)
  );
  const [cortadoresLote, setCortadoresLote] = useState<CortadorDelLote[]>([]);
  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null);
  const [pendienteImpresion, setPendienteImpresion] = useState(false);

  const {
    productores,
    loading: loadingProductores,
    error: errorProductores,
  } = useProductores();

  const {
    guardarRecepcion,
    huertos,
    cortadores,
    loading: guardando,
    aviso,
    limpiarAviso,
  } = useRecepcion();

  const { data: historial = HISTORIAL_PRECIOS_VACIO, isFetching: cargandoHistorial } =
    useHistorialPreciosProductor(form.productorId);

  const { data: folioOficialPreview } = useFolioRecepcionPreview();
  const { data: folioDuplicado } = useFolioFisicoDuplicado(form.folioFisico);

  const esPropia = form.origen === "propia";
  const dictamen = obtenerDictamen(form.defectos);

  const calculo = useMemo(
    () =>
      calcularRecepcion({
        pesoBruto: aNumero(form.pesoBruto),
        taraVehiculo: aNumero(form.taraVehiculo),
        precioKg: aNumero(form.precioKg),
        defectosPct: form.defectos,
        incluirBascula: aNumero(form.costoBascula) > 0,
        costoBascula: aNumero(form.costoBascula),
        basculaFormaPago: form.basculaFormaPago,
        incluirManiobra: aNumero(form.cuotaManiobraKg) > 0,
        cuotaManiobraKg: aNumero(form.cuotaManiobraKg),
      }),
    [form]
  );

  const huertoSeleccionado = useMemo(
    () => huertos.find((h) => h.id === form.huertoId),
    [huertos, form.huertoId]
  );

  const productorSeleccionado = useMemo(
    () => productores.find((p) => p.id === form.productorId),
    [productores, form.productorId]
  );

  const setCampo = useCallback(
    <K extends keyof RecepcionFormState>(
      campo: K,
      valor: RecepcionFormState[K]
    ) => {
      setForm((prev) => ({ ...prev, [campo]: valor }));
      // Al empezar a capturar de nuevo, el ticket vuelve a modo borrador.
      setResultado((prev) => (prev ? null : prev));
    },
    []
  );

  // Sugiere el operador cuando la sesión o el almacenamiento lo aportan.
  useEffect(() => {
    if (!form.operadorBascula && operadorSugerido) {
      setForm((prev) =>
        prev.operadorBascula ? prev : { ...prev, operadorBascula: operadorSugerido }
      );
    }
  }, [operadorSugerido, form.operadorBascula]);

  const errores = useMemo(
    () =>
      validarRecepcion({
        origen: form.origen,
        productorId: form.productorId,
        huertoId: form.huertoId,
        pesoBruto: aNumero(form.pesoBruto),
        taraTotal: calculo.taraTotal,
        precioKg: aNumero(form.precioKg),
        operadorBascula: form.operadorBascula,
        dictamen,
      }),
    [form, calculo.taraTotal, dictamen]
  );

  const itemsChecklist: ItemChecklist[] = useMemo(
    () => [
      {
        etiqueta: "Productor identificado",
        listo: Boolean(form.productorId),
        obligatorio: true,
      },
      {
        etiqueta: "Huerto de procedencia (cosecha propia)",
        listo: Boolean(form.huertoId),
        obligatorio: esPropia,
      },
      {
        etiqueta: "Peso bruto de la 1ª pesada",
        listo: aNumero(form.pesoBruto) > 0,
        obligatorio: true,
      },
      {
        etiqueta: "Tara del vehículo (2ª pesada)",
        listo: aNumero(form.taraVehiculo) > 0,
        obligatorio: true,
      },
      {
        etiqueta: "Precio por kilo pactado",
        listo: aNumero(form.precioKg) > 0,
        obligatorio: !esPropia,
      },
      {
        etiqueta: "Operador de báscula",
        listo: Boolean(form.operadorBascula.trim()),
        obligatorio: true,
      },
      {
        etiqueta: "Dictamen de calidad válido",
        listo: dictamen !== "rechazado",
        obligatorio: true,
      },
    ],
    [form, esPropia, dictamen]
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

  const construirTicket = useCallback(
    (
      borrador: boolean,
      datos?: {
        folioRecepcion: string | null;
        numeroLote: string;
        pesoNeto: number;
        total: number;
        productorNombre: string;
        loteId?: string;
      }
    ): TicketRecepcion => {
      const folio = datos?.folioRecepcion ?? folioOficialPreview ?? "";
      const statusUrl = datos?.loteId
        ? `${window.location.origin}/lotes/${datos.loteId}`
        : `${window.location.origin}/status/${encodeURIComponent(
            folio || "nuevo"
          )}`;

      return {
        folioOficial: folio,
        folioFisico: form.folioFisico,
        numeroLote: datos?.numeroLote ?? "",
        productor:
          datos?.productorNombre ?? productorSeleccionado?.nombre ?? "SIN ASIGNAR",
        origen: esPropia ? "Cosecha propia" : "Compra externa",
        huerto: huertoSeleccionado?.nombre ?? "—",
        localidad: huertoSeleccionado?.ubicacion ?? "",
        variedad: VARIEDAD_UNICA,
        operador: form.operadorBascula,
        pesoBruto: aNumero(form.pesoBruto),
        tara: calculo.taraTotal,
        pesoNeto: datos?.pesoNeto ?? calculo.pesoNeto,
        kilosMerma: calculo.kilosMerma,
        defectosPct: form.defectos,
        precioKg: aNumero(form.precioKg),
        subtotal: calculo.subtotal,
        costoBascula: calculo.costoBascula,
        basculaFormaPago: form.basculaFormaPago,
        cuotaManiobraKg: aNumero(form.cuotaManiobraKg),
        cuotaManiobraConcepto: form.cuotaManiobraConcepto,
        cuotaManiobra: calculo.cuotaManiobraTotal,
        totalDeducciones: calculo.totalDeducciones,
        total: datos?.total ?? calculo.totalLiquidar,
        precioNetoEfectivo: calculo.precioNetoEfectivo,
        fecha: formatearFechaHora(new Date()),
        statusUrl,
        borrador,
      };
    },
    [
      form,
      calculo,
      folioOficialPreview,
      productorSeleccionado,
      huertoSeleccionado,
      esPropia,
    ]
  );

  const guardar = useCallback(
    async (imprimirAlGuardar: boolean) => {
      if (errores.length > 0) {
        toast.error("No se puede guardar la recepción", {
          description: errores[0],
        });
        return;
      }

      const ticket = construirTicket(false);

      try {
        const res = await guardarRecepcion({
          productor_id: form.productorId,
          huerto_id: esPropia ? form.huertoId || null : null,
          es_cosecha_propia: esPropia,
          origen: esPropia ? "interno" : "externo",
          peso_bruto: aNumero(form.pesoBruto),
          peso_tara: calculo.taraTotal,
          precio_pactado_kg: aNumero(form.precioKg),
          precio_caja_cortador: aNumero(form.precioCajaCortador),
          zona_asignada: "linea_produccion",
          costo_bascula: aNumero(form.costoBascula),
          bascula_forma_pago: form.basculaFormaPago,
          cuota_maniobra_kg: aNumero(form.cuotaManiobraKg),
          cuota_maniobra_concepto: form.cuotaManiobraConcepto,
          operador_bascula: form.operadorBascula.trim(),
          folio_fisico: form.folioFisico,
          variedad: VARIEDAD_UNICA,
          calidad_defectos: form.defectos,
          estado_calidad: dictamen,
          notas: form.notas,
          cortadores: esPropia ? cortadoresLote : [],
        });

        const ticketFinal: TicketRecepcion = {
          ...ticket,
          folioOficial: res.folio_recepcion ?? ticket.folioOficial,
          numeroLote: res.numero_lote,
          pesoNeto: res.peso_neto,
          total: res.total_liquidar,
          productor: res.productor_nombre ?? ticket.productor,
          borrador: false,
        };

        if (typeof localStorage !== "undefined" && form.operadorBascula.trim()) {
          localStorage.setItem(CLAVE_OPERADOR, form.operadorBascula.trim());
        }

        setResultado({
          loteId: res.id,
          numeroLote: res.numero_lote,
          folioRecepcion: res.folio_recepcion,
          pesoNeto: res.peso_neto,
          total: res.total_liquidar,
          productorNombre: ticketFinal.productor,
          ticket: ticketFinal,
          viaRespaldo: res.viaRespaldo,
        });

        // Deja el lote listo para producción y refresca los catálogos.
        queryClient.invalidateQueries({ queryKey: ["lotes"] });
        queryClient.invalidateQueries({ queryKey: ["productores"] });
        queryClient.invalidateQueries({ queryKey: ["recepcion"] });

        if (imprimirAlGuardar) setPendienteImpresion(true);

        setForm(crearEstadoInicial(form.operadorBascula.trim()));
        setCortadoresLote([]);

        toast.success(`Lote ${res.numero_lote} recibido`, {
          description: `Folio ${res.folio_recepcion ?? "sin folio"} · ${res.peso_neto.toLocaleString(
            "es-MX"
          )} kg netos · ${moneda(res.total_liquidar)}`,
        });
      } catch (error) {
        toast.error("No se pudo registrar la recepción", {
          description:
            error instanceof Error ? error.message : "Intenta nuevamente",
        });
      }
    },
    [
      errores,
      form,
      calculo.taraTotal,
      esPropia,
      dictamen,
      cortadoresLote,
      construirTicket,
      guardarRecepcion,
      queryClient,
    ]
  );

  const reiniciar = useCallback(() => {
    setForm(crearEstadoInicial(form.operadorBascula.trim()));
    setCortadoresLote([]);
    setResultado(null);
  }, [form.operadorBascula]);

  const propsSeccion: PropsSeccionRecepcion = {
    form,
    setCampo,
    calculo,
    dictamen,
    productores,
    loadingProductores,
    errorProductores: Boolean(errorProductores),
    onProductorCreado: (productorId) => setCampo("productorId", productorId),
    huertos,
    folioOficialSugerido: folioOficialPreview ?? null,
    folioDuplicado: folioDuplicado ?? null,
    cortadores,
    cortadoresLote,
    setCortadoresLote,
    historial,
    cargandoHistorial,
    guardando,
    onGuardarEImprimir: () => guardar(true),
    onGuardar: () => guardar(false),
  };

  const ticketMostrado = resultado?.ticket ?? construirTicket(true);

  return (
    <MainLayout
      title="Recepción"
      subtitle="Pesaje de báscula, liquidación al productor y boleta de entrada"
    >
      <div className="space-y-6">
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
                <Button variant="ghost" onClick={reiniciar}>
                  Nueva recepción
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <SeccionOrigen {...propsSeccion} />
            <SeccionPesaje {...propsSeccion} />
            <SeccionCalidad {...propsSeccion} />
            {esPropia && <SeccionCortadores {...propsSeccion} />}
            <SeccionBascula {...propsSeccion} />
            <SeccionCargos {...propsSeccion} />
            <ResumenLiquidacion {...propsSeccion} />
            <SeccionCierre {...propsSeccion} errores={errores} onReiniciar={reiniciar} />
          </div>

          <div className="space-y-6 lg:col-span-4">
            <DestinoYChecklistCard items={itemsChecklist} />

            {calculo.advertencias.length > 0 && (
              <Card className="rounded-2xl border border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Avisos del cálculo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {calculo.advertencias.map((advertencia) => (
                      <li
                        key={advertencia}
                        className="flex items-start gap-2 text-sm text-amber-800"
                      >
                        <AlertTriangle
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {advertencia}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <HistorialPreciosCard
              historial={historial}
              cargando={cargandoHistorial}
              productorNombre={productorSeleccionado?.nombre}
              onAplicarPrecio={(precio) => setCampo("precioKg", String(precio))}
            />
          </div>
        </div>

        <TicketBascula ticket={ticketMostrado} onImprimir={imprimir} />
      </div>
    </MainLayout>
  );
}
