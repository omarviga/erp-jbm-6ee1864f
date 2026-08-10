// src/components/ventas/ProductoLimonCard.tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProductoLimon } from "@/types/limon.types";

interface ProductoLimonCardProps {
    producto: ProductoLimon;
    stockDisponible: number;
    onAgregar: (producto: ProductoLimon) => void;
}

export function ProductoLimonCard({ producto, stockDisponible, onAgregar }: ProductoLimonCardProps) {
    // Colores según tipo de limón
    const getColorPorTipo = (tipo: string) => {
        switch (tipo) {
            case 'verde': return 'bg-green-50 border-green-200 hover:bg-green-100';
            case 'alimonado': return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
            case 'amarillo': return 'bg-amber-50 border-amber-200 hover:bg-amber-100';
            case 'economico': return 'bg-slate-50 border-slate-200 hover:bg-slate-100';
            default: return 'bg-white border-slate-200 hover:bg-slate-50';
        }
    };

    // Icono según empaque
    const getIcono = () => {
        if (producto.empaque === 'arpilla') {
            return '🧺';
        }
        return '📦';
    };

    // Texto para el empaque
    const getTextoEmpaque = () => {
        if (producto.empaque === 'arpilla' && producto.tamano_arpilla) {
            return `Arpilla ${producto.tamano_arpilla}`;
        }
        return producto.empaque === 'caja' ? 'Caja' : 'Arpilla';
    };

    return (
        <Button
            variant="outline"
            className={cn(
                "h-44 flex flex-col items-center justify-between gap-2 p-4 border-2 relative transition-all",
                getColorPorTipo(producto.tipo_limon),
                stockDisponible > 0
                    ? "hover:border-primary hover:shadow-md"
                    : "opacity-60 grayscale cursor-not-allowed"
            )}
            onClick={() => stockDisponible > 0 && onAgregar(producto)}
            disabled={stockDisponible === 0}
        >
            {/* Badge de stock */}
            <div className="absolute top-2 right-2">
                <Badge variant={stockDisponible > 0 ? "default" : "destructive"} className="text-xs px-2 h-6">
                    {stockDisponible > 0 ? `${stockDisponible}` : "SIN STOCK"}
                </Badge>
            </div>

            {/* Icono */}
            <div className="flex flex-col items-center gap-2">
                <span className="text-4xl filter drop-shadow-sm">
                    {getIcono()}
                </span>
                <Badge variant="secondary" className="text-xs capitalize">
                    {getTextoEmpaque()}
                </Badge>
            </div>

            {/* Información */}
            <div className="text-center w-full space-y-1">
                <p className="text-sm font-bold leading-tight line-clamp-2">
                    {producto.nombre}
                </p>

                <div className="flex flex-col gap-1 text-xs">
                    {/* Tipo y calibre */}
                    <div className="flex items-center justify-center gap-1">
                        <Badge variant="outline" className="text-[10px] capitalize">
                            {producto.tipo_limon}
                        </Badge>
                        <span className="font-bold text-primary">
                            {producto.calibre}
                        </span>
                    </div>

                    {/* Peso */}
                    <span className="text-muted-foreground">
                        {producto.peso_kg} kg
                    </span>
                </div>
            </div>

            {/* Precio */}
            <div className="mt-2">
                {producto.precio_sugerido > 0 ? (
                    <>
                        <Badge className="font-bold text-lg bg-primary hover:bg-primary">
                            ${producto.precio_sugerido.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Precio sugerido
                        </p>
                    </>
                ) : (
                    <Badge variant="outline" className="font-bold">
                        Precio por definir
                    </Badge>
                )}
            </div>
        </Button>
    );
}