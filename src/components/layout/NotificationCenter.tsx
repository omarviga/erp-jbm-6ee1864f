import { Bell, Check, CheckCheck, AlertTriangle, Info, CheckCircle2, XCircle, Package, Truck, ShoppingCart, Wallet, Factory, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificaciones, type Notificacion, type NotificationCategory, type NotificationType } from "@/hooks/useNotificaciones";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const categoryIcons: Record<NotificationCategory, typeof Package> = {
  inventario: Package,
  transferencia: Truck,
  venta: ShoppingCart,
  corte_caja: Wallet,
  produccion: Factory,
  sistema: Settings,
};

const typeColors: Record<NotificationType, string> = {
  info: "text-blue-500",
  warning: "text-yellow-500",
  success: "text-green-500",
  error: "text-destructive",
  alert: "text-destructive",
};

const typeIcons: Record<NotificationType, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
  alert: AlertTriangle,
};

interface NotificationItemProps {
  notificacion: Notificacion;
  onMarkAsRead: (id: string) => void;
}

function NotificationItem({ notificacion, onMarkAsRead }: NotificationItemProps) {
  const CategoryIcon = categoryIcons[notificacion.categoria];
  const TypeIcon = typeIcons[notificacion.tipo];
  const typeColor = typeColors[notificacion.tipo];

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors",
        !notificacion.leida && "bg-primary/5"
      )}
      onClick={() => !notificacion.leida && onMarkAsRead(notificacion.id)}
    >
      <div className={cn("mt-0.5", typeColor)}>
        <TypeIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <CategoryIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground capitalize">
            {notificacion.categoria.replace('_', ' ')}
          </span>
          {!notificacion.leida && (
            <span className="h-2 w-2 rounded-full bg-primary" />
          )}
        </div>
        <p className="font-medium text-sm truncate">{notificacion.titulo}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notificacion.mensaje}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notificacion.created_at), {
            addSuffix: true,
            locale: es,
          })}
        </p>
      </div>
      {!notificacion.leida && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(notificacion.id);
          }}
        >
          <Check className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function NotificationCenter() {
  const { notificaciones, noLeidas, isLoading, marcarComoLeida, marcarTodasLeidas } = useNotificaciones();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {noLeidas > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs">
              {noLeidas > 9 ? "9+" : noLeidas}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          {noLeidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs"
              onClick={(e) => {
                e.preventDefault();
                marcarTodasLeidas();
              }}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Cargando notificaciones...
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No tienes notificaciones
              </p>
            </div>
          ) : (
            notificaciones.map((notif) => (
              <NotificationItem
                key={notif.id}
                notificacion={notif}
                onMarkAsRead={marcarComoLeida}
              />
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
