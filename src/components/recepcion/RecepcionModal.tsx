import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Plus,
  Printer,
  Scale,
  X,
} from "lucide-react";
import {
  CUOTA_BASCULA_DEFAULT,
  TARIFA_MANIOBRA_DEFAULT,
  calcularAnticipoRecepcion,
  calcularResumenRecepcion,
  formatoKilos,
  formatoPesos,
  parseNumero,
  validarBoletaRecepcion,
  type ErrorValidacionRecepcion,
  type TipoPagoRecepcion,
} from "../../lib/recepcion/calculos";
import { ConfirmationModal, type AccionConfirmacion } from "./ConfirmationModal";
import { ThermalTicket } from "./ThermalTicket";
import {
  ESTADO_INICIAL_RECEPCION,
  type ProductorOption,
  type RecepcionFormState,
  type RecepcionPayload,
} from "./types";

interface RecepcionModalProps {
  open: boolean;
  onClose: () => void;
  productores: ProductorOption[];
  /** Folio oficial consecutivo (vista previa vía siguiente_folio_recepcion). */
  folioPreview?: string;
  cuotaBasculaDefault?: number;
  tarifaManiobraDefault?: number;
  operadorSugerido?: string;
  /** Abre el alta de productor como modal superior sin perder captura. */
  onRequestNuevoProductor?: () => void;
  /** Id de productor recién creado: se selecciona sin tocar lo demás. */
  productorIdSugerido?: string;
  onSave: (payload: RecepcionPayload, opts: { imprimir: boolean }) => void | Promise<void>;
  isSaving?: boolean;
}

const inputBase =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

/**
 * Nueva Boleta de Recepción & Pesaje.
 * Pantalla dividida: captura a la izquierda (7/12), ticket térmico
 * en vivo a la derecha (5/12). Guardado en dos pasos con confirmación.
 */
export function RecepcionModal({
  open,
  onClose,
  productores,
  folioPreview = "",
  cuotaBasculaDefault = CUOTA_BASCULA_DEFAULT,
  tarifaManiobraDefault = TARIFA_MANIOBRA_DEFAULT,
  operadorSugerido = "",
  onRequestNuevoProductor,
  productorIdSugerido,
  onSave,
  isSaving = false,
}: RecepcionModalProps) {
  const [form, setForm] = useState<RecepcionFormState>(() => ({
    ...ESTADO_INICIAL_RECEPCION,
    cuotaBascula: String(cuotaBasculaDefault),
    tarifaManiobraKg: String(tarifaManiobraDefault),
    operadorBascula: operadorSugerido,
  }));
  const [confirmacion, setConfirmacion] = useState<{
    accion: AccionConfirmacion;
    errores: ErrorValidacionRecepcion[];
  } | null>(null);

  // Boleta nueva en cada apertura; el alta de productor (modal superior)
  // no toca `open`, así que la captura en curso se conserva.
  useEffect(() => {
    if (open) {
      setForm({
        ...ESTADO_INICIAL_RECEPCION,
        cuotaBascula: String(cuotaBasculaDefault),
        tarifaManiobraKg: String(tarifaManiobraDefault),
        operadorBascula: operadorSugerido,
      });
      setConfirmacion(null);
    }
  }, [open, cuotaBasculaDefault, tarifaManiobraDefault, operadorSugerido]);

  // Selecciona al productor recién creado sin perder la captura.
  useEffect(() => {
    if (open && productorIdSugerido) {
      setForm((f) =>
        f.productorId === productorIdSugerido ? f : { ...f, productorId: productorIdSugerido },
      );
    }
  }, [open, productorIdSugerido]);

  const set = <K extends keyof RecepcionFormState>(k: K, v: RecepcionFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const numeros = useMemo(
    () => ({
      pesoBruto: parseNumero(form.pesoBruto),
      pesoTara: parseNumero(form.pesoTara),
      precioKg: parseNumero(form.precioKg),
      cuotaBascula: parseNumero(form.cuotaBascula),
      tarifaManiobraKg: parseNumero(form.tarifaManiobraKg),
    }),
    [form.pesoBruto, form.pesoTara, form.precioKg, form.cuotaBascula, form.tarifaManiobraKg],
  );

  const resumen = useMemo(
    () =>
      calcularResumenRecepcion({
        pesoBruto: numeros.pesoBruto,
        pesoTara: numeros.pesoTara,
        precioKg: numeros.precioKg,
        formaPagoBascula: form.formaPagoBascula,
        cuotaBascula: numeros.cuotaBascula,
        tarifaManiobraKg: numeros.tarifaManiobraKg,
      }),
    [numeros, form.formaPagoBascula],
  );

  const anticipo = useMemo(
    () =>
      calcularAnticipoRecepcion({
        tipoPago: form.tipoPagoRecepcion,
        montoAnticipo: parseNumero(form.montoAnticipo),
        totalEstimado: resumen.totalLiquidar,
      }),
    [form.tipoPagoRecepcion, form.montoAnticipo, resumen.totalLiquidar],
  );

  const productor = productores.find((p) => p.id === form.productorId) ?? null;

  if (!open) return null;

  const iniciarAccion = (accion: AccionConfirmacion) => {
    const errores = validarBoletaRecepcion({
      productorId: form.productorId,
      folioBascula: form.folioBascula,
      pesoBruto: numeros.pesoBruto,
      pesoTara: numeros.pesoTara,
      precioKg: numeros.precioKg,
      tipoPago: form.tipoPagoRecepcion,
      montoAnticipo: parseNumero(form.montoAnticipo),
      totalEstimado: resumen.totalLiquidar,
    });
    setConfirmacion({ accion, errores });
  };

  const confirmar = async () => {
    if (!confirmacion || confirmacion.errores.length > 0) return;
    const payload: RecepcionPayload = {
      productorId: form.productorId,
      folioBascula: form.folioBascula.trim(),
      pesoBruto: numeros.pesoBruto,
      pesoTara: numeros.pesoTara,
      precioKg: numeros.precioKg,
      formaPagoBascula: form.formaPagoBascula,
      cuotaBascula: numeros.cuotaBascula,
      tarifaManiobraKg: numeros.tarifaManiobraKg,
      conceptoManiobra: form.conceptoManiobra.trim(),
      operadorBascula: form.operadorBascula.trim(),
      tipoPagoRecepcion: form.tipoPagoRecepcion,
      anticipos: anticipo.anticipos,
      resumen,
    };
    await onSave(payload, { imprimir: confirmacion.accion === "imprimir" });
    setConfirmacion(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Nueva Boleta de Recepción y Pesaje"
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-slate-100 shadow-2xl">
        {/* Encabezado corporativo */}
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-slate-900 px-6 py-4">
          <span className="rounded-xl bg-emerald-600 p-2">
            <Scale className="h-6 w-6 text-white" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-black text-white">
              Nueva Boleta de Recepción &amp; Pesaje
            </h2>
            <p className="text-xs text-slate-400">
              Emisión de ticket oficial con folio para JBM Cítricos Barragán
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:p-6">
          {/* Columna izquierda: captura (7/12) */}
          <div className="space-y-4 lg:col-span-7">
            {/* B. Productor y folio físico */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-black tracking-wide text-slate-500 uppercase">
                Productor y folio de báscula
              </h3>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="recepcion-productor" className="mb-1 block text-sm font-bold text-slate-700">
                    Productor / Proveedor
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="recepcion-productor"
                      value={form.productorId}
                      onChange={(e) => set("productorId", e.target.value)}
                      className={`${inputBase} flex-1`}
                    >
                      <option value="">Seleccionar productor…</option>
                      {productores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                          {p.localidad ? ` — ${p.localidad}` : ""}
                        </option>
                      ))}
                    </select>
                    {onRequestNuevoProductor && (
                      <button
                        type="button"
                        onClick={onRequestNuevoProductor}
                        className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
                      >
                        <Plus className="h-4 w-4" /> Nuevo
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="recepcion-folio" className="mb-1 block text-sm font-bold text-slate-700">
                    No. Folio Ticket Báscula
                  </label>
                  <input
                    id="recepcion-folio"
                    value={form.folioBascula}
                    onChange={(e) => set("folioBascula", e.target.value)}
                    placeholder="BAS-10492"
                    autoComplete="off"
                    className={`${inputBase} border-amber-300 font-mono focus:border-amber-500 focus:ring-amber-100`}
                  />
                </div>
              </div>
            </section>

            {/* D. Pesaje camionero */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-black tracking-wide text-slate-500 uppercase">
                Pesaje camionero (báscula de plataforma)
              </h3>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="recepcion-bruto" className="mb-1 block text-sm font-bold text-slate-700">
                    Bruto (kg)
                  </label>
                  <input
                    id="recepcion-bruto"
                    inputMode="decimal"
                    value={form.pesoBruto}
                    onChange={(e) => set("pesoBruto", e.target.value)}
                    placeholder="0"
                    autoComplete="off"
                    className={`${inputBase} font-mono text-base font-black`}
                  />
                </div>
                <div>
                  <label htmlFor="recepcion-tara" className="mb-1 block text-sm font-bold text-slate-700">
                    Tara (kg)
                  </label>
                  <input
                    id="recepcion-tara"
                    inputMode="decimal"
                    value={form.pesoTara}
                    onChange={(e) => set("pesoTara", e.target.value)}
                    placeholder="0"
                    autoComplete="off"
                    className={`${inputBase} font-mono text-base font-black text-rose-600`}
                  />
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-sm font-bold text-emerald-800">Neto (kg)</p>
                  <p className="font-mono text-base font-black text-emerald-900">
                    {formatoKilos(Math.max(0, resumen.pesoNeto))}
                  </p>
                </div>
              </div>
            </section>

            {/* E. Cotización, cuota y maniobra */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-black tracking-wide text-slate-500 uppercase">
                Cotización, cuota de báscula y maniobra
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recepcion-precio" className="mb-1 block text-sm font-bold text-slate-700">
                    Precio por Kilo ($/kg)
                  </label>
                  <input
                    id="recepcion-precio"
                    inputMode="decimal"
                    value={form.precioKg}
                    onChange={(e) => set("precioKg", e.target.value)}
                    placeholder="0.00"
                    autoComplete="off"
                    className={`${inputBase} font-mono font-bold`}
                  />
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-2">
                  <p className="text-sm font-bold text-slate-600">Subtotal Fruta</p>
                  <p className="font-mono text-base font-black text-slate-900">
                    {formatoPesos(resumen.subtotalFruta)}
                  </p>
                </div>
              </div>

              <p className="mt-4 mb-1 text-sm font-bold text-slate-700">
                Cuota de Báscula
              </p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de cobro de báscula">
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.formaPagoBascula === "liquidacion"}
                  onClick={() => set("formaPagoBascula", "liquidacion")}
                  className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-bold ${
                    form.formaPagoBascula === "liquidacion"
                      ? "border-rose-400 bg-rose-50 text-rose-800"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                >
                  Descontar de liquidación
                  <span className="block font-mono">
                    -{formatoPesos(numeros.cuotaBascula)}
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.formaPagoBascula === "efectivo"}
                  onClick={() => set("formaPagoBascula", "efectivo")}
                  className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-bold ${
                    form.formaPagoBascula === "efectivo"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                >
                  Pagado en efectivo
                  <span className="block font-mono">{formatoPesos(0)}</span>
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recepcion-maniobra" className="mb-1 block text-sm font-bold text-slate-700">
                    Maniobra ($/kg)
                  </label>
                  <input
                    id="recepcion-maniobra"
                    inputMode="decimal"
                    value={form.tarifaManiobraKg}
                    onChange={(e) => set("tarifaManiobraKg", e.target.value)}
                    autoComplete="off"
                    className={`${inputBase} font-mono font-bold`}
                  />
                </div>
                <div>
                  <label htmlFor="recepcion-concepto" className="mb-1 block text-sm font-bold text-slate-700">
                    Concepto del cargo
                  </label>
                  <input
                    id="recepcion-concepto"
                    value={form.conceptoManiobra}
                    onChange={(e) => set("conceptoManiobra", e.target.value)}
                    autoComplete="off"
                    className={inputBase}
                  />
                </div>
              </div>
              <div className="mt-3">
                <label htmlFor="recepcion-operador" className="mb-1 block text-sm font-bold text-slate-700">
                  Operador de báscula
                </label>
                <input
                  id="recepcion-operador"
                  value={form.operadorBascula}
                  onChange={(e) => set("operadorBascula", e.target.value)}
                  autoComplete="off"
                  className={inputBase}
                />
              </div>

              {/* Desglose matemático */}
              <dl className="mt-4 space-y-1 rounded-xl bg-slate-50 px-3 py-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">(+) Fruta (netos × $/kg)</dt>
                  <dd className="font-mono font-bold text-slate-900">
                    {formatoPesos(resumen.subtotalFruta)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">(-) Tarifa de Báscula</dt>
                  <dd className="font-mono font-bold text-rose-600">
                    -{formatoPesos(resumen.descuentoBascula)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">(-) Cargo Operativo de Maniobra</dt>
                  <dd className="font-mono font-bold text-rose-600">
                    -{formatoPesos(resumen.cargoManiobraTotal)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <dt className="text-slate-600">Precio Neto Efectivo Real /kg</dt>
                  <dd className="font-mono font-bold text-slate-900">
                    {formatoPesos(resumen.precioNetoEfectivo)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 rounded-xl bg-slate-900 px-4 py-3 text-center">
                <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  Total Neto a Liquidar
                </p>
                <p className="font-mono text-2xl font-black text-amber-400">
                  {formatoPesos(resumen.totalLiquidar)}
                </p>
              </div>
            </section>

            {/* F. Pago al productor en recepción */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-black tracking-wide text-slate-500 uppercase">
                Pago al productor en recepción
              </h3>
              <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de pago en recepción">
                {(
                  [
                    { id: "pendiente", titulo: "Pendiente de pago", detalle: "Se liquida después" },
                    { id: "anticipo", titulo: "Anticipo", detalle: "Pago parcial en mano" },
                    { id: "total", titulo: "Pago total", detalle: formatoPesos(Math.max(0, resumen.totalLiquidar)) },
                  ] as { id: TipoPagoRecepcion; titulo: string; detalle: string }[]
                ).map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    role="radio"
                    aria-checked={form.tipoPagoRecepcion === op.id}
                    onClick={() => set("tipoPagoRecepcion", op.id)}
                    className={`rounded-xl border-2 px-2 py-2 text-left text-sm font-bold ${
                      form.tipoPagoRecepcion === op.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {op.titulo}
                    <span className="block text-xs font-medium opacity-80">{op.detalle}</span>
                  </button>
                ))}
              </div>
              {form.tipoPagoRecepcion === "anticipo" && (
                <div className="mt-3">
                  <label htmlFor="recepcion-anticipo" className="mb-1 block text-sm font-bold text-slate-700">
                    Monto del anticipo ($)
                  </label>
                  <input
                    id="recepcion-anticipo"
                    inputMode="decimal"
                    value={form.montoAnticipo}
                    onChange={(e) => set("montoAnticipo", e.target.value)}
                    placeholder="0.00"
                    autoComplete="off"
                    className={`${inputBase} font-mono text-base font-black`}
                  />
                </div>
              )}
              {form.tipoPagoRecepcion !== "pendiente" && (
                <dl className="mt-3 space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Anticipo registrado</dt>
                    <dd className="font-mono font-bold text-slate-900">
                      {formatoPesos(anticipo.anticipos)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Remanente estimado a liquidar</dt>
                    <dd className="font-mono font-bold text-emerald-700">
                      {formatoPesos(anticipo.remanenteEstimado)}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            {/* H. Botonera */}
            <section className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => iniciarAccion("imprimir")}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                <Printer className="h-4 w-4 text-amber-400" />
                Guardar e Imprimir Directo
              </button>
              <button
                type="button"
                onClick={() => iniciarAccion("guardar")}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Guardar Boleta
              </button>
            </section>
          </div>

          {/* Columna derecha: ticket en vivo (5/12) */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <ThermalTicket
                isLivePreview={true}
                datos={{
                  folioOficial: folioPreview,
                  folioBascula: form.folioBascula.trim(),
                  fecha: new Date(),
                  productorNombre: productor?.nombre ?? "",
                  productorLocalidad: productor?.localidad,
                  pesoBruto: numeros.pesoBruto,
                  pesoTara: numeros.pesoTara,
                  precioKg: numeros.precioKg,
                  cuotaBascula: numeros.cuotaBascula,
                  formaPagoBascula: form.formaPagoBascula,
                  tarifaManiobraKg: numeros.tarifaManiobraKg,
                  conceptoManiobra: form.conceptoManiobra.trim(),
                  operadorBascula: form.operadorBascula.trim(),
                  tipoPago: form.tipoPagoRecepcion,
                  anticipos: anticipo.anticipos,
                  remanenteEstimado: anticipo.remanenteEstimado,
                  resumen,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={confirmacion !== null}
        accion={confirmacion?.accion ?? "guardar"}
        pesoNeto={Math.max(0, resumen.pesoNeto)}
        totalLiquidar={resumen.totalLiquidar}
        anticipos={anticipo.anticipos}
        remanenteEstimado={anticipo.remanenteEstimado}
        errores={confirmacion?.errores ?? []}
        isSaving={isSaving}
        onConfirm={confirmar}
        onBack={() => setConfirmacion(null)}
      />
    </div>
  );
}
