import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Hash,
  Leaf,
  Loader2,
  MapPin,
  Search,
  Sprout,
  Ticket,
  Truck,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NuevoProductorDialog } from "@/components/recepcion/NuevoProductorDialog";
import { VARIEDADES_FRUTA } from "@/lib/recepcion/calculos";
import type { OrigenRecepcion } from "@/lib/recepcion/calculos";
import type { PropsPasoRecepcion } from "./tipos";

export function PasoOrigenTransporte({
  form,
  setCampo,
  productores,
  loadingProductores,
  errorProductores,
  onProductorCreado,
  huertos,
  folioOficialSugerido,
  folioDuplicado,
}: PropsPasoRecepcion) {
  const [busqueda, setBusqueda] = useState("");

  const productorSeleccionado = useMemo(
    () => productores.find((p) => p.id === form.productorId),
    [productores, form.productorId]
  );

  const huertoSeleccionado = useMemo(
    () => huertos.find((h) => h.id === form.huertoId),
    [huertos, form.huertoId]
  );

  const productoresFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return productores;
    return productores.filter((p) =>
      p.nombre.toLowerCase().includes(termino)
    );
  }, [productores, busqueda]);

  const esPropia = form.origen === "propia";

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950">
            1
          </span>
          Origen y control de entrada
        </CardTitle>
        <CardDescription>
          Identifica quién entrega la fruta, de dónde viene y en qué vehículo
          llegó a la planta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {/* Origen */}
        <Tabs
          value={form.origen}
          onValueChange={(valor) =>
            setCampo("origen", valor as OrigenRecepcion)
          }
        >
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
            <TabsTrigger
              value="terceros"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Truck className="mr-2 h-4 w-4" aria-hidden="true" />
              Compra a terceros
            </TabsTrigger>
            <TabsTrigger
              value="propia"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Leaf className="mr-2 h-4 w-4 text-green-600" aria-hidden="true" />
              Cosecha propia
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Folios */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="folio-fisico" className="font-semibold">
              <Ticket className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Folio del ticket físico de báscula
            </Label>
            <Input
              id="folio-fisico"
              value={form.folioFisico}
              onChange={(e) => setCampo("folioFisico", e.target.value)}
              placeholder="Ej. B-10293"
              className="h-12 font-mono text-base"
              autoComplete="off"
            />
            {folioDuplicado ? (
              <p className="flex items-start gap-1.5 text-xs font-medium text-amber-600">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Este folio ya se usó en el lote {folioDuplicado.numero_lote}.
                Verifica que no sea un doble registro.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Número impreso en el ticket de la báscula, si aplica.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">
              <Hash className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Folio oficial de recepción
            </Label>
            <div className="flex h-12 items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3">
              <span className="font-mono text-base font-bold text-emerald-800">
                {folioOficialSugerido ?? "Se asignará al guardar"}
              </span>
              <Badge
                variant="outline"
                className="border-emerald-300 text-[10px] text-emerald-700"
              >
                Consecutivo
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Lo genera el sistema en orden consecutivo al confirmar el ingreso.
            </p>
          </div>
        </div>

        {/* Productor */}
        <div className="space-y-2">
          <Label htmlFor="buscar-productor" className="font-semibold">
            <User className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {esPropia ? "Productor responsable de la cosecha *" : "Productor *"}
          </Label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="buscar-productor"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre..."
                className="h-12 pl-10"
                autoComplete="off"
              />
            </div>
            <NuevoProductorDialog onProductorCreated={onProductorCreado} />
          </div>

          <Select
            value={form.productorId}
            onValueChange={(valor) => setCampo("productorId", valor)}
            disabled={loadingProductores}
          >
            <SelectTrigger className="h-12" aria-label="Seleccionar productor">
              {loadingProductores ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Cargando productores...
                </span>
              ) : errorProductores ? (
                <span className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  Error al cargar productores
                </span>
              ) : (
                <SelectValue
                  placeholder={
                    productores.length === 0
                      ? "Sin productores registrados: usa + para dar de alta"
                      : "Selecciona el productor..."
                  }
                />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {productoresFiltrados.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {busqueda
                    ? "Sin resultados para esa búsqueda"
                    : "No hay productores registrados"}
                </div>
              ) : (
                productoresFiltrados.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="py-3">
                    <span className="font-medium">{p.nombre}</span>
                    {p.telefono ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.telefono}
                      </span>
                    ) : null}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {productorSeleccionado && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
              <User className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span className="font-semibold text-blue-900">
                {productorSeleccionado.nombre}
              </span>
              {typeof productorSeleccionado.saldo_pendiente === "number" &&
                productorSeleccionado.saldo_pendiente > 0 && (
                  <Badge
                    variant="outline"
                    className="ml-auto border-blue-300 text-xs text-blue-700"
                  >
                    Saldo pendiente: $
                    {productorSeleccionado.saldo_pendiente.toLocaleString(
                      "es-MX",
                      { minimumFractionDigits: 2 }
                    )}
                  </Badge>
                )}
            </div>
          )}
        </div>

        {/* Huerto y variedad */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="huerto-select" className="font-semibold">
              <MapPin className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Huerto de procedencia {esPropia ? "*" : "(opcional)"}
            </Label>
            <Select
              value={form.huertoId}
              onValueChange={(valor) => setCampo("huertoId", valor)}
            >
              <SelectTrigger
                id="huerto-select"
                className="h-12"
                aria-label="Huerto de procedencia"
              >
                <SelectValue
                  placeholder={
                    huertos.length === 0
                      ? "Sin huertos registrados"
                      : "Selecciona el huerto..."
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {huertos.map((h) => (
                  <SelectItem key={h.id} value={h.id} className="py-3">
                    <span className="font-medium">{h.nombre}</span>
                    {h.ubicacion ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {h.ubicacion}
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {esPropia && !form.huertoId && (
              <p className="text-xs font-medium text-amber-600">
                La cosecha propia exige huerto para cerrar la trazabilidad.
              </p>
            )}
            {huertoSeleccionado?.ubicacion && (
              <p className="text-xs text-muted-foreground">
                Localidad: {huertoSeleccionado.ubicacion}
                {huertoSeleccionado.hectareas
                  ? ` · ${huertoSeleccionado.hectareas} ha`
                  : ""}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variedad-select" className="font-semibold">
              <Sprout className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Variedad de la fruta *
            </Label>
            <Select
              value={form.variedad}
              onValueChange={(valor) => setCampo("variedad", valor)}
            >
              <SelectTrigger
                id="variedad-select"
                className="h-12"
                aria-label="Variedad de la fruta"
              >
                <SelectValue placeholder="Selecciona la variedad..." />
              </SelectTrigger>
              <SelectContent>
                {VARIEDADES_FRUTA.map((variedad) => (
                  <SelectItem key={variedad} value={variedad}>
                    {variedad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transporte */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Truck className="h-4 w-4" aria-hidden="true" />
            Transporte y trazabilidad del embarque
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="chofer" className="text-sm">
                Chofer
              </Label>
              <Input
                id="chofer"
                value={form.chofer}
                onChange={(e) => setCampo("chofer", e.target.value)}
                placeholder="Nombre del chofer"
                className="h-11 bg-white"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="placas" className="text-sm">
                Placas del camión
              </Label>
              <Input
                id="placas"
                value={form.placas}
                onChange={(e) =>
                  setCampo("placas", e.target.value.toUpperCase())
                }
                placeholder="Ej. P12-AB-345"
                className="h-11 bg-white font-mono uppercase"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rejas" className="text-sm">
                <Users className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Rejas / huacales
              </Label>
              <Input
                id="rejas"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.rejas}
                onChange={(e) => setCampo("rejas", e.target.value)}
                placeholder="0"
                className="h-11 bg-white font-mono"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
