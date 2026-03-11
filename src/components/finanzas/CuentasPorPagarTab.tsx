import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Receipt,
  Users,
  ArrowLeft,
  DollarSign,
  Calendar,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCuentasPorPagar, type ResumenProductorCxP, type CuentaPorPagar } from "@/hooks/useCuentasPorPagar";
import { useProductores, type Productor } from "@/hooks/useProductores";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { EstadoCuentaDocument } from "@/components/pdf/EstadoCuentaDocument";
import { format, subDays } from "date-fns";

const formatMXN = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const estadoBadge = (estado: string) => {
  const map: Record<string, { label: string; className: string }> = {
    pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-200" },
    parcial: { label: "Parcial", className: "bg-blue-100 text-blue-800 border-blue-200" },
    liquidado: { label: "Liquidado", className: "bg-green-100 text-green-800 border-green-200" },
    conciliado: { label: "Conciliado", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  };
  const info = map[estado] || map.pendiente;
  return <Badge variant="outline" className={info.className}>{info.label}</Badge>;
};

export function CuentasPorPagarTab() {
  const [selectedProductorId, setSelectedProductorId] = useState<string | null>(null);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [montoAbono, setMontoAbono] = useState("");
  const [metodoPago, setMetodoPago] = useState("transferencia");
  const [referencia, setReferencia] = useState("");
  const [notasAbono, setNotasAbono] = useState("");

  const { productores, loading: loadingProd } = useProductores();
  const {
    cxp,
    cxpLoading,
    resumenGlobal,
    resumenLoading,
    abonos,
    registrarAbono,
    generarDatosEstadoCuenta,
  } = useCuentasPorPagar(selectedProductorId || undefined);

  const productorSeleccionado = productores.find((p) => p.id === selectedProductorId);

  const totalSaldoGlobal = resumenGlobal.reduce((s, r) => s + r.saldo_vivo, 0);

  const handleRegistrarAbono = async () => {
    if (!selectedProductorId || !montoAbono || parseFloat(montoAbono) <= 0) return;
    await registrarAbono.mutateAsync({
      productor_id: selectedProductorId,
      monto: parseFloat(montoAbono),
      metodo_pago: metodoPago,
      referencia: referencia || undefined,
      notas: notasAbono || undefined,
    });
    setMontoAbono("");
    setReferencia("");
    setNotasAbono("");
    setShowPagoForm(false);
  };

  // Sugerencia FIFO
  const sugerenciaFIFO = (() => {
    const monto = parseFloat(montoAbono) || 0;
    if (monto <= 0) return [];
    const pendientes = cxp.filter((c) => c.estado === "pendiente" || c.estado === "parcial");
    const sugerencias: { cxp: CuentaPorPagar; aplicar: number }[] = [];
    let restante = monto;
    for (const c of pendientes) {
      if (restante <= 0) break;
      const aplicar = Math.min(restante, c.saldo_pendiente);
      sugerencias.push({ cxp: c, aplicar });
      restante -= aplicar;
    }
    return sugerencias;
  })();

  // Datos para PDF
  const periodoEdoCta = {
    inicio: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    fin: format(new Date(), "yyyy-MM-dd"),
  };
  const datosEdoCta = selectedProductorId
    ? generarDatosEstadoCuenta(cxp, abonos, periodoEdoCta)
    : null;

  // --- VISTA: LISTADO GLOBAL ---
  if (!selectedProductorId) {
    return (
      <div className="space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deuda Total Viva</p>
                <p className="text-2xl font-black text-destructive">{formatMXN(totalSaldoGlobal)}</p>
              </div>
              <div className="bg-destructive/10 p-2 rounded-full">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Productores con Saldo</p>
                <p className="text-2xl font-black">{resumenGlobal.length}</p>
              </div>
              <div className="bg-muted p-2 rounded-full">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tickets Pendientes</p>
                <p className="text-2xl font-black">{resumenGlobal.reduce((s, r) => s + r.tickets_pendientes, 0)}</p>
              </div>
              <div className="bg-primary/10 p-2 rounded-full">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de productores */}
        <Card>
          <CardHeader>
            <CardTitle>Cuentas por Pagar por Productor</CardTitle>
            <CardDescription>Ordenado por mayor deuda. Click para ver detalle.</CardDescription>
          </CardHeader>
          <CardContent>
            {resumenLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6" /></div>
            ) : resumenGlobal.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                <p>No hay cuentas por pagar pendientes</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Productor</TableHead>
                    <TableHead className="text-right">Deuda Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Saldo Vivo</TableHead>
                    <TableHead className="text-center">Tickets</TableHead>
                    <TableHead>Más Antiguo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumenGlobal.map((r) => {
                    const diasAntiguo = r.ticket_mas_viejo
                      ? Math.floor((Date.now() - new Date(r.ticket_mas_viejo).getTime()) / 86400000)
                      : 0;
                    return (
                      <TableRow
                        key={r.productor_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedProductorId(r.productor_id)}
                      >
                        <TableCell className="font-medium">{r.nombre}</TableCell>
                        <TableCell className="text-right">{formatMXN(r.total_deuda)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatMXN(r.total_pagado)}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">{formatMXN(r.saldo_vivo)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{r.tickets_pendientes}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            <span className={cn(diasAntiguo > 7 && "text-destructive font-medium")}>
                              {diasAntiguo}d
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- VISTA: DETALLE DE UN PRODUCTOR ---
  const saldoVivo = cxp
    .filter((c) => c.estado === "pendiente" || c.estado === "parcial")
    .reduce((s, c) => s + c.saldo_pendiente, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedProductorId(null); setShowPagoForm(false); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <h2 className="text-lg font-bold">{productorSeleccionado?.nombre}</h2>
        <Badge variant="outline" className="text-destructive border-destructive">
          Saldo: {formatMXN(saldoVivo)}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Tickets (izquierda) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Tickets de Báscula (FIFO)</CardTitle>
                {productorSeleccionado && datosEdoCta && (
                  <PDFDownloadLink
                    document={
                      <EstadoCuentaDocument
                        productor={productorSeleccionado}
                        periodo={{ inicio: periodoEdoCta.inicio, fin: periodoEdoCta.fin }}
                        movimientos={datosEdoCta.movimientos}
                        resumen={datosEdoCta.resumen}
                      />
                    }
                    fileName={`EdoCta_${productorSeleccionado.nombre}_${format(new Date(), "yyyyMMdd")}.pdf`}
                  >
                    {({ loading }) => (
                      <Button variant="outline" size="sm" disabled={loading}>
                        <Download className="h-4 w-4 mr-1" />
                        {loading ? "Generando..." : "PDF Corte"}
                      </Button>
                    )}
                  </PDFDownloadLink>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {cxpLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
              ) : cxp.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Sin tickets registrados</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">Kg Pagables</TableHead>
                      <TableHead className="text-right">$/kg</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cxp.map((c) => (
                      <TableRow key={c.id} className={cn(c.estado === "liquidado" && "opacity-60")}>
                        <TableCell className="text-sm">
                          {new Date(c.fecha_ticket).toLocaleDateString("es-MX")}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{c.numero_lote}</TableCell>
                        <TableCell className="text-right">{c.kilos_pagables.toLocaleString("es-MX")}</TableCell>
                        <TableCell className="text-right">{formatMXN(c.precio_kg)}</TableCell>
                        <TableCell className="text-right font-medium">{formatMXN(c.monto_total)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatMXN(c.monto_pagado)}</TableCell>
                        <TableCell className="text-right font-bold">{formatMXN(c.saldo_pendiente)}</TableCell>
                        <TableCell className="text-center">{estadoBadge(c.estado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Historial de abonos */}
          {abonos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Historial de Pagos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abonos.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{new Date(a.created_at).toLocaleDateString("es-MX")}</TableCell>
                        <TableCell className="capitalize">{a.metodo_pago}</TableCell>
                        <TableCell className="font-mono">{a.referencia || "—"}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">{formatMXN(a.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Panel de Pago (derecha) */}
        <div className="lg:col-span-5 space-y-4">
          {!showPagoForm ? (
            <Card className="border-l-4 border-l-green-600">
              <CardContent className="p-6 text-center space-y-4">
                <DollarSign className="h-12 w-12 mx-auto text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                  <p className="text-3xl font-black text-destructive">{formatMXN(saldoVivo)}</p>
                </div>
                <Button className="w-full" size="lg" onClick={() => setShowPagoForm(true)} disabled={saldoVivo <= 0}>
                  <DollarSign className="h-4 w-4 mr-2" /> Registrar Abono
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-l-4 border-l-green-600">
              <CardHeader>
                <CardTitle className="text-base">Registrar Abono</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Monto a Pagar</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={montoAbono}
                    onChange={(e) => setMontoAbono(e.target.value)}
                    className="text-lg font-bold"
                  />
                  {parseFloat(montoAbono) > saldoVivo && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ El monto excede el saldo pendiente</p>
                  )}
                </div>

                <div>
                  <Label>Método de Pago</Label>
                  <Select value={metodoPago} onValueChange={setMetodoPago}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferencia SPEI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Referencia / No. Rastreo</Label>
                  <Input
                    placeholder="Ej: SPEI-123456"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="Observaciones opcionales..."
                    value={notasAbono}
                    onChange={(e) => setNotasAbono(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Sugerencia FIFO */}
                {sugerenciaFIFO.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Distribución FIFO sugerida</p>
                    {sugerenciaFIFO.map((s) => (
                      <div key={s.cxp.id} className="flex justify-between text-sm">
                        <span className="font-mono">{s.cxp.numero_lote}</span>
                        <span className="font-bold text-green-600">{formatMXN(s.aplicar)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowPagoForm(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleRegistrarAbono}
                    disabled={registrarAbono.isPending || !montoAbono || parseFloat(montoAbono) <= 0}
                  >
                    {registrarAbono.isPending ? (
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Pago
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
