import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Scale, Printer, Plus, Trash2, History, Truck, Leaf, QrCode, AlertOctagon, Save, Loader2, CheckCircle, Calculator, DollarSign, Search, User, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useProductores } from "@/hooks/useProductores";
import { useRecepcion } from "@/hooks/useRecepcion";

// Mock data
const huertos = [
  { id: "1", nombre: "Huerto Norte" },
  { id: "2", nombre: "Huerto Sur" },
  { id: "3", nombre: "Parcela Central" },
];

const cortadores = [
  { id: "1", nombre: "Pedro Martínez" },
  { id: "2", nombre: "José Ramírez" },
  { id: "3", nombre: "Luis García" },
  { id: "4", nombre: "Carlos Hernández" },
];

const historialPrecios = [
  { fecha: "15/01/2026", precio: 4.50 },
  { fecha: "10/01/2026", precio: 4.30 },
  { fecha: "05/01/2026", precio: 4.80 },
];

// Opciones de zonas de destino
const zonasDestino = [
  { id: "anden_descarga", nombre: "🚛 Andén de Descarga", costoBascula: 50 },
  { id: "camara_materia_prima", nombre: "❄️ Cámara MP (Frio)", costoBascula: 75 },
  { id: "patio_maniobras", nombre: "🏭 Patio de Maniobras", costoBascula: 50 },
  { id: "linea_directa", nombre: "⚙️ Directo a Línea", costoBascula: 30 },
];

export default function Recepcion() {
  const [folioTicket, setFolioTicket] = useState("");
  const [pesoBruto, setPesoBruto] = useState("");
  const [tara, setTara] = useState("");
  const [precio, setPrecio] = useState("");
  const [productorId, setProductorId] = useState("");
  const [huertoId, setHuertoId] = useState("");
  const [cortadoresLote, setCortadoresLote] = useState<{ id: string; nombre: string; cajas: number }[]>([]);
  const [origen, setOrigen] = useState("terceros");
  const [paso, setPaso] = useState(1);
  const [pesoBascula, setPesoBascula] = useState(0);
  const [calidad, setCalidad] = useState({ defectos: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    nombreOrigen: "",
    placas: "",
    precioPactado: "",
    notas: "",
    zonaDestino: "anden_descarga",
    incluirCostoBascula: true,
    costoBascula: 50
  });

  // IDs únicos para cada campo de formulario
  const fieldIds = {
    productor: "productor-select",
    zonaDestino: "zona-destino-select",
    pesoBruto: "peso-bruto-input",
    tara: "tara-input",
    precio: "precio-input",
    notas: "notas-textarea",
    search: "search-productor-input",
    huerto: "huerto-select",
    cortador: "cortador-select",
    defectos: "defectos-slider",
    costoBascula: "costo-bascula-switch",
    pesoNeto: "peso-neto-display"
  };

  // Derivados de calidad - MOVIDO ANTES DE SU USO
  const estadoCalidad = calidad.defectos >= 20 ? "Rechazado" : calidad.defectos >= 10 ? "Observado" : "Aceptado";
  const bgCalidad = calidad.defectos >= 20 ? "bg-rose-50 border-rose-200" : calidad.defectos >= 10 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200";
  const colorCalidad = calidad.defectos >= 20 ? "text-rose-600" : calidad.defectos >= 10 ? "text-amber-600" : "text-emerald-600";

  // Usamos los hooks para obtener datos y guardar recepciones
  const {
    productores: productoresDB, // ✅ Renombrado
    loading: loadingProductores,
    error: errorProductores,
    refetch
  } = useProductores();

  const { guardarLote, calcularResumenRecepcion, loading: guardando } = useRecepcion();

  // Cálculos reales de peso y merma
  const calculos = useMemo(() => {
    const bruto = parseFloat(pesoBruto) || 0;
    const pesoTara = parseFloat(tara) || 0;
    const precioKg = parseFloat(precio) || 0;

    // 1. Neto Físico (Lo que hay en la báscula)
    const netoFisico = Math.max(0, bruto - pesoTara);

    // 2. Kilos de Basura/Defecto (Lo que NO se paga)
    const porcentajeMerma = calidad.defectos || 0;
    const kilosMerma = netoFisico * (porcentajeMerma / 100);

    // 3. Peso a Pagar (Neto - Basura)
    const pesoPagable = netoFisico - kilosMerma;

    // 4. Dinero
    const subtotal = pesoPagable * precioKg;
    const totalFinal = formData.incluirCostoBascula
      ? subtotal - formData.costoBascula
      : subtotal;

    return {
      netoFisico: netoFisico.toFixed(2),
      kilosMerma: kilosMerma.toFixed(2),
      pesoPagable: pesoPagable.toFixed(2),
      totalEstimado: Math.max(0, totalFinal).toFixed(2)
    };
  }, [pesoBruto, tara, precio, calidad.defectos, formData.incluirCostoBascula, formData.costoBascula]);

  // Productor seleccionado para mostrar información adicional
  const productorSeleccionado = useMemo(() => {
    if (!productoresDB || !productorId) return undefined;
    return productoresDB.find(p => p.id === productorId);
  }, [productorId, productoresDB]);

  // DEBUG: Verificar datos cargados
  useEffect(() => {
    console.log("DEBUG useEffect - Productores:", productoresDB);
    console.log("DEBUG useEffect - Productor seleccionado:", productorSeleccionado);
    console.log("DEBUG useEffect - Total productores:", productoresDB?.length || 0);
  }, [productoresDB, productorSeleccionado]);

  useEffect(() => {
    // Actualizar costo de báscula cuando cambia la zona de destino
    const zonaSeleccionada = zonasDestino.find(z => z.id === formData.zonaDestino);
    if (zonaSeleccionada) {
      setFormData(prev => ({
        ...prev,
        costoBascula: zonaSeleccionada.costoBascula
      }));
    }
  }, [formData.zonaDestino]);

  const handleOrigenChange = (value: string) => {
    setOrigen(value);
    // Resetear formulario cuando cambia el origen
    if (value === "propia") {
      setProductorId("");
      setSearchTerm("");
    }
  };

  const resetFormulario = () => {
    setFolioTicket("");
    setPesoBruto("");
    setTara("");
    setPrecio("");
    setProductorId("");
    setCalidad({ defectos: 0 });
    setSearchTerm("");
    setFormData({
      nombreOrigen: "",
      placas: "",
      precioPactado: "",
      notas: "",
      zonaDestino: "anden_descarga",
      incluirCostoBascula: true,
      costoBascula: 50
    });
    setPaso(1);
    setCortadoresLote([]);
  };

  const handleGuardar = async () => {
    if (!productorId || !pesoBruto) {
      toast.error("Faltan datos obligatorios", {
        description: "Selecciona un productor e ingresa el peso bruto",
      });
      return;
    }

    if (estadoCalidad === "Rechazado") {
      toast.error("No se puede guardar lote rechazado", {
        description: "La calidad está por debajo del mínimo aceptable",
      });
      return;
    }

    try {
      const loteData = {
        folio_fisico: folioTicket,
        productor_id: productorId,
        peso_bruto: Number(pesoBruto),
        peso_tara: Number(tara) || 0,
        precio_pactado_kg: Number(precio) || 0,
        peso_neto_fisico: Number(calculos.netoFisico),
        peso_pagable: Number(calculos.pesoPagable),
        kilos_merma: Number(calculos.kilosMerma),
        zona_asignada: formData.zonaDestino,
        costo_bascula: formData.incluirCostoBascula ? formData.costoBascula : 0,
        notas: formData.notas || "",
        calidad_defectos: calidad.defectos,
        origen: origen === "terceros" ? "externo" : "interno",
        estado_calidad: estadoCalidad.toLowerCase()
      };

      const resultado = await guardarLote(loteData);

      toast.success("✅ Lote recibido correctamente", {
        description: `Ticket #${resultado?.numero_lote || "N/A"}`,
        action: {
          label: "Imprimir",
          onClick: () => {
            window.print();
          }
        }
      });

      // Limpiar formulario después de guardar exitosamente
      resetFormulario();

    } catch (error: any) {
      console.error("Error al guardar lote:", error);
      toast.error("❌ Error al guardar el lote", {
        description: error.message || "Por favor, intenta nuevamente",
      });
    }
  };

  const addCortador = (cortadorId: string) => {
    const cortador = cortadores.find(c => c.id === cortadorId);
    if (cortador && !cortadoresLote.find(c => c.id === cortadorId)) {
      setCortadoresLote([...cortadoresLote, { ...cortador, cajas: 0 }]);
    }
  };

  const updateCortadorCajas = (id: string, cajas: number) => {
    setCortadoresLote(cortadoresLote.map(c => c.id === id ? { ...c, cajas } : c));
  };

  const removeCortador = (id: string) => {
    setCortadoresLote(cortadoresLote.filter(c => c.id !== id));
  };

  // Función para encontrar productor por ID
  const getProductorById = (id: string) => {
    return productoresDB?.find(p => p.id === id);
  };

  return (
    <MainLayout title="Recepción de Materia Prima" subtitle="Báscula y Control de Calidad">
      <div className="grid lg:grid-cols-12 gap-6">
        {/* --- COLUMNA IZQUIERDA: FLUJO (8 Cols) --- */}
        <div className="lg:col-span-8 space-y-6">
          {/* TABS DE ORIGEN */}
          <Tabs value={origen} onValueChange={handleOrigenChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="terceros" disabled={paso > 1}>
                <Truck className="h-4 w-4 mr-2" /> Compra a Terceros
              </TabsTrigger>
              <TabsTrigger value="propia" disabled={paso > 1}>
                <Leaf className="h-4 w-4 mr-2 text-green-600" /> Cosecha Propia
              </TabsTrigger>
            </TabsList>

            {/* CONTENIDO TERCEROS */}
            <TabsContent value="terceros">
              {/* PASO 1: DATOS */}
              <Card className={cn("transition-all duration-300 border-l-4", paso === 1 ? "border-l-blue-500 shadow-md" : "border-l-transparent opacity-60 grayscale")}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                      Datos del Productor
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* NUEVO CAMPO: FOLIO TICKET BÁSCULA */}
                  <div className="bg-slate-100 p-4 rounded-lg border border-slate-300 mb-6">
                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                      <Printer className="h-4 w-4" />
                      Folio del Ticket Físico (Báscula)
                    </Label>
                    <Input
                      value={folioTicket}
                      onChange={(e) => setFolioTicket(e.target.value)}
                      placeholder="Ej: B-10293"
                      className="mt-2 bg-white text-lg font-mono font-bold border-slate-400"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-1">Digita el número rojo impreso en el papel</p>
                  </div>

                  {/* Búsqueda y Selección de Productor */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={fieldIds.productor} className="text-base font-semibold">
                        Productor *
                      </Label>

                      {/* Campo de búsqueda */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={fieldIds.search}
                          type="text"
                          placeholder="Buscar productor por nombre..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                          aria-label="Buscar productor por nombre"
                        />
                      </div>

                      {/* Select de productores */}
                      <Select
                        value={productorId}
                        onValueChange={setProductorId}
                        disabled={loadingProductores}
                      >
                        <SelectTrigger id={fieldIds.productor} className="h-14 text-base">
                          {loadingProductores ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Cargando productores...</span>
                            </div>
                          ) : errorProductores ? (
                            <div className="flex items-center gap-2 text-amber-600">
                              <AlertCircle className="h-4 w-4" />
                              <span>Error cargando productores</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Seleccionar productor de la lista..." />
                          )}
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {productoresDB
                            ?.filter(p =>
                              !searchTerm ||
                              p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            ?.length === 0 ? (
                            <div className="py-6 text-center text-muted-foreground">
                              {searchTerm ? "No se encontraron productores" : "No hay productores disponibles"}
                            </div>
                          ) : (
                            productoresDB
                              ?.filter(p =>
                                !searchTerm ||
                                p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              ?.map((p) => (
                                <SelectItem
                                  key={p.id}
                                  value={p.id}
                                  className="text-base py-3"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{p.nombre}</span>
                                    <span className="text-xs text-muted-foreground">
                                      Anticipos: ${p.saldo_anticipos?.toLocaleString() || "0"}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>

                      {/* Información del productor seleccionado */}
                      {productorSeleccionado && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg" role="region" aria-label="Información del productor seleccionado">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-blue-800">
                              {productorSeleccionado.nombre}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Saldo anticipos:</span>
                              <span className={cn(
                                "ml-2 font-bold",
                                productorSeleccionado.saldo_anticipos > 0
                                  ? "text-green-600"
                                  : "text-gray-600"
                              )}>
                                ${productorSeleccionado.saldo_anticipos?.toLocaleString() || "0"}
                              </span>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-xs">
                                {productoresDB?.length || 0} productores en lista
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Zona de Destino */}
                  <div className="space-y-2">
                    <Label htmlFor={fieldIds.zonaDestino} className="text-base font-semibold text-blue-600">
                      Zona de Destino *
                    </Label>
                    <Select
                      value={formData.zonaDestino}
                      onValueChange={(value) => setFormData({ ...formData, zonaDestino: value })}
                    >
                      <SelectTrigger id={fieldIds.zonaDestino} className="h-14 text-base border-blue-200 bg-blue-50">
                        <SelectValue placeholder="Seleccionar zona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {zonasDestino.map((zona) => (
                          <SelectItem key={zona.id} value={zona.id} className="text-base py-3">
                            <div className="flex items-center justify-between">
                              <span>{zona.nombre}</span>
                              <Badge variant="outline" className="text-xs ml-2">
                                ${zona.costoBascula}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pesos */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={fieldIds.pesoBruto} className="text-base font-semibold">
                        Peso Bruto (kg) *
                      </Label>
                      <Input
                        id={fieldIds.pesoBruto}
                        type="number"
                        value={pesoBruto}
                        onChange={(e) => setPesoBruto(e.target.value)}
                        placeholder="0.00"
                        className="h-14 text-xl font-mono text-center"
                        step="0.01"
                        aria-describedby="peso-bruto-desc"
                      />
                      <p id="peso-bruto-desc" className="text-xs text-muted-foreground">
                        Peso total incluyendo empaque
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={fieldIds.tara} className="text-base font-semibold">
                        Tara (kg)
                      </Label>
                      <Input
                        id={fieldIds.tara}
                        type="number"
                        value={tara}
                        onChange={(e) => setTara(e.target.value)}
                        placeholder="0.00"
                        className="h-14 text-xl font-mono text-center"
                        disabled={paso !== 1}
                        step="0.01"
                        aria-describedby="tara-desc"
                      />
                      <p id="tara-desc" className="text-xs text-muted-foreground">
                        Peso del empaque/vehículo
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Peso Neto Real</Label>
                      <div className="h-14 flex items-center justify-center text-2xl font-bold font-mono bg-primary/10 text-primary rounded-lg border-2 border-primary/30">
                        {calculos.netoFisico} kg
                      </div>

                      {/* NUEVO: Visualización del descuento en tiempo real */}
                      {calidad.defectos > 0 && (
                        <div className="text-xs text-rose-600 font-medium text-center animate-pulse">
                          Se descontarán {calculos.kilosMerma} kg ({calidad.defectos}%) de merma
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Precio */}
                  <div className="space-y-2">
                    <Label htmlFor={fieldIds.precio} className="text-base font-semibold">
                      Precio Pactado por Kg (MXN)
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">$</span>
                        <Input
                          id={fieldIds.precio}
                          type="number"
                          value={precio}
                          onChange={(e) => setPrecio(e.target.value)}
                          placeholder="0.00"
                          className="h-14 text-xl font-mono text-center pl-10"
                          step="0.01"
                          aria-describedby="precio-desc"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPaso(2)}
                        disabled={!productorId || !pesoBruto}
                        aria-label="Continuar al control de calidad"
                      >
                        Siguiente
                      </Button>
                    </div>
                    <p id="precio-desc" className="text-xs text-muted-foreground">
                      Precio acordado por kilogramo de fruta
                    </p>
                  </div>

                  {/* Costo de Báscula */}
                  <Card className="border-blue-100">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-5 w-5 text-blue-600" />
                          <Label htmlFor={fieldIds.costoBascula} className="text-base font-semibold">
                            Costo de Báscula
                          </Label>
                        </div>
                        <Switch
                          id={fieldIds.costoBascula}
                          checked={formData.incluirCostoBascula}
                          onCheckedChange={(checked) => setFormData({ ...formData, incluirCostoBascula: checked })}
                        />
                      </div>

                      {formData.incluirCostoBascula && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="costo-manual" className="text-sm text-muted-foreground">
                                Importe a cobrar:
                              </Label>
                              <Badge variant="outline" className="text-xs">
                                Sugerido: {zonasDestino.find(z => z.id === formData.zonaDestino)?.nombre.split(" ")[0]}
                              </Badge>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                              <Input
                                id="costo-manual"
                                type="number"
                                value={formData.costoBascula}
                                onChange={(e) => setFormData({ ...formData, costoBascula: parseFloat(e.target.value) || 0 })}
                                className="pl-8 h-12 text-lg font-bold text-blue-600 bg-white"
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg flex items-start gap-2">
                            <DollarSign className="h-4 w-4 mt-0.5 shrink-0" />
                            <p>
                              Puedes ajustar manualmente el costo del servicio de báscula (ej. $0 para cortesía o montos simbólicos).
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Notas */}
                  <div className="space-y-2">
                    <Label htmlFor={fieldIds.notas} className="text-base font-semibold">
                      Notas / Observaciones
                    </Label>
                    <Textarea
                      id={fieldIds.notas}
                      placeholder="Ej: Fruta mojada, calidad regular, observaciones especiales..."
                      value={formData.notas}
                      onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                      className="min-h-[100px]"
                      aria-describedby="notas-desc"
                    />
                    <p id="notas-desc" className="text-xs text-muted-foreground">
                      Observaciones adicionales sobre el lote
                    </p>
                  </div>

                  {/* Total Estimado */}
                  <div
                    className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20"
                    role="region"
                    aria-label="Resumen de total estimado"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Total a Pagar</p>
                        <p className="text-3xl font-bold text-primary">
                          ${parseFloat(calculos.totalEstimado).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                        </p>
                        {formData.incluirCostoBascula && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Incluye -${formData.costoBascula} de báscula
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Peso a Pagar</p>
                        <p className="text-xl font-semibold">{calculos.pesoPagable} kg</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          ${precio || "0.00"}/kg
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PASO 2: CONTROL DE CALIDAD */}
              {paso >= 2 && (
                <Card className={cn("transition-all duration-300 border-l-4 mt-6", paso === 2 ? "border-l-amber-500 shadow-md" : "border-l-transparent opacity-60 grayscale")}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2">
                        <div className="bg-amber-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                        Control de Calidad
                      </CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPaso(1)}
                        aria-label="Volver al paso anterior"
                      >
                        Atrás
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* Slider de defectos */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label htmlFor={fieldIds.defectos} className="text-base font-semibold text-rose-600">
                          Porcentaje de Defectos
                        </Label>
                        <span
                          id="defectos-value"
                          className="text-2xl font-bold text-rose-600"
                          aria-live="polite"
                        >
                          {calidad.defectos}%
                        </span>
                      </div>
                      <Slider
                        id={fieldIds.defectos}
                        value={[calidad.defectos]}
                        max={30}
                        min={0}
                        step={1}
                        className="accent-rose-500"
                        onValueChange={(v) => setCalidad({ defectos: v[0] })}
                        aria-labelledby="defectos-label"
                        aria-describedby="defectos-scale"
                      />
                      <div
                        id="defectos-scale"
                        className="flex justify-between text-sm text-muted-foreground"
                      >
                        <span>0% (Excelente)</span>
                        <span>10% (Observado)</span>
                        <span>20% (Rechazado)</span>
                        <span>30% (Máximo)</span>
                      </div>
                    </div>

                    {/* Dictamen de calidad */}
                    <div
                      className={cn("p-4 rounded-lg border-2 flex items-center justify-between", bgCalidad)}
                      role="region"
                      aria-label="Dictamen de calidad"
                    >
                      <div>
                        <p className="font-semibold">Dictamen de Calidad:</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {estadoCalidad === "Aceptado"
                            ? "Fruta en condiciones óptimas para procesamiento"
                            : estadoCalidad === "Observado"
                              ? "Requiere revisión adicional antes del procesamiento"
                              : "No cumple con los estándares mínimos de calidad"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={cn("text-2xl font-bold uppercase block", colorCalidad)}
                          aria-live="polite"
                        >
                          {estadoCalidad}
                        </span>
                        {estadoCalidad === "Aceptado" && (
                          <CheckCircle
                            className="h-8 w-8 text-emerald-500 ml-auto mt-2"
                            aria-label="Calidad aceptada"
                          />
                        )}
                      </div>
                    </div>

                    {/* Botón para finalizar */}
                    <Button
                      type="button"
                      className="w-full h-12 text-lg"
                      onClick={() => setPaso(3)}
                      disabled={guardando}
                      aria-label="Continuar al resumen final"
                    >
                      {guardando ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" aria-hidden="true" />
                          Procesando...
                        </>
                      ) : (
                        "Continuar al Resumen"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Historial de Precios */}
              <Card className="module-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <History className="h-4 w-4" aria-hidden="true" />
                    Últimos 3 Precios
                  </CardTitle>
                  <CardDescription>
                    {productorSeleccionado ? `Para ${productorSeleccionado.nombre}` : "Selecciona un productor"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {productorId ? (
                    <div className="space-y-3">
                      {historialPrecios.map((h, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer text-left"
                          onClick={() => setPrecio(h.precio.toString())}
                          aria-label={`Aplicar precio de ${h.precio} del ${h.fecha}`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs" aria-hidden="true">
                              {idx + 1}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{h.fecha}</span>
                          </div>
                          <span className="font-semibold font-mono">${h.precio.toFixed(2)}</span>
                        </button>
                      ))}
                      <p className="text-xs text-muted-foreground text-center mt-4">
                        Clic para aplicar precio
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">
                        Selecciona un productor para ver su historial de precios
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cosecha Propia */}
            <TabsContent value="propia" className="space-y-6">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Formulario Principal */}
                <Card className="lg:col-span-2 module-card">
                  <CardHeader className="bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground rounded-t-xl px-6 py-4">
                    <CardTitle className="flex items-center gap-2">
                      🌿 Nueva Recepción - Cosecha Propia
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* Huerto */}
                    <div className="space-y-2">
                      <Label htmlFor={fieldIds.huerto} className="text-base font-semibold">
                        Huerto
                      </Label>
                      <Select value={huertoId} onValueChange={setHuertoId}>
                        <SelectTrigger id={fieldIds.huerto} className="h-14 text-base">
                          <SelectValue placeholder="Seleccionar huerto..." />
                        </SelectTrigger>
                        <SelectContent>
                          {huertos.map((h) => (
                            <SelectItem key={h.id} value={h.id} className="text-base py-3">
                              {h.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cortadores */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={fieldIds.cortador} className="text-base font-semibold">
                          Cortadores
                        </Label>
                        <Select onValueChange={addCortador}>
                          <SelectTrigger id={fieldIds.cortador} className="w-48">
                            <SelectValue placeholder="Agregar cortador..." />
                          </SelectTrigger>
                          <SelectContent>
                            {cortadores
                              .filter(c => !cortadoresLote.find(cl => cl.id === c.id))
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.nombre}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mostrar cortadores agregados */}
                      {cortadoresLote.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Cajas por Cortador</Label>
                          {cortadoresLote.map((cortador) => (
                            <div key={cortador.id} className="flex items-center gap-2">
                              <span className="flex-1">{cortador.nombre}</span>
                              <Input
                                type="number"
                                value={cortador.cajas}
                                onChange={(e) => updateCortadorCajas(cortador.id, parseInt(e.target.value) || 0)}
                                className="w-24"
                                placeholder="0"
                                aria-label={`Cajas para ${cortador.nombre}`}
                                id={`cajas-${cortador.id}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCortador(cortador.id)}
                                aria-label={`Eliminar ${cortador.nombre}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <Label htmlFor={fieldIds.defectos} className="text-rose-600 font-bold">
                            Defectos (%)
                          </Label>
                          <span className="font-bold text-rose-600">{calidad.defectos}%</span>
                        </div>
                        <Slider
                          id={fieldIds.defectos}
                          value={[calidad.defectos]}
                          max={30}
                          min={0}
                          step={1}
                          className="accent-rose-500"
                          onValueChange={(v) => setCalidad({ ...calidad, defectos: v[0] })}
                          disabled={paso > 2}
                          aria-label="Porcentaje de defectos"
                        />
                      </div>

                      <div
                        className={cn("p-2 rounded flex items-center justify-between border text-sm", bgCalidad)}
                        role="region"
                        aria-label="Estado de calidad"
                      >
                        <span className="font-semibold">Dictamen:</span>
                        <span className={cn("font-bold uppercase", colorCalidad)}>
                          {estadoCalidad}
                        </span>
                      </div>

                      {paso === 2 && (
                        <Button
                          type="button"
                          className="w-full"
                          disabled={pesoBascula === 0}
                          onClick={() => setPaso(3)}
                          aria-label="Confirmar y finalizar recepción"
                        >
                          Confirmar y Finalizar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* --- COLUMNA DERECHA: BOLETA VIRTUAL (4 Cols) --- */}
        <div className="lg:col-span-4">
          <Card className="h-full border-t-8 border-t-slate-800 shadow-2xl bg-slate-50/50 sticky top-4">
            <CardHeader className="bg-white border-b border-dashed pb-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">JBM CÍTRICOS PREMIUM</p>
                  <CardTitle className="text-2xl font-mono">TICKET #</CardTitle>
                </div>
                <QrCode className="h-10 w-10 text-slate-900" aria-hidden="true" />
              </div>
              <div className="mt-4 flex gap-2">
                <Badge variant="outline" className="text-xs uppercase font-bold text-slate-600">
                  {origen === "terceros" ? "COMPRA EXTERNA" : "COSECHA INTERNA"}
                </Badge>
                {estadoCalidad === "Rechazado" && <Badge variant="destructive">RECHAZADO</Badge>}
                {estadoCalidad === "Observado" && <Badge variant="secondary" className="bg-amber-100 text-amber-800">OBSERVADO</Badge>}
                {estadoCalidad === "Aceptado" && <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">ACEPTADO</Badge>}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Resumen del Lote */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Folio Físico</p>
                    <p className="font-semibold truncate font-mono text-lg">
                      {folioTicket || "---"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Destino</p>
                    <p className="font-semibold">
                      {zonasDestino.find(z => z.id === formData.zonaDestino)?.nombre.split(" ").slice(1).join(" ") || "---"}
                    </p>
                  </div>
                </div>

                {/* Pesos */}
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Bruto</p>
                      <p className="text-lg font-bold">{pesoBruto || "0"} kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Tara</p>
                      <p className="text-lg font-bold">{tara || "0"} kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Neto Físico</p>
                      <p className="text-lg font-bold text-primary">{calculos.netoFisico} kg</p>
                    </div>
                  </div>
                </div>

                {/* Resumen Financiero Corregido */}
                <Separator />
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Peso Neto Físico:</span>
                    <span className="font-mono">{calculos.netoFisico} kg</span>
                  </div>

                  {/* Descuento visible */}
                  <div className="flex justify-between text-sm text-rose-600">
                    <span>(-) Merma/Defecto ({calidad.defectos}%):</span>
                    <span className="font-mono font-bold">-{calculos.kilosMerma} kg</span>
                  </div>

                  <div className="flex justify-between text-base font-medium text-slate-800 border-t border-dashed pt-1">
                    <span>Peso a Pagar:</span>
                    <span className="font-mono">{calculos.pesoPagable} kg</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Precio/Kg:</span>
                    <span className="font-mono font-bold bg-yellow-100 px-2 rounded">${precio || "0.00"}</span>
                  </div>

                  {formData.incluirCostoBascula && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>(-) Cobro Báscula:</span>
                      <span>-${formData.costoBascula.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-xl pt-2 border-t-2 border-slate-800 mt-2">
                    <span className="font-black text-slate-900">A PAGAR:</span>
                    <span className="font-black text-emerald-600">
                      ${parseFloat(calculos.totalEstimado).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Calidad */}
                <div className={cn("p-3 rounded-lg border", bgCalidad)} role="region" aria-label="Estado de calidad">
                  <p className="text-xs text-muted-foreground mb-1">Estado de Calidad</p>
                  <div className="flex justify-between items-center">
                    <span className={cn("font-bold uppercase", colorCalidad)}>{estadoCalidad}</span>
                    <span className="text-sm font-semibold">{calidad.defectos}% defectos</span>
                  </div>
                </div>
              </div>

              {/* Botón Acción Final */}
              <div className="pt-4 mt-auto">
                <Button
                  type="button"
                  className={cn("w-full h-14 text-lg font-bold shadow-md transition-all hover:scale-[1.02]",
                    estadoCalidad === "Rechazado" ? "bg-rose-600 hover:bg-rose-700"
                      : estadoCalidad === "Observado" ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                  disabled={paso !== 3 || guardando}
                  onClick={handleGuardar}
                  aria-label={
                    estadoCalidad === "Rechazado" ? "Denegar entrada del lote" :
                      estadoCalidad === "Observado" ? "Guardar lote con observaciones" :
                        "Confirmar ingreso del lote"
                  }
                >
                  {guardando ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                      GUARDANDO...
                    </>
                  ) : estadoCalidad === "Rechazado" ? (
                    <>
                      <AlertOctagon className="mr-2" aria-hidden="true" />
                      DENEGAR ENTRADA
                    </>
                  ) : estadoCalidad === "Observado" ? (
                    <>
                      <AlertOctagon className="mr-2" aria-hidden="true" />
                      GUARDAR CON OBSERVACIONES
                    </>
                  ) : (
                    <>
                      <Save className="mr-2" aria-hidden="true" />
                      CONFIRMAR INGRESO
                    </>
                  )}
                </Button>
              </div>

              {/* Notas adicionales */}
              {formData.notas && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border" role="region" aria-label="Notas adicionales">
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm">{formData.notas}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}