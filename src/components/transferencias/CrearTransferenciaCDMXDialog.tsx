import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Truck,
  Package,
  Search,
  Snowflake,
  Loader2,
  MapPin,
  User,
  AlertCircle,
  Minus,
  Plus,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CalibreBadge } from "@/components/ui/calibre-badge";
import { useCrearTransferenciaCDMX, type ItemTransferencia } from "@/hooks/useCrearTransferenciaCDMX";

interface Props {
  trigger?: React.ReactNode;
  preselectedIds?: string[]; // Pre-select specific camara_fria IDs
}

export function CrearTransferenciaCDMXDialog({ trigger, preselectedIds }: Props) {
  const { stockDisponible, loadingStock, crearTransferencia, isCreando } = useCrearTransferenciaCDMX();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"seleccion" | "datos">("seleccion");
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [chofer, setChofer] = useState("");
  const [placas, setPlacas] = useState("");
  const [notas, setNotas] = useState("");

  // Initialize preselected items when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setStep("seleccion");
      setChofer("");
      setPlacas("");
      setNotas("");
      setSearchTerm("");
      if (preselectedIds && preselectedIds.length > 0) {
        const map = new Map<string, number>();
        preselectedIds.forEach((id) => {
          const item = stockDisponible.find((s) => s.id === id);
          if (item) map.set(id, item.cantidad_disponible);
        });
        setSelectedItems(map);
      } else {
        setSelectedItems(new Map());
      }
    }
  };

  const filteredStock = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return stockDisponible;
    return stockDisponible.filter(
      (s) =>
        s.descripcion.toLowerCase().includes(term) ||
        s.presentacion_nombre.toLowerCase().includes(term)
    );
  }, [stockDisponible, searchTerm]);

  const toggleItem = (id: string) => {
    const newMap = new Map(selectedItems);
    if (newMap.has(id)) {
      newMap.delete(id);
    } else {
      const item = stockDisponible.find((s) => s.id === id);
      if (item) newMap.set(id, item.cantidad_disponible);
    }
    setSelectedItems(newMap);
  };

  const updateQty = (id: string, delta: number) => {
    const item = stockDisponible.find((s) => s.id === id);
    if (!item) return;
    const current = selectedItems.get(id) || 0;
    const next = Math.max(1, Math.min(item.cantidad_disponible, current + delta));
    const newMap = new Map(selectedItems);
    newMap.set(id, next);
    setSelectedItems(newMap);
  };

  const totalCajas = Array.from(selectedItems.values()).reduce((a, b) => a + b, 0);

  const handleCrear = async () => {
    const items: ItemTransferencia[] = [];
    selectedItems.forEach((qty, id) => {
      const stock = stockDisponible.find((s) => s.id === id);
      if (stock) {
        items.push({
          id: stock.id,
          origen_inventario: stock.origen_inventario,
          produccion_id: stock.produccion_id,
          lote_id: stock.lote_id,
          presentacion_id: stock.presentacion_id,
          presentacion_nombre: stock.presentacion_nombre,
          cantidad: qty,
          cantidad_disponible: stock.cantidad_disponible,
          peso_kg: stock.peso_kg,
          cajas_produccion: stock.cajas_produccion,
          calibre: stock.calibre,
          calidad: stock.calidad,
          lote_numero: stock.lote_numero,
          descripcion: stock.descripcion,
        });
      }
    });

    try {
      await crearTransferencia({ chofer, placas, notas, items });
      setOpen(false);
    } catch {
      // error handled in hook
    }
  };

  const defaultTrigger = (
    <Button className="gap-2">
      <Truck className="h-4 w-4" />
      Enviar a Bodega CDMX
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Nueva Transferencia a Bodega CDMX
          </DialogTitle>
          <DialogDescription>
            {step === "seleccion"
              ? "Selecciona los productos y cantidades a enviar"
              : "Ingresa los datos de transporte"}
          </DialogDescription>
        </DialogHeader>

        {step === "seleccion" && (
          <div className="flex flex-col flex-1 overflow-hidden gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por lote, calibre, calidad..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Stock list */}
            <ScrollArea className="flex-1 max-h-[400px] pr-2">
              {loadingStock ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay stock disponible</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStock.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    const qty = selectedItems.get(item.id) || 0;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => toggleItem(item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            className="pointer-events-none"
                          />
                          <CalibreBadge calibre={item.calibre} size="sm" />
                          <div>
                            <p className="font-medium text-sm">{item.descripcion}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-[10px] h-4 px-1">{item.calidad}</Badge>
                              <Snowflake className="h-3 w-3 text-sky-500" />
                              <span>{item.presentacion_nombre}</span>
                              <span>•</span>
                              <span>{item.cantidad_disponible} cajas disp.</span>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQty(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              className="w-16 h-7 text-center text-sm"
                              value={qty}
                              min={1}
                              max={item.cantidad_disponible}
                              onChange={(e) => {
                                const val = Math.max(
                                  1,
                                  Math.min(item.cantidad_disponible, parseInt(e.target.value) || 1)
                                );
                                const newMap = new Map(selectedItems);
                                newMap.set(item.id, val);
                                setSelectedItems(newMap);
                              }}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQty(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{selectedItems.size}</span> productos •{" "}
                <span className="font-medium">{totalCajas}</span> cajas
              </div>
              <Button
                onClick={() => setStep("datos")}
                disabled={selectedItems.size === 0}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === "datos" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Resumen del envío</p>
              <div className="flex gap-4 text-muted-foreground">
                <span>{selectedItems.size} productos</span>
                <span>{totalCajas} cajas totales</span>
              </div>
            </div>

            {/* Transport data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Chofer *
                </Label>
                <Input
                  value={chofer}
                  onChange={(e) => setChofer(e.target.value)}
                  placeholder="Nombre del chofer"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> Placas
                </Label>
                <Input
                  value={placas}
                  onChange={(e) => setPlacas(e.target.value)}
                  placeholder="ABC-123"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas de salida</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones del envío..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-sky-50 p-2 rounded-md">
              <MapPin className="h-4 w-4 text-sky-600 shrink-0" />
              <span>
                Origen: <strong>Michoacán</strong> → Destino: <strong>Bodega CDMX</strong>
              </span>
            </div>

            {!chofer.trim() && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>El nombre del chofer es obligatorio</span>
              </div>
            )}

            <Separator />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("seleccion")}>
                Volver
              </Button>
              <Button
                onClick={handleCrear}
                disabled={isCreando || !chofer.trim()}
              >
                {isCreando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Truck className="h-4 w-4 mr-2" />
                    Crear Transferencia
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
