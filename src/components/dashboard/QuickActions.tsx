import { Link } from "react-router-dom";
import { Scale, Factory, Truck, Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const quickActions = [
  {
    title: "Nueva Recepción",
    description: "Registrar entrada de limón",
    icon: Scale,
    href: "/recepcion?nuevo=true",
    variant: "primary" as const,
  },
  {
    title: "Registrar Producción",
    description: "Clasificar y empacar",
    icon: Factory,
    href: "/produccion?nuevo=true",
    variant: "secondary" as const,
  },
  {
    title: "Crear Embarque",
    description: "Nueva guía de salida",
    icon: Truck,
    href: "/logistica?nuevo=true",
    variant: "secondary" as const,
  },
  {
    title: "Nueva Venta",
    description: "Punto de venta",
    icon: Receipt,
    href: "/ventas?pos=true",
    variant: "secondary" as const,
  },
];

export function QuickActions() {
  return (
    <Card className="module-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Acciones Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href}>
              <Button
                variant={action.variant === "primary" ? "default" : "outline"}
                className={`w-full h-auto py-4 flex flex-col items-center gap-2 btn-industrial ${
                  action.variant === "primary" ? "bg-primary hover:bg-primary/90" : ""
                }`}
              >
                <action.icon className="h-6 w-6" />
                <div className="text-center">
                  <p className="font-semibold text-sm">{action.title}</p>
                  <p className="text-xs opacity-80">{action.description}</p>
                </div>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
