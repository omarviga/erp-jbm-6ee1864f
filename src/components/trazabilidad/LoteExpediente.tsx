import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { QRGenerator } from "./QRGenerator";
import { useLote } from "@/hooks/useLote";
import { 
  ArrowLeft, 
  User, 
  Scale, 
  Package, 
  DollarSign, 
  Clock,
  Printer,
  FileText,
  Snowflake,
  Factory
} from "lucide-react";
import { cn } from "@/lib/utils";

const estadoConfig = {
  pendiente: { label: "Pendiente", className: "status-pendiente" },
  en_proceso: { label: "En Proceso", className: "status-en-proceso" },
  liquidado: { label: "Liquidado", className: "status-liquidado" },
};

const calibreColors: Record<string, string> = {
  "200": "bg-green-600",
  "300": "bg-green-500",
  "400": "bg-lime-500",
  "500": "bg-lime-400",
  "600": "bg-yellow-500",
  "extras": "bg-orange-500",
};

export default function LoteExpediente() {
  const { loteId } = useParams<{ loteId: string }>();
  const navigate = useNavigate();
  const { lote, produccion, rentabilidad, vidaUtil, distribucion, loading, error } = useLote(loteId);

  if (loading) {
    return (
      <MainLayout title="Cargando..." subtitle="Expediente de lote">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (error || !lote) {
    return (
      <MainLayout title="Error" subtitle="Lote no encontrado">
        <Card className="module-card">
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground mb-4">
              {error || "El lote solicitado no existe"}
            </p>
            <Button onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const valorCompra = (lote.peso_neto || 0) * (lote.precio_pactado_kg || 0);

  return (
    <MainLayout 
      title={`Expediente: ${lote.numero_lote}`} 
      subtitle="Trazabilidad completa del lote"
    >
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-sm", estadoConfig[lote.estado].className)}>
            {estadoConfig[lote.estado].label}
          </Badge>
          {vidaUtil && (
            <Badge variant="outline" className={cn("text-sm", vidaUtil.color)}>
              {vidaUtil.emoji} {vidaUtil.dias} días
            </Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Contenido Principal */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="origen" className="space-y-4">
            <TabsList className="grid grid-cols-4 h-12">
              <TabsTrigger value="origen" className="text-sm">
                <User className="h-4 w-4 mr-1 hidden sm:inline" />
                Origen
              </TabsTrigger>
              <TabsTrigger value="produccion" className="text-sm">
                <Package className="h-4 w-4 mr-1 hidden sm:inline" />
                Producción
              </TabsTrigger>
              <TabsTrigger value="almacen" className="text-sm">
                <Snowflake className="h-4 w-4 mr-1 hidden sm:inline" />
                Almacén
              </TabsTrigger>
              <TabsTrigger value="rentabilidad" className="text-sm">
                <DollarSign className="h-4 w-4 mr-1 hidden sm:inline" />
                Rentabilidad
              </TabsTrigger>
            </TabsList>

            {/* Tab: Origen */}
            <TabsContent value="origen">
              <Card className="module-card">
                <CardHeader className="module-header">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información de Origen
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Productor/Huerto */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">
                        {lote.es_cosecha_propia ? "Huerto" : "Productor"}
                      </p>
                      <p className="font-semibold text-lg">
                        {lote.es_cosecha_propia 
                          ? lote.huerto?.nombre || "Sin especificar"
                          : lote.productor?.nombre || "Sin especificar"
                        }
                      </p>
                      {!lote.es_cosecha_propia && lote.productor?.telefono && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📞 {lote.productor.telefono}
                        </p>
                      )}
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Fecha de Recepción</p>
                      <p className="font-semibold text-lg">
                        {new Date(lote.fecha_recepcion).toLocaleDateString("es-MX", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {lote.es_cosecha_propia ? "🌿 Cosecha Propia" : "🤝 Compra a Terceros"}
                      </p>
                    </div>
                  </div>

                  {/* Pesos */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <Scale className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Peso Bruto</p>
                      <p className="text-xl font-bold font-mono">
                        {lote.peso_bruto.toLocaleString("es-MX")} kg
                      </p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Tara</p>
                      <p className="text-xl font-bold font-mono">
                        {lote.peso_tara.toLocaleString("es-MX")} kg
                      </p>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg text-center border border-primary/30">
                      <p className="text-sm text-primary font-medium">Peso Neto</p>
                      <p className="text-2xl font-bold font-mono text-primary">
                        {(lote.peso_neto || 0).toLocaleString("es-MX")} kg
                      </p>
                    </div>
                  </div>

                  {/* Valor de Compra */}
                  {!lote.es_cosecha_propia && lote.precio_pactado_kg && (
                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Precio Pactado</p>
                          <p className="text-xl font-bold">
                            ${lote.precio_pactado_kg.toFixed(2)} / kg
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Valor de Compra</p>
                          <p className="text-2xl font-bold text-primary">
                            ${valorCompra.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Producción */}
            <TabsContent value="produccion">
              <Card className="module-card">
                <CardHeader className="module-header">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Desglose de Producción
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {produccion.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay registros de producción para este lote
                    </p>
                  ) : (
                    <>
                      {/* Lista de producción */}
                      <div className="space-y-3">
                        {produccion.map((item) => (
                          <div 
                            key={item.id}
                            className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
                                calibreColors[item.calibre] || "bg-gray-500"
                              )}>
                                {item.calibre}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="capitalize">
                                    {item.calidad}
                                  </Badge>
                                  <Badge variant="secondary" className="capitalize">
                                    {item.color.replace("_", " ")}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  → {item.destino === "camara_fria" ? "❄️ Cámara Fría" : 
                                     item.destino === "molino" ? "🏭 Molino" : "📦 Piso Empaque"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{item.cantidad_cajas} cajas</p>
                              {item.peso_total_kg && (
                                <p className="text-sm text-muted-foreground">
                                  {item.peso_total_kg.toLocaleString()} kg
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Distribución por calibre */}
                      {distribucion && (
                        <div className="pt-4 border-t">
                          <h4 className="font-semibold mb-4">Distribución por Calibre</h4>
                          <div className="space-y-3">
                            {Object.entries(distribucion.distribucion).map(([calibre, data]) => (
                              <div key={calibre} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium">Calibre {calibre}</span>
                                  <span>{data.cantidad} cajas ({data.porcentaje.toFixed(1)}%)</span>
                                </div>
                                <Progress 
                                  value={data.porcentaje} 
                                  className="h-2"
                                />
                              </div>
                            ))}
                          </div>
                          <p className="text-center font-semibold mt-4 pt-4 border-t">
                            Total: {distribucion.totalCajas} cajas
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Almacén */}
            <TabsContent value="almacen">
              <Card className="module-card">
                <CardHeader className="bg-gradient-to-r from-cold-foreground/90 to-cold-foreground/70 text-white rounded-t-xl px-6 py-4">
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="h-5 w-5" />
                    Estado de Almacenamiento
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {vidaUtil && (
                    <>
                      {/* Semáforo de vida útil */}
                      <div className={cn(
                        "p-6 rounded-xl border-2 text-center",
                        vidaUtil.estado === "optimo" ? "bg-success/10 border-success/30" :
                        vidaUtil.estado === "atencion" ? "bg-warning/10 border-warning/30" :
                        "bg-destructive/10 border-destructive/30"
                      )}>
                        <span className="text-5xl mb-2 block">{vidaUtil.emoji}</span>
                        <p className={cn("text-2xl font-bold", vidaUtil.color)}>
                          {vidaUtil.label}
                        </p>
                        <p className="text-lg font-semibold mt-2">
                          {vidaUtil.dias} días almacenado
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {vidaUtil.diasRestantes} días restantes de vida útil
                        </p>
                      </div>

                      {/* Barra de progreso de vida útil */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Vida útil consumida</span>
                          <span>{Math.min((vidaUtil.dias / 25) * 100, 100).toFixed(0)}%</span>
                        </div>
                        <Progress 
                          value={Math.min((vidaUtil.dias / 25) * 100, 100)}
                          className={cn(
                            "h-3",
                            vidaUtil.estado === "optimo" ? "[&>div]:bg-success" :
                            vidaUtil.estado === "atencion" ? "[&>div]:bg-warning" :
                            "[&>div]:bg-destructive"
                          )}
                        />
                      </div>

                      {/* Info adicional */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-cold rounded-lg border border-cold-foreground/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-cold-foreground" />
                            <span className="text-sm font-medium text-cold-foreground">
                              Fecha de Ingreso
                            </span>
                          </div>
                          <p className="font-semibold">
                            {new Date(lote.fecha_recepcion).toLocaleDateString("es-MX")}
                          </p>
                        </div>
                        <div className="p-4 bg-cold rounded-lg border border-cold-foreground/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Factory className="h-4 w-4 text-cold-foreground" />
                            <span className="text-sm font-medium text-cold-foreground">
                              Destino Recomendado
                            </span>
                          </div>
                          <p className="font-semibold">
                            {vidaUtil.estado === "urgente" ? "🔥 Venta Urgente" :
                             vidaUtil.estado === "atencion" ? "⚡ Priorizar Salida" :
                             "✓ Sin Urgencia"}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Rentabilidad */}
            <TabsContent value="rentabilidad">
              <Card className="module-card">
                <CardHeader className="module-header">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Análisis de Rentabilidad
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {rentabilidad && (
                    <>
                      {/* Resumen de costos */}
                      <div className="space-y-3">
                        <h4 className="font-semibold">Costos</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                            <span>Costo de Compra</span>
                            <span className="font-mono font-semibold">
                              ${rentabilidad.costoCompra.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                            <span>Insumos (estimado)</span>
                            <span className="font-mono font-semibold">
                              ${rentabilidad.costoInsumos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                            <span>Mano de Obra (estimado)</span>
                            <span className="font-mono font-semibold">
                              ${rentabilidad.costoManoObra.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between p-3 bg-muted/50 rounded-lg border">
                            <span className="font-semibold">Costo Total</span>
                            <span className="font-mono font-bold">
                              ${rentabilidad.costoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ingresos estimados */}
                      <div className="space-y-3">
                        <h4 className="font-semibold">Ingresos Estimados</h4>
                        <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                          <div className="flex justify-between items-center">
                            <span>Venta Estimada</span>
                            <span className="font-mono font-bold text-xl text-primary">
                              ${rentabilidad.ventaEstimada.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Margen */}
                      <div className={cn(
                        "p-6 rounded-xl border-2",
                        rentabilidad.margenBruto >= 0 
                          ? "bg-success/10 border-success/30" 
                          : "bg-destructive/10 border-destructive/30"
                      )}>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Margen Bruto</p>
                          <p className={cn(
                            "text-3xl font-bold",
                            rentabilidad.margenBruto >= 0 ? "text-success" : "text-destructive"
                          )}>
                            ${rentabilidad.margenBruto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                          </p>
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "mt-2 text-lg px-4 py-1",
                              rentabilidad.margenBruto >= 0 ? "bg-success/20" : "bg-destructive/20"
                            )}
                          >
                            {rentabilidad.margenBruto >= 0 ? "+" : ""}
                            {rentabilidad.margenPorcentaje.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">
                        * Valores estimados basados en precios promedio de mercado
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Panel Lateral */}
        <div className="space-y-6">
          {/* QR Code */}
          <QRGenerator numeroLote={lote.numero_lote} />

          {/* Acciones */}
          <Card className="module-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Expediente
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              {lote.estado !== "liquidado" && !lote.es_cosecha_propia && (
                <Button 
                  className="w-full justify-start bg-primary hover:bg-primary/90"
                  onClick={() => navigate(`/finanzas?productor=${lote.productor?.id}&lote=${lote.id}`)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Generar Liquidación
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Notas */}
          {lote.notas && (
            <Card className="module-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{lote.notas}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
