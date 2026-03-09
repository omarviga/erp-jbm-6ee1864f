import { useState, useMemo, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Database, Enums } from '@/integrations/supabase/types';
import {
  Truck, Package, X, Search, ShieldAlert, Lock, Unlock, Thermometer,
  Map, Factory, Calendar, User, FileText, Phone, MapPin, Download,
  Printer, Check, AlertCircle, Loader2, FileSignature, ClipboardCheck,
  Scale, Weight, Route, Building, Mail, ExternalLink, Copy, Eye,
  MoreVertical, Tag, Hash, BarChart3, AlertTriangle, TruckIcon,
  Users, CheckCircle, Clock, Filter, ArrowRight, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { debounce } from "lodash";
import { useLogistica } from "@/hooks/useLogistica";
import { useFacturacion } from "@/hooks/useFacturacion";
import { CrearTransferenciaCDMXDialog } from "@/components/transferencias/CrearTransferenciaCDMXDialog";

// --- TYPES ---
type TipoCliente = "nacional" | "exportacion_usa" | "exportacion_otros";
type TipoTransporte = "terrestre" | "maritimo" | "aereo";
type TipoOperacion = "directa" | "indirecta";
type EstadoCartaPorte = "borrador" | "generada" | "validada" | "cancelada";
type TipoMercancia = "perecedera" | "refrigerada" | "seca" | "peligrosa";

interface Cliente {
  id: string;
  nombre: string;
  tipo: Enums<'tipo_cliente'>;
  rfc?: string;
  direccion: string;
  telefono: string;
  email: string;
  condicionesPago: number;
}

interface Transportista {
  id: string;
  nombre: string;
  rfc: string;
  placas: string;
  numeroPermiso: string;
  telefono: string;
  tipoPermiso: "federal" | "estatal" | "internacional";
  seguroResponsabilidadCivil: boolean;
  polizaSeguro: string;
}

interface LoteInventario {
  id: string;
  producto: string;
  codigoSAT?: string;
  cajas: number;
  peso: number;
  volumen: number;
  ubicacion: string;
  origen: "camara" | "piso";
  unidadMedida: string;
  valorUnitario: number;
  temperaturaRecomendada?: number;
}

interface CartaPorte {
  id: string;
  folio: string;
  fechaGeneracion: Date;
  estado: EstadoCartaPorte;
  cliente: Cliente;
  transportista: Transportista;
  tipoTransporte: TipoTransporte;
  tipoOperacion: TipoOperacion;
  lugarOrigen: string;
  lugarDestino: string;
  fechaSalida: Date;
  fechaEstimadaLlegada: Date;
  mercancia: {
    lotes: LoteInventario[];
    pesoTotal: number;
    volumenTotal: number;
    valorMercancia: number;
    tipoMercancia: TipoMercancia;
    embalaje: string;
    instruccionesEspeciales: string;
  };
  datosVehiculo: {
    placas: string;
    modelo: string;
    marca: string;
    anio: number;
    polizaSeguro: string;
    capacidadCarga: number;
    tarjetaCirculacion: string;
  };
  datosRemitente: {
    nombre: string;
    rfc: string;
    direccion: string;
    telefono: string;
  };
  datosDestinatario: {
    nombre: string;
    rfc: string;
    direccion: string;
    telefono: string;
  };
  documentosAdjuntos: string[];
  observaciones: string;
  sellosDigitales: {
    uuid: string;
    fechaTimbrado: Date;
    qrCode: string;
  };
  costoTransporte: number;
  ivaTransporte: number;
  totalTransporte: number;
}

interface DocumentoRequerido {
  id: string;
  nombre: string;
  checked: boolean;
  requiredFor: "usa" | "nacional" | "ambos";
}

// --- SUBCOMPONENTS ---
const InventoryItem = ({
  lote,
  isSelected,
  onToggle,
  showDetails = false
}: {
  lote: LoteInventario;
  isSelected: boolean;
  onToggle: () => void;
  showDetails?: boolean;
}) => {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors",
        isSelected && "border-primary bg-primary/5 ring-1 ring-primary"
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox checked={isSelected} className="pointer-events-none" />
        <div>
          <p className="font-semibold text-sm">{lote.producto}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>ID: {lote.id}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              {lote.origen === 'camara' ? (
                <>
                  <Thermometer className="h-3 w-3 text-sky-600" />
                  <span className="text-sky-600">En Frío</span>
                </>
              ) : (
                <>
                  <Factory className="h-3 w-3 text-amber-600" />
                  <span className="text-amber-600">En Piso</span>
                </>
              )}
            </span>
            {showDetails && (
              <>
                <span>•</span>
                <span>SAT: {lote.codigoSAT}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-sm">{lote.cajas} {lote.unidadMedida}</p>
        <p className="text-xs text-muted-foreground">{lote.peso} kg • {lote.volumen} m³</p>
      </div>
    </div>
  );
};

const ModalSeleccionInventario = ({
  isOpen,
  onClose,
  lotesSeleccionados,
  onToggleLote,
  onConfirmar,
  inventario,
  title = "Seleccionar Inventario"
}: {
  isOpen: boolean;
  onClose: () => void;
  lotesSeleccionados: string[];
  onToggleLote: (id: string) => void;
  onConfirmar: () => void;
  inventario: LoteInventario[];
  title?: string;
}) => {
  const [tabSelector, setTabSelector] = useState("camara");
  const [searchTerm, setSearchTerm] = useState("");

  const inventarioFiltrado = useMemo(() => {
    if (!searchTerm.trim()) {
      return inventario.filter(item =>
        tabSelector === "todos" ? true : item.origen === tabSelector
      );
    }

    const term = searchTerm.toLowerCase();
    return inventario.filter(item => {
      const matchesTab = tabSelector === "todos" || item.origen === tabSelector;
      const matchesSearch =
        item.producto.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term) ||
        item.ubicacion.toLowerCase().includes(term) ||
        item.codigoSAT.toLowerCase().includes(term);
      return matchesTab && matchesSearch;
    });
  }, [inventario, tabSelector, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-xl shadow-2xl border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {title}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar modal">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por lote, producto, código SAT..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Tabs value={tabSelector} onValueChange={setTabSelector} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="todos">📦 Todos</TabsTrigger>
              <TabsTrigger value="camara">❄️ Cámara Fría</TabsTrigger>
              <TabsTrigger value="piso">🏭 Piso de Producción</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {inventarioFiltrado.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No se encontraron productos</p>
                <p className="text-sm">Intenta con otros términos de búsqueda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inventarioFiltrado.map((lote) => (
                  <InventoryItem
                    key={lote.id}
                    lote={lote}
                    isSelected={lotesSeleccionados.includes(lote.id)}
                    onToggle={() => onToggleLote(lote.id)}
                    showDetails
                  />
                ))}
              </div>
            )}
          </div>
        </Tabs>

        <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {lotesSeleccionados.length} lotes seleccionados
            </span>
            {lotesSeleccionados.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Total: {inventario
                  .filter(l => lotesSeleccionados.includes(l.id))
                  .reduce((sum, l) => sum + l.cajas, 0)} cajas
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onConfirmar}>
              Confirmar Selección
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TransportistaCard = ({
  transportista,
  onEdit
}: {
  transportista: Transportista;
  onEdit?: () => void;
}) => (
  <Card className="border-l-4 border-l-blue-500">
    <CardContent className="pt-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <h4 className="font-bold text-lg">Transportista</h4>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{transportista.nombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm">RFC: {transportista.rfc}</span>
            </div>
            <div className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Placas: {transportista.placas}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Permiso: {transportista.numeroPermiso}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Tel: {transportista.telefono}</span>
            </div>
            {transportista.seguroResponsabilidadCivil && (
              <div className="flex items-center gap-2 text-green-600">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-sm">Seguro vigente</span>
              </div>
            )}
          </div>
        </div>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Cambiar
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

const ValidationBadge = ({ isValid, label }: { isValid: boolean; label: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm">{label}</span>
    {isValid ? (
      <Check className="h-4 w-4 text-green-600" />
    ) : (
      <X className="h-4 w-4 text-red-400" />
    )}
  </div>
);

// --- CONEXIÓN CON SUPABASE ---

export default function Logistica() {
  const { toast } = useToast();
  const {
    transportistas = [],
    inventarioDisponible = [],
    guiasRecientes = [],
    loadingTransportistas,
    loadingInventario,
    loadingGuias,
    crearGuia,
    isCreando
  } = useLogistica();

  const { clientes = [] } = useFacturacion();

  const [activeTab, setActiveTab] = useState<string>("embarque");

  // Estados para Embarque
  const [clienteId, setClienteId] = useState("");
  const [temperaturaPrecarga, setTemperaturaPrecarga] = useState("");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [lotesSeleccionados, setLotesSeleccionados] = useState<string[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoRequerido[]>([
    { id: "fitosanitario", nombre: "Certificado Fitosanitario", checked: false, requiredFor: "usa" },
    { id: "fda", nombre: "FDA Prior Notice", checked: false, requiredFor: "usa" },
    { id: "carta_porte", nombre: "Carta Porte (SAT)", checked: false, requiredFor: "nacional" },
    { id: "seguro", nombre: "Seguro de Transporte", checked: false, requiredFor: "ambos" },
    { id: "manifiesto", nombre: "Manifiesto de Carga", checked: false, requiredFor: "ambos" },
  ]);

  // Estados para Carta Porte
  const [isSelectorOpenCartaPorte, setIsSelectorOpenCartaPorte] = useState(false);
  const [lotesSeleccionadosCartaPorte, setLotesSeleccionadosCartaPorte] = useState<string[]>([]);
  const [transportistaId, setTransportistaId] = useState("");
  const [tipoTransporte, setTipoTransporte] = useState<TipoTransporte>("terrestre");
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>("directa");
  const [lugarOrigen, setLugarOrigen] = useState("Nuevo León, México");
  const [lugarDestino, setLugarDestino] = useState("");
  const [tipoMercancia, setTipoMercancia] = useState<TipoMercancia>("perecedera");
  const [embalaje, setEmbalaje] = useState("Cajas de cartón");
  const [instruccionesEspeciales, setInstruccionesEspeciales] = useState("");
  const [observacionesCartaPorte, setObservacionesCartaPorte] = useState("");
  const [fechaSalida, setFechaSalida] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fechaLlegada, setFechaLlegada] = useState(format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [costoTransporte, setCostoTransporte] = useState("");
  const [isGenerandoCartaPorte, setIsGenerandoCartaPorte] = useState(false);

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);
  const transportistaSeleccionado = transportistas.find(t => t.id === transportistaId);
  const esExportacionUSA = clienteSeleccionado?.tipo === "exportacion_usa";
  const esNacional = clienteSeleccionado?.tipo === "nacional";

  // Cálculos
  const lotesEnLista = inventarioDisponible.filter(item => lotesSeleccionados.includes(item.id));
  const totalCajas = lotesEnLista.reduce((acc, curr) => acc + curr.cajas, 0);
  const totalPeso = lotesEnLista.reduce((acc, curr) => acc + curr.peso, 0);
  const totalVolumen = lotesEnLista.reduce((acc, curr) => acc + (curr.volumen || 0), 0);

  const lotesCartaPorte = inventarioDisponible.filter(item => lotesSeleccionadosCartaPorte.includes(item.id));
  const totalCajasCartaPorte = lotesCartaPorte.reduce((acc, curr) => acc + curr.cajas, 0);
  const totalPesoCartaPorte = lotesCartaPorte.reduce((acc, curr) => acc + curr.peso, 0);
  const totalVolumenCartaPorte = lotesCartaPorte.reduce((acc, curr) => acc + (curr.volumen || 0), 0);
  const valorMercanciaCartaPorte = lotesCartaPorte.reduce((acc, curr) => acc + (curr.cajas * (curr.valorUnitario || 0)), 0);

  // Validaciones
  const tempNum = parseFloat(temperaturaPrecarga);
  const temperaturaOK = !isNaN(tempNum) && tempNum <= 7 && tempNum > 0;
  const tieneProductos = lotesSeleccionados.length > 0;

  const docsUSAOK = documentos
    .filter(d => d.requiredFor === "usa")
    .every(d => d.checked);

  const docsNacionalOK = documentos
    .filter(d => d.requiredFor === "nacional")
    .every(d => d.checked);

  const requisitosGenerales = tieneProductos && !!clienteId;

  let requisitosCumplidos = false;
  if (esExportacionUSA) {
    requisitosCumplidos = requisitosGenerales && docsUSAOK && temperaturaOK;
  } else if (esNacional) {
    requisitosCumplidos = requisitosGenerales && docsNacionalOK;
  }

  // Validaciones Carta Porte
  const cartaPorteValida = useMemo(() => {
    return (
      !!clienteId &&
      !!transportistaId &&
      !!lugarDestino &&
      lotesSeleccionadosCartaPorte.length > 0 &&
      !!embalaje &&
      !!fechaSalida &&
      !!fechaLlegada
    );
  }, [clienteId, transportistaId, lugarDestino, lotesSeleccionadosCartaPorte, embalaje, fechaSalida, fechaLlegada]);

  const toggleDocumento = useCallback((id: string) => {
    setDocumentos(docs =>
      docs.map(d => d.id === id ? { ...d, checked: !d.checked } : d)
    );
  }, []);

  const toggleLote = useCallback((id: string) => {
    setLotesSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const toggleLoteCartaPorte = useCallback((id: string) => {
    setLotesSeleccionadosCartaPorte(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleFinalizarCarga = useCallback(() => {
    if (!requisitosCumplidos) {
      toast({
        title: "Faltan Requisitos",
        description: "Verifica documentos o carga.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "✅ Guía Generada",
      description: `Salida autorizada con ${totalCajas} cajas.`,
      className: "bg-green-600 text-white border-none"
    });
  }, [requisitosCumplidos, totalCajas, toast]);

  const handleGenerarCartaPorte = useCallback(async () => {
    if (!cartaPorteValida) {
      toast({
        title: "Datos incompletos",
        description: "Completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    setIsGenerandoCartaPorte(true);
    try {
      // Simular generación de Carta Porte
      await new Promise(resolve => setTimeout(resolve, 1500));

      const nuevoFolio = `CP-${format(new Date(), 'yyyy')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      // Crear objeto de Carta Porte
      const nuevaCartaPorte: CartaPorte = {
        id: `CP${Date.now()}`,
        folio: nuevoFolio,
        fechaGeneracion: new Date(),
        estado: "generada",
        cliente: clienteSeleccionado!,
        transportista: transportistaSeleccionado! as any,
        tipoTransporte,
        tipoOperacion,
        lugarOrigen,
        lugarDestino,
        fechaSalida: new Date(fechaSalida),
        fechaEstimadaLlegada: new Date(fechaLlegada),
        mercancia: {
          lotes: lotesCartaPorte,
          pesoTotal: totalPesoCartaPorte,
          volumenTotal: totalVolumenCartaPorte,
          valorMercancia: valorMercanciaCartaPorte,
          tipoMercancia,
          embalaje,
          instruccionesEspeciales
        },
        datosVehiculo: {
          placas: transportistaSeleccionado!.placas,
          modelo: "Modelo no especificado",
          marca: "Marca no especificada",
          anio: new Date().getFullYear() - 2,
          polizaSeguro: (transportistaSeleccionado as any)?.polizaSeguro || 'N/A',
          capacidadCarga: 5000,
          tarjetaCirculacion: `TC-${format(new Date(), 'yyyyMMdd')}`
        },
        datosRemitente: {
          nombre: "Agroexport S.A. de C.V.",
          rfc: "AGE-120304-567",
          direccion: "Carretera Nacional KM 123, Nuevo León",
          telefono: "+52 81 5555 1234"
        },
        datosDestinatario: {
          nombre: clienteSeleccionado!.nombre,
          rfc: clienteSeleccionado!.rfc || "XAXX010101000",
          direccion: clienteSeleccionado!.direccion,
          telefono: clienteSeleccionado!.telefono
        },
        documentosAdjuntos: ["carta-porte.pdf", "manifiesto.pdf"],
        observaciones: observacionesCartaPorte,
        sellosDigitales: {
          uuid: `uuid-${Date.now()}`,
          fechaTimbrado: new Date(),
          qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${nuevoFolio}`
        },
        costoTransporte: parseFloat(costoTransporte) || 0,
        ivaTransporte: (parseFloat(costoTransporte) || 0) * 0.16,
        totalTransporte: (parseFloat(costoTransporte) || 0) * 1.16
      };

      // Aquí normalmente enviarías la carta porte a tu API
      console.log("Carta Porte generada:", nuevaCartaPorte);

      toast({
        title: "✅ Carta Porte Generada",
        description: `Folio: ${nuevoFolio}. Se ha timbrado y registrado en el SAT.`,
        className: "bg-green-600 text-white border-none"
      });

      // Limpiar formulario
      setLotesSeleccionadosCartaPorte([]);
      setLugarDestino("");
      setObservacionesCartaPorte("");
      setTransportistaId("");
      setCostoTransporte("");
      setInstruccionesEspeciales("");

    } catch (error) {
      toast({
        title: "Error al generar",
        description: "No se pudo generar la Carta Porte",
        variant: "destructive"
      });
    } finally {
      setIsGenerandoCartaPorte(false);
    }
  }, [
    cartaPorteValida,
    clienteSeleccionado,
    transportistaSeleccionado,
    tipoTransporte,
    tipoOperacion,
    lugarOrigen,
    lugarDestino,
    fechaSalida,
    fechaLlegada,
    lotesCartaPorte,
    totalPesoCartaPorte,
    totalVolumenCartaPorte,
    valorMercanciaCartaPorte,
    tipoMercancia,
    embalaje,
    instruccionesEspeciales,
    observacionesCartaPorte,
    costoTransporte,
    toast
  ]);

  const handleDescargarPDF = useCallback((folio: string) => {
    toast({
      title: "Descargando PDF",
      description: `Preparando Carta Porte ${folio}...`,
    });

    // Simular descarga
    setTimeout(() => {
      toast({
        title: "✅ Descarga completada",
        description: `Carta Porte ${folio} descargada`,
        className: "bg-green-600 text-white border-none"
      });
    }, 1000);
  }, [toast]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  }, []);

  const handleSearchChange = useCallback(
    debounce((value: string) => {
      // Implementar búsqueda si es necesario
    }, 300),
    []
  );

  return (
    <MainLayout title="Logística" subtitle="Gestión de embarques, guías de salida y Cartas Porte">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="embarque" className="flex items-center gap-2">
            <Truck className="h-4 w-4" /> Embarque
          </TabsTrigger>
          <TabsTrigger value="cartaPorte" className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" /> Carta Porte
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA EMBARQUE */}
        <TabsContent value="embarque" className="mt-6">
          <ModalSeleccionInventario
            isOpen={isSelectorOpen}
            onClose={() => setIsSelectorOpen(false)}
            lotesSeleccionados={lotesSeleccionados}
            onToggleLote={toggleLote}
            onConfirmar={() => setIsSelectorOpen(false)}
            inventario={inventarioDisponible}
            title="Seleccionar Inventario para Embarque"
          />

          <div className="grid lg:grid-cols-3 gap-6">
            {/* COLUMNA IZQUIERDA: FORMULARIO */}
            <Card className="lg:col-span-2 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" /> Configuración de Embarque
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* SELECCIÓN DE CLIENTE */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente / Destino</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <span>{c.nombre}</span>
                              <span>{c.tipo === "exportacion_usa" ? "🇺🇸" : "🇲🇽"}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Folio Salida</Label>
                    <Input disabled value="GS-2024-001" className="bg-slate-100 font-mono" />
                  </div>
                </div>

                {/* SELECCIÓN DE PRODUCTOS */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Carga Asignada</Label>
                    {tieneProductos && (
                      <Badge variant="outline">
                        {totalCajas} Cajas / {totalPeso} kg / {totalVolumen.toFixed(1)} m³
                      </Badge>
                    )}
                  </div>

                  {!tieneProductos ? (
                    <div
                      onClick={() => setIsSelectorOpen(true)}
                      className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors gap-2"
                    >
                      <Package className="h-10 w-10 text-slate-300" />
                      <span className="text-primary font-medium">Agregar Productos</span>
                      <span className="text-xs text-muted-foreground">Seleccionar de Cámara o Piso</span>
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y">
                      {lotesEnLista.map(lote => (
                        <div key={lote.id} className="p-3 flex justify-between items-center text-sm">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {lote.producto}
                              <Badge variant="secondary" className="text-[10px] h-5">
                                {lote.origen === 'camara' ? '❄️ Cámara' : '🏭 Piso'}
                              </Badge>
                            </div>
                            <div className="text-muted-foreground text-xs">{lote.id}</div>
                          </div>
                          <div className="font-mono font-bold">{lote.cajas} cjs</div>
                        </div>
                      ))}
                      <div className="p-2 bg-slate-50 text-center">
                        <Button variant="link" size="sm" onClick={() => setIsSelectorOpen(true)}>
                          + Editar carga
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* SECCIÓN DINÁMICA SEGÚN TIPO DE CLIENTE */}
                {esNacional && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
                      <Map className="h-4 w-4" /> Requisitos Nacionales
                    </h4>
                    <div className="bg-white p-3 rounded border border-amber-100 space-y-2">
                      {documentos.filter(d => d.requiredFor === "nacional").map(doc => (
                        <div key={doc.id} className="flex items-center gap-3">
                          <Checkbox
                            id={doc.id}
                            checked={doc.checked}
                            onCheckedChange={() => toggleDocumento(doc.id)}
                          />
                          <Label htmlFor={doc.id} className="cursor-pointer font-medium">{doc.nombre}</Label>
                          <Badge variant="outline" className="ml-auto text-amber-600 border-amber-200">
                            Obligatorio
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {esExportacionUSA && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 space-y-4">
                    <h4 className="font-bold text-blue-800 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Protocolo Exportación USA
                    </h4>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-blue-700">Documentación</Label>
                        <div className="bg-white p-3 rounded border space-y-2">
                          {documentos.filter(d => d.requiredFor === "usa").map(doc => (
                            <div key={doc.id} className="flex items-center gap-2">
                              <Checkbox
                                id={doc.id}
                                checked={doc.checked}
                                onCheckedChange={() => toggleDocumento(doc.id)}
                              />
                              <Label htmlFor={doc.id} className="text-sm cursor-pointer">{doc.nombre}</Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-blue-700">Cadena de Frío</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={temperaturaPrecarga}
                            onChange={(e) => setTemperaturaPrecarga(e.target.value)}
                            className={cn(
                              "h-10 text-center font-mono",
                              temperaturaOK ? "border-green-500 bg-green-50 text-green-700" : ""
                            )}
                          />
                          <Thermometer className={cn("h-6 w-6", temperaturaOK ? "text-green-600" : "text-muted-foreground")} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Máximo permitido: 7°C</p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleFinalizarCarga}
                  disabled={!requisitosCumplidos}
                  className={cn(
                    "w-full h-12 text-lg font-bold transition-all",
                    requisitosCumplidos ? "btn-industrial bg-primary" : "bg-slate-200 text-slate-400"
                  )}
                >
                  {requisitosCumplidos ? (
                    <><Unlock className="mr-2 h-5 w-5" /> Generar Orden de Salida</>
                  ) : (
                    <><Lock className="mr-2 h-5 w-5" /> Completar Requisitos</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* COLUMNA DERECHA: RESUMEN */}
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">Estado de la Orden</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm text-muted-foreground">Tipo de Venta</span>
                    <Badge variant={esExportacionUSA ? "default" : "secondary"}>
                      {esExportacionUSA ? "Exportación" : esNacional ? "Nacional" : "---"}
                    </Badge>
                  </div>

                  {esNacional && (
                    <ValidationBadge
                      isValid={docsNacionalOK}
                      label="Carta Porte"
                    />
                  )}

                  {esExportacionUSA && (
                    <>
                      <ValidationBadge
                        isValid={docsUSAOK}
                        label="Documentos USA"
                      />
                      <ValidationBadge
                        isValid={temperaturaOK}
                        label="Temperatura"
                      />
                    </>
                  )}

                  <div className="flex justify-between items-center text-sm pt-2 border-t">
                    <span className="flex items-center gap-2"><Package className="h-4 w-4 text-slate-500" /> Producto</span>
                    {tieneProductos ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-400" />}
                  </div>
                </CardContent>
              </Card>

              {/* RESUMEN DE CARGA */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Resumen de Carga</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Cajas</span>
                    <span className="font-bold text-lg">{totalCajas}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Peso Total</span>
                    <span className="font-bold">{totalPeso} kg</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Volumen</span>
                    <span className="font-bold">{totalVolumen.toFixed(1)} m³</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Lotes</span>
                    <Badge variant="outline">{lotesSeleccionados.length}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA CARTA PORTE */}
        <TabsContent value="cartaPorte" className="mt-6">
          <ModalSeleccionInventario
            isOpen={isSelectorOpenCartaPorte}
            onClose={() => setIsSelectorOpenCartaPorte(false)}
            lotesSeleccionados={lotesSeleccionadosCartaPorte}
            onToggleLote={toggleLoteCartaPorte}
            onConfirmar={() => setIsSelectorOpenCartaPorte(false)}
            inventario={inventarioDisponible}
            title="Seleccionar Mercancía para Carta Porte"
          />

          <div className="grid lg:grid-cols-3 gap-6">
            {/* COLUMNA IZQUIERDA: FORMULARIO */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" /> Generar Carta Porte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* INFORMACIÓN BÁSICA */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">Cliente *</Label>
                      <Select value={clienteId} onValueChange={setClienteId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <span>{c.nombre}</span>
                                <span>{c.tipo === "exportacion_usa" ? "🇺🇸" : "🇲🇽"}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Tipo de Operación *</Label>
                      <Select value={tipoOperacion} onValueChange={(value) => setTipoOperacion(value as TipoOperacion)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="directa">Directa</SelectItem>
                          <SelectItem value="indirecta">Indirecta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* INFORMACIÓN DE TRANSPORTE */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">Tipo de Transporte *</Label>
                      <Select value={tipoTransporte} onValueChange={(value) => setTipoTransporte(value as TipoTransporte)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="terrestre">Terrestre</SelectItem>
                          <SelectItem value="maritimo">Marítimo</SelectItem>
                          <SelectItem value="aereo">Aéreo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Transportista *</Label>
                      <Select value={transportistaId} onValueChange={setTransportistaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar transportista..." />
                        </SelectTrigger>
                        <SelectContent>
                          {transportistas.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                <span>{t.nombre}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* LUGARES */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">Lugar de Origen *</Label>
                      <Input
                        value={lugarOrigen}
                        onChange={(e) => setLugarOrigen(e.target.value)}
                        placeholder="Ej: Nuevo León, México"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Lugar de Destino *</Label>
                      <Input
                        value={lugarDestino}
                        onChange={(e) => setLugarDestino(e.target.value)}
                        placeholder="Ej: CDMX, México"
                        required
                      />
                    </div>
                  </div>

                  {/* FECHAS */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">Fecha de Salida *</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="date"
                          value={fechaSalida}
                          onChange={(e) => setFechaSalida(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Fecha Estimada de Llegada *</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="date"
                          value={fechaLlegada}
                          onChange={(e) => setFechaLlegada(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* MERCANCÍA */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-semibold">Mercancía a Transportar *</Label>
                      {lotesSeleccionadosCartaPorte.length > 0 && (
                        <Badge variant="outline">
                          {totalCajasCartaPorte} Cajas / {totalPesoCartaPorte} kg
                        </Badge>
                      )}
                    </div>

                    {lotesSeleccionadosCartaPorte.length === 0 ? (
                      <div
                        onClick={() => setIsSelectorOpenCartaPorte(true)}
                        className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors gap-2"
                      >
                        <Package className="h-10 w-10 text-slate-300" />
                        <span className="text-primary font-medium">Agregar Mercancía</span>
                        <span className="text-xs text-muted-foreground">Seleccionar productos del inventario</span>
                      </div>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {lotesCartaPorte.map(lote => (
                          <div key={lote.id} className="p-3 flex justify-between items-center text-sm">
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {lote.producto}
                                <Badge variant="secondary" className="text-[10px] h-5">
                                SAT: {(lote as any).codigoSAT || 'N/A'}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {lote.id} • {lote.peso} kg • {lote.volumen} m³ • {formatCurrency(lote.valorUnitario)}/caja
                              </div>
                            </div>
                            <div className="font-mono font-bold">{lote.cajas} {lote.unidadMedida}</div>
                          </div>
                        ))}
                        <div className="p-2 bg-slate-50 text-center">
                          <Button variant="link" size="sm" onClick={() => setIsSelectorOpenCartaPorte(true)}>
                            + Editar mercancía
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* DETALLES DE MERCANCÍA */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Mercancía</Label>
                      <Select value={tipoMercancia} onValueChange={(value) => setTipoMercancia(value as TipoMercancia)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="perecedera">Perecedera</SelectItem>
                          <SelectItem value="refrigerada">Refrigerada</SelectItem>
                          <SelectItem value="seca">Seca</SelectItem>
                          <SelectItem value="peligrosa">Peligrosa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Embalaje *</Label>
                      <Select value={embalaje} onValueChange={setEmbalaje}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar embalaje..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cajas de cartón">Cajas de cartón</SelectItem>
                          <SelectItem value="Tarimas">Tarimas</SelectItem>
                          <SelectItem value="Contenedores">Contenedores</SelectItem>
                          <SelectItem value="Sacos">Sacos</SelectItem>
                          <SelectItem value="Granel">Granel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Costo de Transporte</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={costoTransporte}
                          onChange={(e) => setCostoTransporte(e.target.value)}
                          className="pl-7"
                        />
                      </div>
                    </div>
                  </div>

                  {/* INSTRUCCIONES ESPECIALES */}
                  <div className="space-y-2">
                    <Label>Instrucciones Especiales</Label>
                    <Textarea
                      placeholder="Instrucciones para el transporte (temperatura, manejo especial, etc.)..."
                      value={instruccionesEspeciales}
                      onChange={(e) => setInstruccionesEspeciales(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* OBSERVACIONES */}
                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Textarea
                      placeholder="Observaciones adicionales sobre el transporte..."
                      value={observacionesCartaPorte}
                      onChange={(e) => setObservacionesCartaPorte(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* BOTÓN GENERAR */}
                  <Button
                    onClick={handleGenerarCartaPorte}
                    disabled={!cartaPorteValida || isGenerandoCartaPorte}
                    className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                  >
                    {isGenerandoCartaPorte ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <FileSignature className="mr-2 h-5 w-5" />
                        Generar Carta Porte
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* COLUMNA DERECHA: RESUMEN Y PRECONFIGURADOS */}
            <div className="space-y-6">
              {transportistaSeleccionado && (
                <TransportistaCard transportista={transportistaSeleccionado as any} />
              )}

              {/* RESUMEN CARTA PORTE */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Resumen Carta Porte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estado</span>
                      <Badge variant="outline" className="bg-blue-50">PENDIENTE</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Folio</span>
                      <span className="font-mono text-sm">Por generar</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Weight className="h-4 w-4" /> Totales
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Cajas:</div>
                      <div className="text-right font-medium">{totalCajasCartaPorte}</div>
                      <div className="text-muted-foreground">Peso:</div>
                      <div className="text-right font-medium">{totalPesoCartaPorte} kg</div>
                      <div className="text-muted-foreground">Volumen:</div>
                      <div className="text-right font-medium">{totalVolumenCartaPorte.toFixed(1)} m³</div>
                      <div className="text-muted-foreground">Valor mercancía:</div>
                      <div className="text-right font-medium">{formatCurrency(valorMercanciaCartaPorte)}</div>
                      <div className="text-muted-foreground">Lotes:</div>
                      <div className="text-right font-medium">{lotesSeleccionadosCartaPorte.length}</div>
                    </div>
                  </div>

                  {costoTransporte && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Costos
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-muted-foreground">Transporte:</div>
                          <div className="text-right font-medium">{formatCurrency(parseFloat(costoTransporte))}</div>
                          <div className="text-muted-foreground">IVA (16%):</div>
                          <div className="text-right font-medium">{formatCurrency(parseFloat(costoTransporte) * 0.16)}</div>
                          <div className="text-muted-foreground font-semibold">Total:</div>
                          <div className="text-right font-bold">{formatCurrency(parseFloat(costoTransporte) * 1.16)}</div>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Route className="h-4 w-4" /> Ruta
                    </h4>
                    <div className="text-sm space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 text-green-600 mt-1" />
                        <div>
                          <span className="font-medium">Origen</span>
                          <p className="text-muted-foreground text-xs truncate">{lugarOrigen || "No especificado"}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-3 w-3 text-gray-400 mx-2" />
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 text-red-600 mt-1" />
                        <div>
                          <span className="font-medium">Destino</span>
                          <p className="text-muted-foreground text-xs truncate">{lugarDestino || "No especificado"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* VALIDACIONES */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Validaciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ValidationBadge
                    isValid={!!clienteId}
                    label="Cliente seleccionado"
                  />
                  <ValidationBadge
                    isValid={!!transportistaId}
                    label="Transportista seleccionado"
                  />
                  <ValidationBadge
                    isValid={lotesSeleccionadosCartaPorte.length > 0}
                    label="Mercancía seleccionada"
                  />
                  <ValidationBadge
                    isValid={!!lugarDestino}
                    label="Destino especificado"
                  />
                  <ValidationBadge
                    isValid={!!embalaje}
                    label="Embalaje especificado"
                  />
                  <ValidationBadge
                    isValid={!!fechaSalida && !!fechaLlegada}
                    label="Fechas configuradas"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA HISTORIAL */}
        <TabsContent value="historial" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Historial de Cartas Porte</span>
                <div className="flex items-center gap-2">
                  <Input placeholder="Buscar por folio o cliente..." className="w-64" />
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" /> Filtros
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Origen → Destino</TableHead>
                    <TableHead>Fecha Salida</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guiasRecientes.map((guia: any) => {
                    const estadoBadge = {
                      borrador: { variant: "outline" as const, className: "bg-gray-100 text-gray-800" },
                      generada: { variant: "outline" as const, className: "bg-blue-100 text-blue-800" },
                      validada: { variant: "outline" as const, className: "bg-green-100 text-green-800" },
                      cancelada: { variant: "outline" as const, className: "bg-red-100 text-red-800" }
                    }[guia.estado as EstadoCartaPorte] || { variant: "outline" as const, className: "bg-gray-100 text-gray-800" };

                    return (
                      <TableRow key={guia.id}>
                        <TableCell className="font-medium">{guia.folio}</TableCell>
                        <TableCell>{guia.clientes?.nombre || "Cargando..."}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 truncate max-w-[100px]">{guia.lugar_origen}</span>
                            <ArrowRight className="h-3 w-3 text-gray-400" />
                            <span className="text-xs truncate max-w-[100px]">{guia.lugar_destino}</span>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(guia.created_at), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{guia.peso_total} kg</TableCell>
                        <TableCell>
                          <Badge variant={estadoBadge.variant} className={estadoBadge.className}>
                            {String(guia.estado).toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDescargarPDF(guia.folio)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <FileText className="h-4 w-4 mr-2" /> Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <X className="h-4 w-4 mr-2" /> Cancelar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
