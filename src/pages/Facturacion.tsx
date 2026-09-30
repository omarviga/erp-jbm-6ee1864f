import { useState, useMemo, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Plus,
  Trash2,
  Send,
  Printer,
  Save,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  Copy,
  MoreVertical,
  Users,
  Package,
  DollarSign,
  CalendarDays,
  FileSignature,
  CreditCard,
  Banknote,
  Building,
  MapPin,
  Mail,
  Phone,
  X,
  Check,
  Loader2,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFacturacion } from "@/hooks/useFacturacion";
import type { Factura as FacturaDB } from "@/hooks/useFacturacion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CobranzaTab } from "@/components/facturacion/CobranzaTab";
import { openPrintDocument } from "@/lib/print/openPrintDocument";
import { renderFacturaHtml } from "@/lib/print/renderFacturaHtml";

// --- TYPES ---
type InvoiceStatus = "borrador" | "enviada" | "pagada" | "vencida" | "cancelada";
type PaymentMethod = "transferencia" | "efectivo" | "tarjeta" | "cheque" | "credito" | "por_definir";
type UsoCFDI = "G01" | "G02" | "G03" | "P01";
type FormaPago = "Pago en una sola exhibición" | "Pago en parcialidades";
type Currency = "MXN" | "USD";

interface Cliente {
  id: string;
  nombre: string;
  rfc: string;
  direccion: string;
  email: string;
  telefono: string;
  condicionesPago: number;
  moneda: Currency;
}

interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  precio: number;
  unidad: string;
  categoria: "producto" | "servicio";
  iva: boolean;
  ieps?: number;
  cantidadDisponible: number;
  peso?: number;
  ubicacion?: string;
}

interface LineItem {
  id: string;
  productoId: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  unidad: string;
  iva: boolean;
  ieps?: number;
  descuento?: number;
  cantidadDisponible: number;
}

interface Invoice {
  folio: string;
  cliente: Cliente;
  fechaEmision: Date;
  fechaVencimiento: Date;
  items: LineItem[];
  status: InvoiceStatus;
  subtotal: number;
  iva: number;
  retenciones: number;
  total: number;
  notas: string;
  terminos: string;
  metodoPago: PaymentMethod;
  usoCFDI: UsoCFDI;
  formaPago: FormaPago;
}

interface CalculosFactura {
  subtotal: number;
  iva: number;
  ieps: number;
  descuentos: number;
  total: number;
}

type ProductoConIEPS = Producto & {
  ieps?: number;
};

// --- CUSTOM HOOKS ---
const useInvoiceCalculations = (items: LineItem[]) => {
  return useMemo((): CalculosFactura => {
    let subtotalCalc = 0;
    let ivaCalc = 0;
    let iepsCalc = 0;
    let descuentosCalc = 0;

    items.forEach(item => {
      const descuento = item.descuento || 0;
      const precioConDescuento = item.precio * (1 - descuento / 100);
      const importe = item.cantidad * precioConDescuento;

      subtotalCalc += importe;
      descuentosCalc += item.precio * item.cantidad * (descuento / 100);

      if (item.iva) {
        ivaCalc += importe * 0.16;
      }

      if (item.ieps) {
        iepsCalc += importe * (item.ieps / 100);
      }
    });

    const totalCalc = subtotalCalc + ivaCalc + iepsCalc;

    return {
      subtotal: subtotalCalc,
      iva: ivaCalc,
      ieps: iepsCalc,
      descuentos: descuentosCalc,
      total: totalCalc
    };
  }, [items]);
};

// Hook de validación SAT
const useSATValidation = (
  formaPago: FormaPago,
  metodoPago: PaymentMethod,
  clienteSeleccionado: Cliente | undefined,
  items: LineItem[]
) => {
  return useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validación 1: FormaPago = "Pago en parcialidades" → MétodoPago debe ser "por_definir"
    if (formaPago === "Pago en parcialidades" && metodoPago !== "por_definir") {
      errors.push("Para pagos en parcialidades, el método de pago debe ser 'Por definir' (PPD)");
    }

    // Validación 2: FormaPago = "Pago en una sola exhibición" → MétodoPago NO puede ser "por_definir"
    if (formaPago === "Pago en una sola exhibición" && metodoPago === "por_definir") {
      errors.push("Para pagos en una sola exhibición, el método de pago no puede ser 'Por definir'");
    }

    // Validación 3: Si método es "por_definir", forma debe ser "Pago en parcialidades"
    if (metodoPago === "por_definir" && formaPago !== "Pago en parcialidades") {
      errors.push("El método de pago 'Por definir' solo es válido para pagos en parcialidades");
    }

    // Validaciones adicionales
    if (!clienteSeleccionado) {
      errors.push("Debe seleccionar un cliente");
    }

    if (items.length === 0) {
      errors.push("Debe agregar al menos un producto");
    } else {
      const itemsInvalidos = items.filter(item => !item.productoId || item.cantidad <= 0);
      if (itemsInvalidos.length > 0) {
        errors.push("Todos los productos deben tener una cantidad válida");
      }

      const sinStock = items.filter(item => item.cantidad > item.cantidadDisponible);
      if (sinStock.length > 0) {
        errors.push("Algunos productos exceden el stock disponible");
      }
    }

    // Advertencias
    if (formaPago === "Pago en parcialidades" && clienteSeleccionado?.condicionesPago < 30) {
      warnings.push("Pagos en parcialidades generalmente requieren condiciones de pago de 30 días o más");
    }

    return {
      errors,
      warnings,
      isValid: errors.length === 0,
      hasWarnings: warnings.length > 0
    };
  }, [formaPago, metodoPago, clienteSeleccionado, items]);
};

// --- SUBCOMPONENTS ---
const CustomCheckbox = ({
  checked,
  onChange,
  label,
  id
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
  id?: string;
}) => (
  <div className="flex items-center gap-2">
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "h-5 w-5 rounded border flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        checked
          ? "bg-blue-600 border-blue-600 text-white"
          : "bg-white border-gray-300 hover:border-gray-400"
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
    {label && <Label htmlFor={id} className="cursor-pointer">{label}</Label>}
  </div>
);

// Componente para selección condicional de método de pago
const MetodoPagoSelector = ({
  formaPago,
  metodoPago,
  onMetodoPagoChange,
  disabled = false
}: {
  formaPago: FormaPago;
  metodoPago: PaymentMethod;
  onMetodoPagoChange: (value: PaymentMethod) => void;
  disabled?: boolean;
}) => {
  // Opciones basadas en la forma de pago según SAT
  const opcionesMetodoPago = useMemo(() => {
    const baseOpciones = [
      { value: "transferencia", label: "Transferencia", icon: Banknote },
      { value: "efectivo", label: "Efectivo", icon: DollarSign },
      { value: "tarjeta", label: "Tarjeta", icon: CreditCard },
      { value: "cheque", label: "Cheque", icon: FileText },
      { value: "credito", label: "Crédito", icon: CreditCard },
    ];

    if (formaPago === "Pago en parcialidades") {
      // Solo permitir "Por definir" para parcialidades
      return [
        { value: "por_definir", label: "Por definir (PPD)", icon: AlertCircle }
      ];
    } else {
      // Para una sola exhibición, mostrar todas excepto "Por definir"
      return baseOpciones;
    }
  }, [formaPago]);

  // Efecto para sincronizar cuando cambia la forma de pago
  useEffect(() => {
    if (formaPago === "Pago en parcialidades" && metodoPago !== "por_definir") {
      onMetodoPagoChange("por_definir");
    } else if (formaPago === "Pago en una sola exhibición" && metodoPago === "por_definir") {
      onMetodoPagoChange("transferencia");
    }
  }, [formaPago, metodoPago, onMetodoPagoChange]);

  const isDisabled = disabled || (formaPago === "Pago en parcialidades");

  return (
    <Select
      value={metodoPago}
      onValueChange={(value) => onMetodoPagoChange(value as PaymentMethod)}
      disabled={isDisabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Seleccionar método de pago" />
      </SelectTrigger>
      <SelectContent>
        {opcionesMetodoPago.map((opcion) => (
          <SelectItem key={opcion.value} value={opcion.value}>
            <div className="flex items-center gap-2">
              <opcion.icon className="h-3 w-3" />
              {opcion.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ProductSelectorModal = ({
  isOpen,
  onClose,
  onSelectProducts,
  selectedProductIds,
  productos,
  formatCurrency
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectProducts: (ids: string[]) => void;
  selectedProductIds: string[];
  productos: Producto[];
  formatCurrency: (amount: number) => string;
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedProductIds);

  useEffect(() => {
    if (isOpen) {
      setLocalSelectedIds(selectedProductIds);
      setSearchTerm("");
    }
  }, [isOpen, selectedProductIds]);

  const productosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return productos;
    const term = searchTerm.toLowerCase();
    return productos.filter(producto =>
      producto.descripcion.toLowerCase().includes(term) ||
      producto.codigo.toLowerCase().includes(term) ||
      producto.ubicacion?.toLowerCase().includes(term)
    );
  }, [productos, searchTerm]);

  const toggleProduct = (productId: string) => {
    setLocalSelectedIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl border flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <h3 id="modal-title" className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Agregar cajas de produccion
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b bg-gray-50/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por producto, codigo o ubicacion..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar productos"
            />
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          <div className="grid grid-cols-12 gap-2 p-2 text-sm font-medium text-gray-500 border-b" role="rowgroup">
            <div className="col-span-1" role="columnheader">Selección</div>
            <div className="col-span-4" role="columnheader">Producto</div>
            <div className="col-span-2" role="columnheader">Código</div>
            <div className="col-span-2 text-center" role="columnheader">Disponible</div>
            <div className="col-span-2 text-right" role="columnheader">Precio</div>
            <div className="col-span-1" role="columnheader">Ubicación</div>
          </div>

          {productosFiltrados.map((producto) => {
            const isSelected = localSelectedIds.includes(producto.id);
            const stockBajo = producto.cantidadDisponible < 10;
            const sinStock = producto.cantidadDisponible === 0;

            return (
              <div
                key={producto.id}
                onClick={() => !sinStock && toggleProduct(producto.id)}
                className={cn(
                  "grid grid-cols-12 gap-2 p-3 rounded-lg border cursor-pointer transition-colors items-center",
                  isSelected && "border-blue-500 bg-blue-50 ring-1 ring-blue-500",
                  sinStock && "opacity-50 cursor-not-allowed"
                )}
                role="row"
                aria-disabled={sinStock}
              >
                <div className="col-span-1" role="cell">
                  <CustomCheckbox
                    checked={isSelected}
                    onChange={() => !sinStock && toggleProduct(producto.id)}
                  />
                </div>
                <div className="col-span-4" role="cell">
                  <p className="font-semibold text-sm">{producto.descripcion}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{producto.unidad} • {producto.peso}kg</span>
                    {stockBajo && !sinStock && (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                        Bajo stock
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="col-span-2 font-mono text-sm" role="cell">{producto.codigo}</div>
                <div className="col-span-2 text-center" role="cell">
                  <Badge variant={sinStock ? "destructive" : stockBajo ? "outline" : "outline"}>
                    {producto.cantidadDisponible} cajas
                  </Badge>
                </div>
                <div className="col-span-2 text-right font-bold" role="cell">
                  {formatCurrency(producto.precio)}
                </div>
                <div className="col-span-1 text-xs text-gray-500" role="cell">
                  {producto.ubicacion}
                </div>
              </div>
            );
          })}

          {productosFiltrados.length === 0 && (
            <div className="text-center py-8 text-gray-500" role="status">
              No se encontraron productos
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm text-gray-600" aria-live="polite">
              {localSelectedIds.length} producto(s) seleccionado(s)
            </span>
            {localSelectedIds.some(id => {
              const prod = productos.find(p => p.id === id);
              return prod?.cantidadDisponible === 0;
            }) && (
                <span className="text-xs text-red-600 mt-1">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Algunos productos seleccionados están sin stock
                </span>
              )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => onSelectProducts(localSelectedIds)}
              type="button"
              disabled={localSelectedIds.length === 0}
            >
              Agregar a Factura
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InvoiceItemsTable = ({
  items,
  productos,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
  formatCurrency
}: {
  items: LineItem[];
  productos: Producto[];
  onUpdateItem: (id: string, field: keyof LineItem, value: LineItem[keyof LineItem]) => void;
  onRemoveItem: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  formatCurrency: (amount: number) => string;
}) => {
  const getImporte = (item: LineItem) => {
    const descuento = item.descuento || 0;
    return item.cantidad * item.precio * (1 - descuento / 100);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Producto</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Cantidad</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Precio Unitario</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Descuento</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">IVA</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Importe</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const producto = productos.find(p => p.id === item.productoId);
            const stockBajo = item.cantidadDisponible < 10 && item.cantidadDisponible > 0;
            const sinStock = item.cantidadDisponible === 0;

            return (
              <tr
                key={item.id}
                className={cn(
                  "border-b hover:bg-gray-50",
                  sinStock && "bg-red-50 hover:bg-red-50",
                  stockBajo && "bg-amber-50 hover:bg-amber-50"
                )}
              >
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{item.descripcion || "Seleccionar producto"}</p>
                    {producto && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn(
                          "text-gray-500",
                          sinStock && "text-red-600",
                          stockBajo && "text-amber-600"
                        )}>
                          Código: {producto.codigo}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className={cn(
                          sinStock ? "text-red-600 font-semibold" :
                            stockBajo ? "text-amber-600" :
                              "text-gray-500"
                        )}>
                          Disponible: {item.cantidadDisponible}
                        </span>
                        {sinStock && (
                          <Badge variant="destructive" className="text-xs">SIN STOCK</Badge>
                        )}
                        {stockBajo && !sinStock && (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">
                            BAJO STOCK
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={item.cantidadDisponible}
                      step="1"
                      value={item.cantidad}
                      onChange={(e) => onUpdateItem(item.id, 'cantidad', parseInt(e.target.value) || 1)}
                      className={cn(
                        "w-20 text-center",
                        !item.productoId && "bg-gray-100",
                        (item.cantidad > item.cantidadDisponible) && "border-red-500"
                      )}
                      disabled={!item.productoId || sinStock}
                      aria-label={`Cantidad para ${item.descripcion}`}
                    />
                    <span className="text-xs text-gray-500">cajas</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.precio}
                      onChange={(e) => onUpdateItem(item.id, 'precio', parseFloat(e.target.value))}
                      className={cn(
                        "w-32 text-right",
                        !item.productoId && "bg-gray-100"
                      )}
                      disabled={!item.productoId}
                      aria-label={`Precio para ${item.descripcion}`}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={item.descuento || 0}
                      onChange={(e) => onUpdateItem(item.id, 'descuento', parseFloat(e.target.value))}
                      className="w-20 text-right"
                      aria-label={`Descuento para ${item.descripcion}`}
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    item.iva ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600"
                  )}>
                    {item.iva ? "16%" : "Exento"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(getImporte(item))}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDuplicateItem(item.id)}
                      type="button"
                      aria-label={`Duplicar ${item.descripcion}`}
                      disabled={sinStock}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => onRemoveItem(item.id)}
                      type="button"
                      aria-label={`Eliminar ${item.descripcion}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const SummaryCard = ({
  calculos,
  clienteMoneda,
  formatCurrency
}: {
  calculos: CalculosFactura;
  clienteMoneda?: Currency;
  formatCurrency: (amount: number) => string;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <DollarSign className="h-4 w-4" /> Resumen
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Subtotal:</span>
        <span className="font-medium">{formatCurrency(calculos.subtotal)}</span>
      </div>

      {calculos.descuentos > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Descuentos:</span>
          <span className="font-medium text-red-600">-{formatCurrency(calculos.descuentos)}</span>
        </div>
      )}

      {calculos.iva > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">IVA (16%):</span>
          <span className="font-medium text-green-600">{formatCurrency(calculos.iva)}</span>
        </div>
      )}

      {calculos.ieps > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">IEPS:</span>
          <span className="font-medium text-amber-600">{formatCurrency(calculos.ieps)}</span>
        </div>
      )}

      <Separator />
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">Total:</span>
        <span className="text-lg font-bold text-gray-900">{formatCurrency(calculos.total)}</span>
      </div>

      <div className="pt-2 text-xs text-gray-500 text-center">
        Moneda: {clienteMoneda || 'MXN'}
      </div>
    </CardContent>
  </Card>
);

// Componente InvoiceStatusBadge CORREGIDO
const InvoiceStatusBadge = ({ status }: { status: InvoiceStatus }) => {
  // Mapeo de estados a configuración
  const statusConfigs = {
    borrador: {
      icon: Clock,
      className: "bg-gray-100 text-gray-800",
      label: "BORRADOR"
    },
    enviada: {
      icon: Send,
      className: "bg-blue-100 text-blue-800",
      label: "ENVIADA"
    },
    pagada: {
      icon: CheckCircle2,
      className: "bg-green-100 text-green-800",
      label: "PAGADA"
    },
    vencida: {
      icon: Clock,
      className: "bg-red-100 text-red-800",
      label: "VENCIDA"
    },
    cancelada: {
      icon: X,
      className: "bg-gray-100 text-gray-800",
      label: "CANCELADA"
    },
  } as const;

  const config = statusConfigs[status];
  const Icon = config.icon;

  return (
    <Badge className={cn("mt-1 flex items-center gap-1", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// Componente para estado en tabla
const InvoiceStatusBadgeTable = ({ status }: { status: InvoiceStatus }) => {
  const statusConfigs = {
    borrador: {
      className: "border-gray-200 bg-gray-50 text-gray-700"
    },
    enviada: {
      className: "border-blue-200 bg-blue-50 text-blue-700"
    },
    pagada: {
      className: "border-green-200 bg-green-50 text-green-700"
    },
    pendiente: {
      className: "border-amber-200 bg-amber-50 text-amber-700"
    },
    vencida: {
      className: "border-red-200 bg-red-50 text-red-700"
    },
    cancelada: {
      className: "border-gray-200 bg-gray-50 text-gray-700"
    },
  } as const;

  const config = statusConfigs[status] ?? statusConfigs.borrador;

  return (
    <Badge variant="outline" className={cn(config.className)}>
      {status}
    </Badge>
  );
};

// --- CATALOGOS DE FACTURACION ---

export default function Facturacion() {
  const { toast } = useToast();
  const {
    facturasRecientes: facturasDB = [],
    productos: productosDB = [],
    clientes: clientesDB = [],
    loadingFacturas,
    loadingProductos,
    loadingClientes,
    crearFactura,
    actualizarEstadoFactura,
    anularFactura,
    cargarDetallesFactura,
    isProcessing: isHookProcessing
  } = useFacturacion();

  // --- ESTADOS ---
  const [activeTab, setActiveTab] = useState<string>("crear");
  const [items, setItems] = useState<LineItem[]>([
    {
      id: "1",
      productoId: "",
      descripcion: "",
      cantidad: 1,
      precio: 0,
      unidad: "",
      iva: true,
      cantidadDisponible: 0
    }
  ]);
  const [clienteId, setClienteId] = useState<string>("");
  const [folio] = useState<string>(() => {
    const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `F-${hoy}-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
  });
  const [status, setStatus] = useState<InvoiceStatus>("borrador");
  const [fechaEmision, setFechaEmision] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [fechaVencimiento, setFechaVencimiento] = useState<string>(
    format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );
  const [notas, setNotas] = useState<string>("");
  const [terminos, setTerminos] = useState<string>("Neto 30 días");
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>("transferencia");
  const [usoCFDI, setUsoCFDI] = useState<UsoCFDI>("G03");
  const [formaPago, setFormaPago] = useState<FormaPago>("Pago en una sola exhibición");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const realProcessing = isProcessing || isHookProcessing;

  // --- MEMOIZED VALUES ---
  const clienteSeleccionado = useMemo(() =>
    clientesDB.find(c => c.id === clienteId),
    [clienteId, clientesDB]
  );

  const calculos = useInvoiceCalculations(items);
  const satValidation = useSATValidation(formaPago, metodoPago, clienteSeleccionado, items);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: clienteSeleccionado?.moneda || 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  }, [clienteSeleccionado?.moneda]);

  const metodoPagoLabel = useMemo(() => {
    const labels: Record<PaymentMethod, string> = {
      transferencia: "Transferencia",
      efectivo: "Efectivo",
      tarjeta: "Tarjeta",
      cheque: "Cheque",
      credito: "Credito",
      por_definir: "Por definir (PPD)",
    };

    return labels[metodoPago];
  }, [metodoPago]);

  const usoCfdiLabel = useMemo(() => {
    const labels: Record<UsoCFDI, string> = {
      G01: "Adquisicion de mercancias",
      G02: "Devoluciones, descuentos o bonificaciones",
      G03: "Gastos en general",
      P01: "Por definir",
    };

    return labels[usoCFDI];
  }, [usoCFDI]);

  const facturaPrintData = useMemo(() => ({
    folio,
    estado: status,
    fechaEmision,
    fechaVencimiento,
    cliente: {
      nombre: clienteSeleccionado?.nombre || "Cliente sin seleccionar",
      rfc: clienteSeleccionado?.rfc || "Por definir",
      direccion: clienteSeleccionado?.direccion || "Sin registrar",
      email: clienteSeleccionado?.email || "Sin registrar",
      telefono: clienteSeleccionado?.telefono || "Sin registrar",
      moneda: clienteSeleccionado?.moneda || "MXN",
    },
    pago: {
      usoCfdi: usoCfdiLabel,
      formaPago,
      metodoPago: metodoPagoLabel,
    },
    items: items
      .filter((item) => item.descripcion || item.cantidad || item.precio)
      .map((item) => {
        const descuento = item.descuento || 0;
        const precioConDescuento = item.precio * (1 - descuento / 100);
        return {
          descripcion: item.descripcion || "Concepto sin descripcion",
          cantidad: item.cantidad || 0,
          unidad: item.unidad || "PZA",
          precio: item.precio || 0,
          descuento,
          importe: (item.cantidad || 0) * precioConDescuento,
        };
      }),
    resumen: {
      subtotal: calculos.subtotal,
      descuentos: calculos.descuentos,
      iva: calculos.iva,
      ieps: calculos.ieps,
      total: calculos.total,
    },
    notas,
    terminos,
  }), [
    folio,
    status,
    fechaEmision,
    fechaVencimiento,
    clienteSeleccionado,
    usoCfdiLabel,
    formaPago,
    metodoPagoLabel,
    items,
    calculos,
    notas,
    terminos,
  ]);

  const abrirDocumentoFactura = useCallback(() => {
    openPrintDocument(`Factura_${folio}.pdf`, renderFacturaHtml(facturaPrintData));
  }, [facturaPrintData, folio]);

  const abrirFacturaDesdeHistorial = useCallback(async (factura: FacturaDB) => {
    const moneda = factura.moneda || factura.clientes?.moneda || "MXN";

    const usoCfdiLabelMap: Record<string, string> = {
      G01: "Adquisicion de mercancias",
      G02: "Devoluciones, descuentos o bonificaciones",
      G03: "Gastos en general",
      P01: "Por definir",
    };
    const metodoPagoLabelMap: Record<string, string> = {
      transferencia: "Transferencia",
      efectivo: "Efectivo",
      tarjeta: "Tarjeta",
      cheque: "Cheque",
      credito: "Credito",
      por_definir: "Por definir (PPD)",
    };

    let items: Array<{
      descripcion: string;
      cantidad: number;
      unidad: string;
      precio: number;
      descuento: number;
      importe: number;
    }> = [];
    try {
      const detalles = await cargarDetallesFactura(factura.id);
      items = detalles.map(d => {
        const descuento = d.descuento ?? 0;
        const precioConDescuento = d.precio_unitario * (1 - descuento / 100);
        return {
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          unidad: d.unidad || "PZA",
          precio: d.precio_unitario,
          descuento,
          importe: d.cantidad * precioConDescuento,
        };
      });
    } catch (e) {
      console.error("Error cargando detalles de factura:", e);
    }

    openPrintDocument(
      `Factura_${factura.numero_factura || factura.id}.pdf`,
      renderFacturaHtml({
        folio: factura.numero_factura || factura.id,
        estado: factura.estado || "borrador",
        fechaEmision: factura.fecha_emision
          ? format(new Date(factura.fecha_emision), "dd/MM/yyyy", { locale: es })
          : format(new Date(), "dd/MM/yyyy", { locale: es }),
        fechaVencimiento: factura.fecha_vencimiento
          ? format(new Date(factura.fecha_vencimiento), "dd/MM/yyyy", { locale: es })
          : "Sin registrar",
        cliente: {
          nombre: factura.receptor_nombre || factura.clientes?.nombre || "Cliente sin registrar",
          rfc: factura.receptor_rfc || "Por definir",
          direccion: factura.receptor_direccion || "Sin registrar",
          email: factura.receptor_email || "Sin registrar",
          telefono: "Sin registrar",
          moneda,
        },
        pago: {
          usoCfdi: (factura.uso_cfdi && usoCfdiLabelMap[factura.uso_cfdi]) || factura.uso_cfdi || "Por definir",
          formaPago: factura.forma_pago || "Sin registrar",
          metodoPago: (factura.metodo_pago && metodoPagoLabelMap[factura.metodo_pago]) || factura.metodo_pago || "Sin registrar",
        },
        items: items.length > 0 ? items : [
          {
            descripcion: "Conceptos de la factura",
            cantidad: 1,
            unidad: "Servicio",
            precio: factura.subtotal,
            descuento: 0,
            importe: factura.subtotal,
          },
        ],
        resumen: {
          subtotal: factura.subtotal,
          descuentos: 0,
          iva: factura.iva,
          ieps: factura.ieps || 0,
          total: factura.total,
        },
        notas: factura.notas || "",
        terminos: factura.terminos || "",
      }),
    );
  }, [cargarDetallesFactura]);

  const detallesFactura = useMemo(
    () =>
      items
        .filter((item) => item.descripcion && item.cantidad > 0)
        .map((item) => ({
          producto_id: item.productoId || null,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          unidad: item.unidad || "Caja",
          iva_aplicable: item.iva,
          ieps_aplicable: item.ieps ?? 0,
          descuento: item.descuento ?? 0,
        })),
    [items],
  );

  const facturaParams = useMemo(() => ({
    cliente_id: clienteId,
    fecha_vencimiento: fechaVencimiento
      ? new Date(fechaVencimiento).toISOString()
      : null,
    uso_cfdi: usoCFDI,
    forma_pago: formaPago,
    metodo_pago: metodoPago,
    moneda: clienteSeleccionado?.moneda || "MXN",
    notas,
    terminos,
  }), [clienteId, fechaVencimiento, usoCFDI, formaPago, metodoPago, clienteSeleccionado?.moneda, notas, terminos]);

  // --- HANDLERS ---
  const addItem = useCallback(() => {
    setItems((prev) => [...prev, {
      id: Math.random().toString(),
      productoId: "",
      descripcion: "",
      cantidad: 1,
      precio: 0,
      unidad: "",
      iva: true,
      cantidadDisponible: 0
    }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    if (items.length === 1) {
      toast({
        title: "No se puede eliminar",
        description: "Debe existir al menos un item en la factura",
        variant: "destructive"
      });
      return;
    }
    const item = items.find(i => i.id === id);
    setItems((prev) => prev.filter(i => i.id !== id));

    if (item?.productoId) {
      setSelectedProductIds(prev => prev.filter(pid => pid !== item.productoId));
    }
  }, [items, toast]);

  const updateItem = useCallback((id: string, field: keyof LineItem, value: LineItem[keyof LineItem]) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        if (field === "productoId") {
          const prod = productosDB.find(p => p.id === (value as string));
          if (prod) {
            if (!selectedProductIds.includes(prod.id)) {
              setSelectedProductIds(prev => [...prev, prod.id]);
            }

            return {
              ...item,
              productoId: value as string,
              descripcion: prod.descripcion,
              precio: prod.precio,
              unidad: prod.unidad,
              iva: prod.iva,
              ieps: (prod as ProductoConIEPS).ieps ?? 0,
              cantidadDisponible: prod.cantidadDisponible
            };
          }
        }

        if (field === "cantidad") {
          const cantidadValue = value as number;
          const itemCurrent = prevItems.find(i => i.id === id);
          if (itemCurrent && cantidadValue > itemCurrent.cantidadDisponible) {
            toast({
              title: "Cantidad no disponible",
              description: `Solo hay ${itemCurrent.cantidadDisponible} cajas disponibles`,
              variant: "destructive"
            });
            return item;
          }
        }

        return { ...item, [field]: value };
      }
      return item;
    }));
  }, [productosDB, selectedProductIds, toast]);

  const duplicarItem = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setItems((prev) => [...prev, { ...item, id: Math.random().toString() }]);
    }
  }, [items]);

  const handleSelectProductsFromModal = useCallback((productIds: string[]) => {
    const newProductIds = productIds.filter(pid =>
      !items.some(item => item.productoId === pid)
    );

    const newItems = newProductIds.map(pid => {
      const prod = productosDB.find(p => p.id === pid);
      if (!prod) return null;

      return {
        id: Math.random().toString(),
        productoId: prod.id,
        descripcion: prod.descripcion,
        cantidad: 1,
        precio: prod.precio,
        unidad: prod.unidad,
        iva: prod.iva,
        ieps: (prod as ProductoConIEPS).ieps ?? 0,
        cantidadDisponible: prod.cantidadDisponible
      };
    }).filter(Boolean) as LineItem[];

    setItems((prev) => [...prev, ...newItems]);
    setSelectedProductIds(productIds);
    setIsSelectorOpen(false);

    toast({
      title: "Productos agregados",
      description: `Se agregaron ${newItems.length} productos a la factura`,
      className: "bg-blue-600 text-white border-none"
    });
  }, [items, productosDB, toast]);

  const handleGuardar = useCallback(async () => {
    if (!satValidation.isValid) {
      toast({
        title: "Error de validación SAT",
        description: satValidation.errors[0] || "Complete los datos requeridos",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      await crearFactura({
        factura: facturaParams,
        detalles: detallesFactura,
      });

      setStatus("borrador");
      toast({
        title: "Factura guardada",
        description: "La factura se registro correctamente como borrador",
        className: "bg-blue-600 text-white border-none"
      });
      setActiveTab("lista");
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar la factura",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [satValidation, crearFactura, facturaParams, detallesFactura, toast]);

  const handleTimbrar = useCallback(async () => {
    if (!satValidation.isValid) {
      toast({
        title: "Error de validación SAT",
        description: satValidation.errors[0] || "Complete los datos requeridos",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const resultado = await crearFactura({
        factura: facturaParams,
        detalles: detallesFactura,
      });

      if (resultado?.factura_id) {
        await actualizarEstadoFactura(resultado.factura_id, "enviada");
      }

      setStatus("enviada");
      toast({
        title: "Factura timbrada",
        description: "La factura se registro y quedo lista para seguimiento",
        className: "bg-purple-600 text-white border-none"
      });
      abrirDocumentoFactura();
      setActiveTab("lista");
    } catch (error) {
      toast({
        title: "Error al timbrar",
        description: "No se pudo timbrar la factura",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [satValidation, crearFactura, facturaParams, detallesFactura, actualizarEstadoFactura, toast, abrirDocumentoFactura]);

  const handleDuplicarFactura = useCallback(() => {
    setClienteId("");
    setItems([{
      id: Math.random().toString(),
      productoId: "",
      descripcion: "",
      cantidad: 1,
      precio: 0,
      unidad: "",
      iva: true,
      cantidadDisponible: 0
    }]);
    setSelectedProductIds([]);
    setNotas("");
    setTerminos("Neto 30 días");
    setStatus("borrador");
    setMetodoPago("transferencia");
    setFormaPago("Pago en una sola exhibición");

    toast({
      title: "Factura duplicada",
      description: "Se ha creado una nueva factura en blanco",
      className: "bg-blue-600 text-white border-none"
    });
  }, [toast]);

  const handleVistaPrevia = useCallback(() => {
    abrirDocumentoFactura();
  }, [abrirDocumentoFactura]);

  const handleExportarFactura = useCallback(() => {
    abrirDocumentoFactura();
  }, [abrirDocumentoFactura]);

  const handleCancelarFactura = useCallback(async (factura: FacturaDB) => {
    if (!window.confirm(`¿Cancelar la factura ${factura.numero_factura}? Esta acción no se puede deshacer.`)) {
      return;
    }
    const resultado = await anularFactura(factura.id);
    if (resultado?.success) {
      setActiveTab("lista");
    }
  }, [anularFactura]);

  return (
    <MainLayout title="Facturación" subtitle="Crea y gestiona tus facturas">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
            <p className="text-gray-500">Gestiona facturas, clientes y pagos</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" type="button">
              <Filter className="h-4 w-4 mr-2" /> Filtros
            </Button>
            <Button variant="outline" size="sm" type="button">
              <Search className="h-4 w-4 mr-2" /> Buscar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              type="button"
              onClick={() => setActiveTab("crear")}
            >
              <Plus className="h-4 w-4 mr-2" /> Nueva Factura
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full md:w-auto grid-cols-5">
            <TabsTrigger value="crear" className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" /> Crear
            </TabsTrigger>
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Todas las Facturas
            </TabsTrigger>
            <TabsTrigger value="cobranza" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Cobranza
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Clientes
            </TabsTrigger>
            <TabsTrigger value="productos" className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Productos
            </TabsTrigger>
          </TabsList>

          {/* TAB COBRANZA */}
          <TabsContent value="cobranza" className="mt-6">
            <CobranzaTab />
          </TabsContent>

          <TabsContent value="crear" className="mt-6">
            <ProductSelectorModal
              isOpen={isSelectorOpen}
              onClose={() => setIsSelectorOpen(false)}
              onSelectProducts={handleSelectProductsFromModal}
              selectedProductIds={selectedProductIds}
              productos={productosDB}
              formatCurrency={formatCurrency}
            />

            {/* MOSTRAR ERRORES SAT */}
            {satValidation.errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-semibold">Revisión fiscal:</span>
                </div>
                <ul className="text-sm text-red-600 list-disc pl-5 space-y-1">
                  {satValidation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {satValidation.hasWarnings && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-semibold">Advertencias:</span>
                </div>
                <ul className="text-sm text-amber-600 list-disc pl-5 space-y-1">
                  {satValidation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* GUÍA RÁPIDA DE PAGO */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <FileText className="h-4 w-4" />
                <span className="font-semibold">Guía rápida:</span>
              </div>
              <div className="text-sm text-blue-600 space-y-1">
                <p>Si eliges <strong>parcialidades</strong>, el sistema asigna <strong>Por definir (PPD)</strong> automáticamente.</p>
                <p>Si eliges <strong>una sola exhibición</strong>, selecciona el método de pago final.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* COLUMNA IZQUIERDA - FORMULARIO */}
              <div className="lg:col-span-2 space-y-6">
                {/* TARJETA DE CLIENTE */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Building className="h-4 w-4" /> Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">
                          Cliente *
                        </Label>
                        <Select value={clienteId} onValueChange={setClienteId}>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingClientes ? "Cargando clientes..." : "Selecciona un cliente"} />
                          </SelectTrigger>
                          <SelectContent>
                            {clientesDB.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="font-medium">{c.nombre}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">
                          Condiciones de Pago
                        </Label>
                        <Select value={terminos} onValueChange={setTerminos}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar condiciones" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Contado">Contado</SelectItem>
                            <SelectItem value="Neto 15 días">Neto 15 días</SelectItem>
                            <SelectItem value="Neto 30 días">Neto 30 días</SelectItem>
                            <SelectItem value="Neto 45 días">Neto 45 días</SelectItem>
                            <SelectItem value="Neto 60 días">Neto 60 días</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {clienteSeleccionado && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <FileSignature className="h-3 w-3" /> RFC
                          </div>
                          <p className="text-sm font-medium">{clienteSeleccionado.rfc}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <MapPin className="h-3 w-3" /> Dirección
                          </div>
                          <p className="text-sm font-medium">{clienteSeleccionado.direccion}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <Mail className="h-3 w-3" /> Email
                          </div>
                          <p className="text-sm font-medium">{clienteSeleccionado.email}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <Phone className="h-3 w-3" /> Teléfono
                          </div>
                          <p className="text-sm font-medium">{clienteSeleccionado.telefono}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* TARJETA DE CONCEPTOS */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Package className="h-4 w-4" /> Conceptos
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addItem}
                          className="h-8"
                          type="button"
                        >
                          <Plus className="h-3 w-3 mr-2" /> Agregar Fila
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsSelectorOpen(true)}
                          className="h-8"
                          type="button"
                          aria-label="Abrir selector de cajas producidas"
                        >
                          <Package className="h-3 w-3 mr-2" /> Agregar desde producción
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <InvoiceItemsTable
                      items={items}
                      productos={productosDB}
                      onUpdateItem={updateItem}
                      onRemoveItem={removeItem}
                      onDuplicateItem={duplicarItem}
                      formatCurrency={formatCurrency}
                    />

                    <Button
                      variant="outline"
                      className="mt-4 w-full border-dashed"
                      onClick={() => setIsSelectorOpen(true)}
                      type="button"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Agregar cajas de producción
                    </Button>
                  </CardContent>
                </Card>

                {/* TARJETA DE NOTAS Y CONDICIONES */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-700">Notas y condiciones</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Notas
                      </Label>
                      <Textarea
                        placeholder="Notas adicionales para el cliente..."
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Términos y Condiciones
                      </Label>
                      <Textarea
                        placeholder="Condiciones de pago y observaciones..."
                        value={terminos}
                        onChange={(e) => setTerminos(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* COLUMNA DERECHA - RESUMEN Y ACCIONES */}
              <div className="space-y-6">
                <SummaryCard
                  calculos={calculos}
                  clienteMoneda={clienteSeleccionado?.moneda}
                  formatCurrency={formatCurrency}
                />

                {/* TARJETA DE FECHAS */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Fechas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Fecha de Emisión
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="date"
                          value={fechaEmision}
                          onChange={(e) => setFechaEmision(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Fecha de Vencimiento
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="date"
                          value={fechaVencimiento}
                          onChange={(e) => setFechaVencimiento(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* TARJETA DE CONFIGURACIÓN FISCAL */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-700">Configuración fiscal</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Uso del CFDI
                      </Label>
                      <Select value={usoCFDI} onValueChange={(value) => setUsoCFDI(value as UsoCFDI)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar uso CFDI" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="G01">Adquisición de mercancías</SelectItem>
                          <SelectItem value="G02">Devoluciones, descuentos o bonificaciones</SelectItem>
                          <SelectItem value="G03">Gastos en general</SelectItem>
                          <SelectItem value="P01">Por definir</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Forma de Pago
                      </Label>
                      <Select value={formaPago} onValueChange={(value) => setFormaPago(value as FormaPago)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar forma de pago" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pago en una sola exhibición">Una sola exhibición</SelectItem>
                          <SelectItem value="Pago en parcialidades">Parcialidades</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Método de Pago
                      </Label>
                      <MetodoPagoSelector
                        formaPago={formaPago}
                        metodoPago={metodoPago}
                        onMetodoPagoChange={setMetodoPago}
                        disabled={realProcessing}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {formaPago === "Pago en parcialidades"
                          ? "Se asigna automaticamente como Por definir (PPD)"
                          : "Selecciona el metodo de pago"}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* BOTONES DE ACCIÓN */}
                <div className="space-y-3">
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={handleTimbrar}
                    disabled={!satValidation.isValid || realProcessing}
                    type="button"
                  >
                    {realProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" /> Timbrar y Enviar
                      </>
                    )}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleGuardar}
                      disabled={!satValidation.isValid || realProcessing}
                      type="button"
                    >
                      {realProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleVistaPrevia}
                      type="button"
                    >
                      <Printer className="h-4 w-4 mr-2" /> Vista Previa
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={handleDuplicarFactura}
                    >
                      <Copy className="h-4 w-4 mr-2" /> Duplicar
                    </Button>
                    <Button variant="ghost" size="sm" type="button" onClick={handleExportarFactura}>
                      <Download className="h-4 w-4 mr-2" /> Exportar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" type="button">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Más opciones</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleVistaPrevia}>
                          <Eye className="h-4 w-4 mr-2" /> Abrir PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Send className="h-4 w-4 mr-2" /> Enviar por correo
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" /> Cancelar factura
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* ESTADO DE LA FACTURA */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Estado</p>
                        <InvoiceStatusBadge status={status} />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Folio</p>
                        <p className="font-semibold">{folio}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB LISTA DE FACTURAS */}
          <TabsContent value="lista" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Todas las Facturas</span>
                  <div className="flex items-center gap-2">
                    <Input placeholder="Buscar facturas..." className="w-64" />
                    <Button variant="outline" size="sm" type="button">
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
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Forma Pago</TableHead>
                      <TableHead>Método Pago</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturasDB.map((factura: FacturaDB) => (
                      <TableRow key={factura.numero_factura || factura.id}>
                        <TableCell className="font-medium">{factura.numero_factura || factura.id}</TableCell>
                        <TableCell>{factura.clientes?.nombre || 'N/A'}</TableCell>
                        <TableCell>{factura.fecha_emision ? format(new Date(factura.fecha_emision), 'dd/MM/yyyy', { locale: es }) : 'N/A'}</TableCell>
                        <TableCell>{factura.fecha_vencimiento ? format(new Date(factura.fecha_vencimiento), 'dd/MM/yyyy', { locale: es }) : 'N/A'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{factura.forma_pago || 'N/A'}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{factura.metodo_pago || 'N/A'}</Badge></TableCell>
                        <TableCell>
                          <InvoiceStatusBadgeTable status={(factura.estado?.toLowerCase() || 'borrador') as InvoiceStatus} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: factura.clientes?.moneda || 'MXN', minimumFractionDigits: 2 }).format(factura.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" type="button" onClick={() => abrirFacturaDesdeHistorial(factura)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {factura.estado !== 'cancelada' && (
                              <Button variant="ghost" size="sm" type="button" className="text-red-500 hover:text-red-700" onClick={() => handleCancelarFactura(factura)}>
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Clientes para facturación</span>
                  <Badge variant="outline">{clientesDB.length} registros</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingClientes ? (
                  <div className="py-10 text-center text-sm text-gray-500">Cargando clientes...</div>
                ) : clientesDB.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500">No hay clientes disponibles.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>RFC</TableHead>
                        <TableHead>Moneda</TableHead>
                        <TableHead>Crédito</TableHead>
                        <TableHead>Contacto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesDB.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-medium">{cliente.nombre}</TableCell>
                          <TableCell>{cliente.rfc || "Por definir"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{cliente.moneda}</Badge>
                          </TableCell>
                          <TableCell>{cliente.condicionesPago} dias</TableCell>
                          <TableCell>{cliente.email || "Sin correo"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="productos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Productos disponibles</span>
                  <Badge variant="outline">{productosDB.length} registros</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingProductos ? (
                  <div className="py-10 text-center text-sm text-gray-500">Cargando productos...</div>
                ) : productosDB.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500">No hay productos listos para facturar.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead>Disponible</TableHead>
                        <TableHead>Ubicación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productosDB.map((producto) => (
                        <TableRow key={producto.id}>
                          <TableCell className="font-medium">{producto.codigo}</TableCell>
                          <TableCell>{producto.descripcion}</TableCell>
                          <TableCell>{producto.unidad}</TableCell>
                          <TableCell>{producto.cantidadDisponible}</TableCell>
                          <TableCell>{producto.ubicacion || "Sin registrar"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
