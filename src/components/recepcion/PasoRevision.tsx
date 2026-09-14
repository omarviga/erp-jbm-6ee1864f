import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { kilos, moneda, PORCENTAJE_CORTADOR } from "@/lib/recepcion/calculos";
import type { PropsPasoRecepcion } from "./tipos";

interface DatoProps {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}

function Dato({ etiqueta, valor, destacado }: DatoProps) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd
        className={
          destacado
            ? "font-mono text-base font-bold text-emerald-700"
            : "text-sm font-medium text-slate-900"
        }
      >
        {valor}
      </dd>
    </div>
  );
}

export function PasoRevision({
  form,
  calculo,
  dictamen,
  productores,
  huertos,
  cortadoresLote,
  guardando,
  onConfirmar,
  onReiniciar,
}: PropsPasoRecepcion) {
  const productor = productores.find((p) => p.id === form.productorId);
  const huerto = huertos.find((h) => h.id === form.huertoId);
  const esPropia = form.origen === "propia";
  const precioCaja = Number(form.precioCajaCortador) || 0;
  const totalCajas = cortadoresLote.reduce((acc, c) => acc + c.cajas, 0);
  const pagoCortadores = totalCajas * precioCaja * PORCENTAJE_CORTADOR;
  const bloqueado = calculo.errores.length > 0;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950">
              4
            </span>
            Revisión final del lote
          </CardTitle>
          <CardDescription>
            Confirma que los datos coincidan con la boleta física antes de
            registrar el ingreso a producción.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-2">
          {/* Bloqueantes y advertencias */}
          {bloqueado ? (
            <div className="space-y-2">
              {calculo.errores.map((error) => (
                <p
                  key={error}
                  className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Sin bloqueantes: el lote puede registrarse y quedará disponible en
              Producción de inmediato.
            </p>
          )}

          {calculo.advertencias.length > 0 && (
            <ul className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              {calculo.advertencias.map((advertencia) => (
                <li
                  key={advertencia}
                  className="flex items-start gap-2 text-sm text-amber-800"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {advertencia}
                </li>
              ))}
            </ul>
          )}

          {/* Origen */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Origen
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Dato
                etiqueta="Tipo de entrada"
                valor={esPropia ? "Cosecha propia" : "Compra a terceros"}
              />
              <Dato etiqueta="Productor" valor={productor?.nombre ?? "—"} />
              <Dato etiqueta="Huerto" valor={huerto?.nombre ?? "—"} />
              <Dato
                etiqueta="Localidad"
                valor={huerto?.ubicacion ?? "—"}
              />
              <Dato etiqueta="Variedad" valor={form.variedad || "—"} />
              <Dato etiqueta="Folio físico báscula" valor={form.folioFisico || "—"} />
              <Dato etiqueta="Chofer" valor={form.chofer || "—"} />
              <Dato etiqueta="Placas" valor={form.placas || "—"} />
            </dl>
          </section>

          <Separator />

          {/* Pesaje */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Doble pesada
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Dato
                etiqueta="Peso bruto"
                valor={kilos(Number(form.pesoBruto) || 0)}
              />
              <Dato
                etiqueta="Tara vehículo"
                valor={kilos(Number(form.taraVehiculo) || 0)}
              />
              <Dato
                etiqueta="Tara rejas/tarimas"
                valor={`${kilos(Number(form.taraRejasKg) || 0)}${
                  form.rejas ? ` (${form.rejas} rejas)` : ""
                }`}
              />
              <Dato
                etiqueta="Tara total"
                valor={kilos(calculo.taraTotal)}
              />
              <Dato
                etiqueta="Peso neto (base de pago)"
                valor={kilos(calculo.pesoNeto)}
                destacado
              />
              <Dato
                etiqueta="Merma informativa"
                valor={`${kilos(calculo.kilosMerma)} (${form.defectos}%)`}
              />
              <Dato
                etiqueta="1ª pesada"
                valor={
                  form.pesoBrutoAt
                    ? new Date(form.pesoBrutoAt).toLocaleString("es-MX")
                    : "Sin hora"
                }
              />
              <Dato
                etiqueta="2ª pesada"
                valor={
                  form.pesoTaraAt
                    ? new Date(form.pesoTaraAt).toLocaleString("es-MX")
                    : "Sin hora"
                }
              />
            </dl>
          </section>

          <Separator />

          {/* Comercial */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Liquidación
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Dato
                etiqueta="Dictamen de calidad"
                valor={`${dictamen.toUpperCase()} (${form.defectos}%)`}
              />
              <Dato
                etiqueta="Precio por kilo"
                valor={moneda(Number(form.precioKg) || 0)}
              />
              <Dato etiqueta="Subtotal fruta" valor={moneda(calculo.subtotal)} />
              <Dato
                etiqueta="Cuota de báscula"
                valor={
                  calculo.costoBascula > 0
                    ? `${moneda(calculo.costoBascula)} · ${
                        form.basculaFormaPago === "efectivo"
                          ? "efectivo"
                          : "descontada"
                      }`
                    : "No aplica"
                }
              />
              <Dato
                etiqueta="Cuota de maniobra"
                valor={moneda(calculo.cuotaManiobraTotal)}
              />
              <Dato
                etiqueta="Total de deducciones"
                valor={moneda(calculo.totalDeducciones)}
              />
              <Dato
                etiqueta="Total a liquidar"
                valor={moneda(calculo.totalLiquidar)}
                destacado
              />
              {esPropia && (
                <Dato
                  etiqueta="Pago a cortadores"
                  valor={`${moneda(pagoCortadores)} (${totalCajas} cajas)`}
                />
              )}
            </dl>
          </section>

          {form.notas && (
            <>
              <Separator />
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Notas
                </h3>
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {form.notas}
                </p>
              </section>
            </>
          )}

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              className="h-14 flex-1 bg-emerald-600 text-base font-bold hover:bg-emerald-700"
              onClick={onConfirmar}
              disabled={bloqueado || guardando}
            >
              {guardando ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                  Registrando ingreso...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" aria-hidden="true" />
                  Confirmar ingreso del lote
                </>
              )}
            </Button>

            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-14"
              onClick={onReiniciar}
              disabled={guardando}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reiniciar captura
            </Button>
          </div>

          {!bloqueado && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              Al confirmar se asigna el folio consecutivo oficial y se emite la
              boleta de recepción imprimible.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
