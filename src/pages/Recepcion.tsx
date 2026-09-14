import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Factory,
  Printer,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  moneda,
  obtenerDictamen,
  validarPasoRecepcion,
} from "@/lib/recepcion/calculos";
import { StepperRecepcion } from "@/components/recepcion/StepperRecepcion";
import { PasoOrigenTransporte } from "@/components/recepcion/PasoOrigenTransporte";
import { PasoPesaje } from "@/components/recepcion/PasoPesaje";
import { PasoCalidadComercial } from "@/components/recepcion/PasoCalidadComercial";
import { PasoRevision } from "@/components/recepcion/PasoRevision";
import { ResumenLiquidacionCard } from "@/components/recepcion/ResumenLiquidacionCard";
import { HistorialPreciosCard } from "@/components/recepcion/HistorialPreciosCard";
import {
  DestinoYChecklistCard,
  type ItemChecklist,
} from "@/components/recepcion/DestinoYChecklistCard";
import {
  TicketBascula,
  type TicketRecepcion,
} from "@/components/recepcion/TicketBascula";
import {
  crearEstadoInicial,
  PASO_CALIDAD,
  PASO_PESAJE,
  PASO_REVISION,
  TOTAL_PASOS,
  type PropsPasoRecepcion,
  type RecepcionFormState,
} from "@/components/recepcion/tipos";

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
  const [form, setForm] = useState<RecepcionFormState>(crearEstadoInicial);
  const [paso, setPaso] = useState(1);
  const [pasoMaximo, setPasoMaximo] = useState(1);
  const [cortadoresLote, setCortadoresLote] = useState<CortadorDelLote[]>([]);
  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null);
  /** Evita mostrar errores de validación antes de que el operador avance. */
  const [intentoAvanzar, setIntentoAvanzar] = useState(false);

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

  const { data: historial = {
    precios: [],
    ultimo: null,
    promedio: null,
    maximo: null,
    minimo: null,
    variacionPct: null,
    lotesRegistrados: 0,
  }, isFetching: cargandoHistorial } = useHistorialPreciosProductor(
    form.productorId
  );

  const { data: folioOficialPreview } = useFolioRecepcionPreview();
  const { data: folioDuplicado } = useFolioFisicoDuplicado(form.folioFisico);

  const esPropia = form.origen === "propia";
  const dictamen = obtenerDictamen(form.defectos);

  const calculo = useMemo(
    () =>
      calcularRecepcion({
        pesoBruto: aNumero(form.pesoBruto),
        taraVehiculo: aNumero(form.taraVehiculo),
        taraRejasKg: aNumero(form.taraRejasKg),
        precioKg: aNumero(form.precioKg),
        defectosPct: form.defectos,
        incluirBascula: form.incluirBascula,
        costoBascula: aNumero(form.costoBascula),
        basculaFormaPago: form.basculaFormaPago,
        incluirManiobra: form.incluirManiobra,
        cuotaManiobraKg: aNumero(form.cuotaManiobraKg),
        rejas: aNumero(form.rejas),
        segundaPesadaCapturada: aNumero(form.taraVehiculo) > 0,
        requiereHuerto: esPropia,
        huertoSeleccionado: Boolean(form.huertoId),
      }),
    [form, esPropia]
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

  const erroresPaso = useMemo(
    () =>
      validarPasoRecepcion({
        paso,
        origen: form.origen,
        folioFisico: form.folioFisico,
        productorId: form.productorId,
        huertoId: form.huertoId,
        variedad: form.variedad,
        pesoBruto: aNumero(form.pesoBruto),
        taraTotal: calculo.taraTotal,
        precioKg: aNumero(form.precioKg),
        dictamen,
      }),
    [paso, form, calculo.taraTotal, dictamen]
  );

  const itemsChecklist: ItemChecklist[] = useMemo(
    () => [
      {
        etiqueta: "Productor identificado",
        listo: Boolean(form.productorId),
        obligatorio: true,
      },
      {
        etiqueta: esPropia
          ? "Huerto de procedencia (cosecha propia)"
          : "Huerto de procedencia",
        listo: Boolean(form.huertoId),
        obligatorio: esPropia,
      },
      {
        etiqueta: "Variedad de la fruta",
        listo: Boolean(form.variedad),
        obligatorio: true,
      },
      {
        etiqueta: "Peso bruto de la 1ª pesada",
        listo: aNumero(form.pesoBruto) > 0,
        obligatorio: true,
      },
      {
        etiqueta: "Tara del vehículo (2ª pesada)",
        listo: aNumero(form.taraVehiculo) > 0,
        obligatorio: false,
      },
      {
        etiqueta: "Tara de rejas/tarimas",
        listo: aNumero(form.taraRejasKg) > 0,
        obligatorio: false,
      },
      {
        etiqueta: "Precio por kilo pactado",
        listo: aNumero(form.precioKg) > 0,
        obligatorio: !esPropia,
      },
      {
        etiqueta: "Transporte capturado (placas / chofer)",
        listo: Boolean(form.placas || form.chofer),
        obligatorio: false,
      },
      {
        etiqueta: "Dictamen de calidad válido",
        listo: dictamen !== "rechazado",
        obligatorio: true,
      },
    ],
    [form, esPropia, dictamen]
  );

  const registrarPrimeraPesada = useCallback(() => {
    setCampo("pesoBrutoAt", new Date().toISOString());
    toast.success("Primera pesada registrada", {
      description: "Camión cargado en la plataforma de báscula.",
    });
  }, [setCampo]);

  const registrarSegundaPesada = useCallback(() => {
    setCampo("pesoTaraAt", new Date().toISOString());
    toast.success("Segunda pesada registrada", {
      description: "Vehículo vacío: peso neto recalculado.",
    });
  }, [setCampo]);

  const irAPaso = useCallback(
    (destino: number) => {
      if (destino > paso) {
        if (erroresPaso.length > 0) {
          setIntentoAvanzar(true);
          toast.error("Faltan datos en este paso", {
            description: erroresPaso[0],
          });
          return;
        }
        if (destino > pasoMaximo) setPasoMaximo(destino);
      }
      setIntentoAvanzar(false);
      setPaso(destino);
    },
    [paso, pasoMaximo, erroresPaso]
  );

  const reiniciar = useCallback(() => {
    setForm(crearEstadoInicial());
    setCortadoresLote([]);
    setPaso(1);
    setPasoMaximo(1);
    setResultado(null);
    setIntentoAvanzar(false);
  }, []);

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
        productor: datos?.productorNombre ?? productorSeleccionado?.nombre ?? "SIN ASIGNAR",
        origen: esPropia ? "Cosecha propia" : "Compra externa",
        huerto: huertoSeleccionado?.nombre ?? "—",
        localidad: huertoSeleccionado?.ubicacion ?? "",
        variedad: form.variedad,
        chofer: form.chofer,
        placas: form.placas,
        rejas: form.rejas,
        pesoBruto: aNumero(form.pesoBruto),
        taraVehiculo: aNumero(form.taraVehiculo),
        taraRejas: aNumero(form.taraRejasKg),
        taraTotal: calculo.taraTotal,
        pesoNeto: datos?.pesoNeto ?? calculo.pesoNeto,
        kilosMerma: calculo.kilosMerma,
        defectosPct: form.defectos,
        precioKg: aNumero(form.precioKg),
        subtotal: calculo.subtotal,
        costoBascula: calculo.costoBascula,
        basculaFormaPago: form.basculaFormaPago,
        cuotaManiobra: calculo.cuotaManiobraTotal,
        total: datos?.total ?? calculo.totalLiquidar,
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

  const confirmar = useCallback(async () => {
    const bloqueantes = validarPasoRecepcion({
      paso: PASO_REVISION,
      origen: form.origen,
      folioFisico: form.folioFisico,
      productorId: form.productorId,
      huertoId: form.huertoId,
      variedad: form.variedad,
      pesoBruto: aNumero(form.pesoBruto),
      taraTotal: calculo.taraTotal,
      precioKg: aNumero(form.precioKg),
      dictamen,
    });

    const todos = [...bloqueantes, ...calculo.errores];

    if (todos.length > 0) {
      toast.error("No se puede registrar el lote", {
        description: todos[0],
      });
      return;
    }

    const ticket = construirTicket(false);

    try {
      const res = await guardarRecepcion({
        productor_id: form.productorId,
        huerto_id: form.huertoId || null,
        es_cosecha_propia: esPropia,
        origen: esPropia ? "interno" : "externo",
        peso_bruto: aNumero(form.pesoBruto),
        peso_tara: calculo.taraTotal,
        tara_rejas_kg: aNumero(form.taraRejasKg),
        precio_pactado_kg: aNumero(form.precioKg),
        precio_caja_cortador: aNumero(form.precioCajaCortador),
        zona_asignada: "linea_produccion",
        costo_bascula: form.incluirBascula ? aNumero(form.costoBascula) : 0,
        bascula_forma_pago: form.basculaFormaPago,
        cuota_maniobra_kg: form.incluirManiobra
          ? aNumero(form.cuotaManiobraKg)
          : 0,
        folio_fisico: form.folioFisico,
        variedad: form.variedad || null,
        chofer: form.chofer || null,
        placas: form.placas || null,
        rejas: form.rejas ? Math.trunc(aNumero(form.rejas)) : null,
        peso_bruto_at: form.pesoBrutoAt ?? new Date().toISOString(),
        peso_tara_at: form.pesoTaraAt,
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

      setForm(crearEstadoInicial());
      setCortadoresLote([]);
      setPaso(1);
      setPasoMaximo(1);

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
  }, [
    form,
    calculo,
    dictamen,
    esPropia,
    cortadoresLote,
    construirTicket,
    guardarRecepcion,
    queryClient,
  ]);

  const imprimir = useCallback(() => {
    window.print();
  }, []);

  const propsPaso: PropsPasoRecepcion = {
    form,
    setCampo,
    calculo,
    origen: form.origen,
    dictamen,
    productores,
    loadingProductores,
    errorProductores: Boolean(errorProductores),
    onProductorCreado: (productorId) => setCampo("productorId", productorId),
    huertos,
    cortadores,
    cortadoresLote,
    setCortadoresLote,
    historial,
    cargandoHistorial,
    folioOficialSugerido: folioOficialPreview ?? null,
    folioDuplicado: folioDuplicado ?? null,
    onRegistrarPrimeraPesada: registrarPrimeraPesada,
    onRegistrarSegundaPesada: registrarSegundaPesada,
    guardando,
    onConfirmar: confirmar,
    onReiniciar: reiniciar,
  };

  const ticketMostrado = resultado?.ticket ?? construirTicket(true);

  return (
    <MainLayout
      title="Recepción"
      subtitle="Entrada de fruta, doble pesada y liquidación al productor"
    >
      <div className="space-y-6">
        {/* Aviso de migración pendiente */}
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

        {/* Resultado del registro */}
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

        <StepperRecepcion
          pasoActual={paso}
          pasoMaximo={pasoMaximo}
          form={form}
          calculo={calculo}
          onIrAPaso={irAPaso}
        />

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Flujo del asistente */}
          <div className="space-y-4 lg:col-span-8">
            {paso === 1 && <PasoOrigenTransporte {...propsPaso} />}
            {paso === PASO_PESAJE && <PasoPesaje {...propsPaso} />}
            {paso === PASO_CALIDAD && <PasoCalidadComercial {...propsPaso} />}
            {paso === PASO_REVISION && <PasoRevision {...propsPaso} />}

            {paso < PASO_REVISION && (
              <div className="flex flex-col gap-3 sm:flex-row">
                {paso > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-12"
                    onClick={() => setPaso(paso - 1)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                    Atrás
                  </Button>
                )}
                <Button
                  type="button"
                  size="lg"
                  className="h-12 flex-1"
                  onClick={() => irAPaso(paso + 1)}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}

            {erroresPaso.length > 0 && intentoAvanzar && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle
                  className="mr-1 inline h-4 w-4"
                  aria-hidden="true"
                />
                {erroresPaso[0]}
              </p>
            )}
          </div>

          {/* Panel lateral */}
          <div className="space-y-6 lg:col-span-4">
            <ResumenLiquidacionCard
              form={form}
              calculo={calculo}
              dictamen={dictamen}
              origen={form.origen}
              folioOficial={folioOficialPreview ?? null}
              pasoActual={paso}
              totalPasos={TOTAL_PASOS}
              guardando={guardando}
              onConfirmar={confirmar}
            />

            <DestinoYChecklistCard items={itemsChecklist} />

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
