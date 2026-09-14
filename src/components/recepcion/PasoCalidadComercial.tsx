import {
  Calculator,
  CheckCircle,
  DollarSign,
  Percent,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFECTOS_OBSERVADO,
  DEFECTOS_RECHAZADO,
  PORCENTAJE_CORTADOR,
  calcularPagoCortador,
  moneda,
} from "@/lib/recepcion/calculos";
import type { FormaPagoBascula } from "@/lib/recepcion/calculos";
import type { PropsPasoRecepcion } from "./tipos";

const ESTILOS_DICTAMEN: Record<string, string> = {
  aceptado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  observado: "border-amber-200 bg-amber-50 text-amber-700",
  rechazado: "border-rose-200 bg-rose-50 text-rose-700",
};

export function PasoCalidadComercial({
  form,
  setCampo,
  calculo,
  dictamen,
  cortadores,
  cortadoresLote,
  setCortadoresLote,
  historial,
}: PropsPasoRecepcion) {
  const esPropia = form.origen === "propia";
  const precioCaja = Number(form.precioCajaCortador) || 0;
  const totalCajas = cortadoresLote.reduce(
    (acc, c) => acc + (Number(c.cajas) || 0),
    0
  );
  const pagoCortadores = calcularPagoCortador(totalCajas, precioCaja);

  const agregarCortador = (id: string) => {
    const cortador = cortadores.find((c) => c.id === id);
    if (!cortador) return;
    if (cortadoresLote.some((c) => c.id === id)) return;
    setCortadoresLote([...cortadoresLote, { ...cortador, cajas: 0 }]);
  };

  const actualizarCajas = (id: string, cajas: number) => {
    setCortadoresLote(
      cortadoresLote.map((c) => (c.id === id ? { ...c, cajas } : c))
    );
  };

  const quitarCortador = (id: string) => {
    setCortadoresLote(cortadoresLote.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950">
              3
            </span>
            Calidad y parámetros comerciales
          </CardTitle>
          <CardDescription>
            Dictamen de calidad, precio pactado y deducciones operativas del
            lote.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Defectos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="defectos" className="font-semibold text-rose-600">
                <Percent className="mr-1 inline h-4 w-4" aria-hidden="true" />
                Porcentaje de defectos
              </Label>
              <span className="font-mono text-2xl font-bold text-rose-600">
                {form.defectos}%
              </span>
            </div>

            <Slider
              id="defectos"
              value={[form.defectos]}
              min={0}
              max={30}
              step={1}
              onValueChange={(valor) => setCampo("defectos", valor[0] ?? 0)}
              aria-label="Porcentaje de defectos"
            />

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% excelente</span>
              <span>{DEFECTOS_OBSERVADO}% observado</span>
              <span>{DEFECTOS_RECHAZADO}% rechazado</span>
              <span>30% máximo</span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between rounded-lg border-2 p-3",
                ESTILOS_DICTAMEN[dictamen]
              )}
              role="status"
            >
              <div>
                <p className="text-sm font-semibold">
                  Dictamen: {dictamen.toUpperCase()}
                </p>
                <p className="text-xs opacity-80">
                  {dictamen === "aceptado"
                    ? "Fruta en condiciones óptimas para selección."
                    : dictamen === "observado"
                      ? "Se guardará con observaciones para revisión en patio."
                      : "No cumple el mínimo: el lote no puede ingresar."}
                </p>
              </div>
              {dictamen === "aceptado" && (
                <CheckCircle className="h-7 w-7" aria-hidden="true" />
              )}
            </div>
          </div>

          {/* Precio */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="precio-kg" className="font-semibold">
                <DollarSign className="mr-1 inline h-4 w-4" aria-hidden="true" />
                {esPropia
                  ? "Costo por kilo (opcional, para costeo)"
                  : "Precio por kilo pactado *"}
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                  $
                </span>
                <Input
                  id="precio-kg"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={form.precioKg}
                  onChange={(e) => setCampo("precioKg", e.target.value)}
                  placeholder="0.00"
                  className="h-14 pl-9 text-center font-mono text-xl"
                />
              </div>
              {esPropia && (
                <p className="text-xs text-muted-foreground">
                  En cosecha propia no se paga al productor; este valor solo
                  alimenta el costeo de producción.
                </p>
              )}
            </div>

            {historial.ultimo !== null && (
              <div className="space-y-2">
                <Label className="font-semibold">Referencia histórica</Label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Último precio</span>
                    <button
                      type="button"
                      className="font-mono font-bold text-emerald-700 underline-offset-2 hover:underline"
                      onClick={() =>
                        setCampo("precioKg", String(historial.ultimo))
                      }
                    >
                      {moneda(historial.ultimo)} aplicarlo
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Promedio</span>
                    <span className="font-mono">
                      {moneda(historial.promedio ?? 0)}
                    </span>
                  </div>
                  {historial.variacionPct !== null && (
                    <p
                      className={cn(
                        "mt-2 flex items-center gap-1 text-xs font-medium",
                        historial.variacionPct >= 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      )}
                    >
                      {historial.variacionPct >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {historial.variacionPct >= 0 ? "+" : ""}
                      {historial.variacionPct}% vs. promedio de{" "}
                      {historial.lotesRegistrados} lote(s)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cuota de báscula */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Calculator className="h-4 w-4 text-blue-600" aria-hidden="true" />
                Cuota de báscula (servicio de pesaje)
              </p>
              <Switch
                checked={form.incluirBascula}
                onCheckedChange={(valor) => setCampo("incluirBascula", valor)}
                aria-label="Cobrar cuota de báscula"
              />
            </div>

            {form.incluirBascula && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="costo-bascula" className="text-sm">
                    Importe a cobrar
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="costo-bascula"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      value={form.costoBascula}
                      onChange={(e) => setCampo("costoBascula", e.target.value)}
                      className="h-12 pl-8 font-mono text-lg font-bold text-blue-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Forma de cobro</Label>
                  <Select
                    value={form.basculaFormaPago}
                    onValueChange={(valor) =>
                      setCampo("basculaFormaPago", valor as FormaPagoBascula)
                    }
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="liquidacion">
                        Descontar de la liquidación
                      </SelectItem>
                      <SelectItem value="efectivo">
                        Cobrado en efectivo al momento
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {form.basculaFormaPago === "efectivo"
                      ? "No se descuenta del pago: ya se cobró en caja."
                      : "Se resta del total a liquidar al productor."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Cuota de maniobra */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Users className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                Cuota de maniobra / servicios de patio
              </p>
              <Switch
                checked={form.incluirManiobra}
                onCheckedChange={(valor) => setCampo("incluirManiobra", valor)}
                aria-label="Aplicar cuota de maniobra"
              />
            </div>

            {form.incluirManiobra && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maniobra-kg" className="text-sm">
                    Cuota por kilo (descarga, estiba)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="maniobra-kg"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      value={form.cuotaManiobraKg}
                      onChange={(e) =>
                        setCampo("cuotaManiobraKg", e.target.value)
                      }
                      placeholder="0.00"
                      className="h-12 pl-8 font-mono text-lg font-bold text-indigo-700"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-white p-3">
                  <p className="text-xs text-muted-foreground">
                    Total por maniobra
                  </p>
                  <p className="font-mono text-xl font-bold text-indigo-700">
                    {moneda(calculo.cuotaManiobraTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {calculo.pesoNeto.toLocaleString("es-MX")} kg ×{" "}
                    {moneda(Number(form.cuotaManiobraKg) || 0)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas" className="font-semibold">
              Notas / observaciones
            </Label>
            <Textarea
              id="notas"
              value={form.notas}
              onChange={(e) => setCampo("notas", e.target.value)}
              placeholder="Ej. fruta mojada, camión con doble reja, pendiente de revisión fitosanitaria..."
              className="min-h-[90px]"
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cortadores: solo cosecha propia */}
      {esPropia && (
        <Card className="rounded-2xl border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Cortadores del lote (cosecha propia)
            </CardTitle>
            <CardDescription>
              Registra las cajas recolectadas por cada cortador y su pago
              estimado ({Math.round(PORCENTAJE_CORTADOR * 100)}% del precio por
              caja).
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="precio-caja" className="text-sm font-semibold">
                  Precio por caja (referencia de pago)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="precio-caja"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={form.precioCajaCortador}
                    onChange={(e) =>
                      setCampo("precioCajaCortador", e.target.value)
                    }
                    placeholder="Ej. 100.00"
                    className="h-12 pl-8 font-mono text-lg"
                  />
                </div>
                {precioCaja > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Pago por caja al cortador:{" "}
                    <span className="font-semibold">
                      {moneda(precioCaja * PORCENTAJE_CORTADOR)}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Agregar cortador</Label>
                <Select onValueChange={agregarCortador} value="">
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecciona un cortador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cortadores.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        No hay cortadores activos registrados
                      </div>
                    ) : (
                      cortadores
                        .filter(
                          (c) => !cortadoresLote.some((cl) => cl.id === c.id)
                        )
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {cortadoresLote.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-muted-foreground">
                <Plus className="mx-auto mb-1 h-4 w-4" aria-hidden="true" />
                Sin cortadores asignados a este lote.
              </p>
            ) : (
              <div className="space-y-3">
                {cortadoresLote.map((cortador) => (
                  <div
                    key={cortador.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <span className="min-w-[140px] flex-1 font-medium">
                      {cortador.nombre}
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={cortador.cajas}
                      onChange={(e) =>
                        actualizarCajas(
                          cortador.id,
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        )
                      }
                      className="h-10 w-24 text-center font-mono"
                      aria-label={`Cajas recolectadas por ${cortador.nombre}`}
                    />
                    <span className="text-xs text-muted-foreground">cajas</span>
                    <Badge
                      variant="outline"
                      className="ml-auto border-emerald-300 font-mono text-emerald-700"
                    >
                      {moneda(
                        calcularPagoCortador(cortador.cajas, precioCaja)
                      )}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => quitarCortador(cortador.id)}
                      aria-label={`Quitar a ${cortador.nombre}`}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Total pago a cortadores
                    </p>
                    <p className="text-xs text-emerald-700">
                      {totalCajas} cajas × {moneda(precioCaja)} ×{" "}
                      {Math.round(PORCENTAJE_CORTADOR * 100)}%
                    </p>
                  </div>
                  <span className="font-mono text-xl font-bold text-emerald-900">
                    {moneda(pagoCortadores)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
