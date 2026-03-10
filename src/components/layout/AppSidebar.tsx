// src/components/layout/AppSidebar.tsx
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Scale,
  Factory,
  Snowflake,
  Truck,
  ShoppingCart,
  FileText,
  Wallet,
  Package,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Shield,
  Cog,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import logoJBM from "@/assets/logo-jbm.png";
import { Link, useLocation } from "react-router-dom";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Recepción", href: "/recepcion", icon: Scale },
  { title: "Producción", href: "/produccion", icon: Factory },
  { title: "📦 Inventarios", href: "/inventarios", icon: Snowflake },
  { title: "Logística", href: "/logistica", icon: Truck },
  {
    title: "Bodega CDMX",
    href: "/bodega-cdmx",
    icon: ShoppingCart,
  },
  { title: "Facturación", href: "/facturacion", icon: FileText },
  { title: "Finanzas", href: "/finanzas", icon: Wallet },
  { title: "Maquila", href: "/maquila", icon: Cog },
  { title: "Gastos", href: "/gastos", icon: Receipt },
  { title: "Insumos", href: "/insumos", icon: Package },
  { title: "Reportes", href: "/reportes", icon: BarChart3 },
];

const secondaryNavItems: NavItem[] = [
  { title: "Productores", href: "/productores", icon: Users },
  { title: "Gestión Usuarios", href: "/admin/usuarios", icon: Shield, adminOnly: true },
  { title: "Configuración", href: "/configuracion", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user, userRoles = [], isAdmin } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar className="border-r-0" collapsible="icon">
      <SidebarHeader className="h-32 flex items-center justify-center pt-6 pb-2">
        <img
          src={logoJBM}
          alt="JBM"
          className="w-24 object-contain transition-all group-data-[collapsible=icon]:w-10"
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            {mainNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.href}
                  className={cn(
                    "h-12 text-base font-medium hover:bg-green-600/20 transition-colors",
                    "data-[active=true]:bg-[#65a30d] data-[active=true]:text-white"
                  )}
                >
                  <Link to={item.href} className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <div className="mt-6 pt-4 border-t border-sidebar-border">
          <p className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Administración
          </p>
          <div className="space-y-1 px-2">
            {secondaryNavItems
              .filter((i) => !i.adminOnly || isAdmin)
              .map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto">
        <div className="flex flex-col gap-3">
          {user ? (
            <div className="text-sm px-1">
              <p className="text-sidebar-foreground/80 truncate">{user.email}</p>
              {userRoles.length > 0 && (
                <p className="text-xs text-sidebar-foreground/60 capitalize">{userRoles.join(", ")}</p>
              )}
            </div>
          ) : (
            <div className="text-sm text-sidebar-foreground/60">No autenticado</div>
          )}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sidebar-foreground/90 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}