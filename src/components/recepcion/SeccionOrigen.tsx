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
import { cn } from "@/lib/utils";
import type { OrigenRecepcion } from "@/lib/recepcion/calculos";
import { VARIEDAD_UNICA, type PropsSeccionRecepcion } from "./tipos";

export function SeccionOrigen({
  form,
  setCampo,
  productores,
  loadingProductores,
  errorProductores,
  onProductorCreado,
  huertos,
  folioOficialSugerido,
  folioDuplicado,
}: PropsSeccionRecepcion) {
  const [busqueda, setBusqueda] = useState("");

  const esPropia = form.origen === "propia";

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
    return productores.filter((p) => p.nombre.toLowerCase().includes(termino));
  }, [productores, busqueda]);

  const cambiarOrigen = (valor: string) => {
    const nuevo = valor as OrigenRecepcion;
    setCampo("origen", nuevo);
    // El huerto solo existe en cosecha propia: al cambiar a compra
    // externa se limpia para no guardar un dato fuera de contexto.
    if (nuevo === "terceros") setCampo("huertoId", "");
  };

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ticket className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          Origen y control de entrada
        </CardTitle>
        <CardDescription>
          Identifica quién entrega la fruta y de dónde viene antes de pesarla.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        <Tabs value={form.origen} onValueChange={cambiarOrigen}>
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
              Lo genera el sistema en orden consecutivo al guardar la boleta.
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

        {/* Huerto: exclusivo de cosecha propia */}
        {esPropia && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <Label htmlFor="huerto-select" className="font-semibold">
              <MapPin className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Huerto de procedencia *
            </Label>
            <Select
              value={form.huertoId}
              onValueChange={(valor) => setCampo("huertoId", valor)}
            >
              <SelectTrigger
                id="huerto-select"
                className="h-12 bg-white"
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
            {huertoSeleccionado?.ubicacion ? (
              <p className="text-xs text-muted-foreground">
                Localidad: {huertoSeleccionado.ubicacion}
                {huertoSeleccionado.hectareas
                  ? ` · ${huertoSeleccionado.hectareas} ha`
                  : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                El huerto es obligatorio para cerrar la trazabilidad de la
                cosecha propia.
              </p>
            )}
          </div>
        )}

        {/* Variedad: dato fijo de la zona */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Sprout className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">
              Variedad de la fruta
            </p>
            <p className="text-xs text-muted-foreground">
              En la zona solo se recibe esta variedad, se registra
              automáticamente.
            </p>
          </div>
          <Badge
            className={cn(
              "border-emerald-300 bg-emerald-100 text-emerald-800",
              "text-xs font-semibold"
            )}
            variant="outline"
          >
            {VARIEDAD_UNICA}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
