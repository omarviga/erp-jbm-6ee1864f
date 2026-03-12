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
  { title: "Inventarios", href: "/inventarios", icon: Snowflake },
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
      <SidebarHeader className="flex h-32 items-center justify-center px-4 pt-6 pb-2">
        <div className="flex flex-col items-center gap-2">
          <img
            src={logoJBM}
            alt="JBM"
            className="w-24 object-contain transition-all group-data-[collapsible=icon]:w-10"
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Operación citrícola
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
            Operación
          </p>
          <SidebarMenu className="gap-2">
            {mainNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.href}
                  className={cn(
                    "h-12 rounded-xl text-base font-medium transition-colors hover:bg-white/10 hover:text-white",
                    "data-[active=true]:bg-[#65a30d] data-[active=true]:text-white data-[active=true]:shadow-md"
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

        <div className="mt-6 border-t border-sidebar-border pt-4">
          <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
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
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
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
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
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
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sidebar-foreground/90 transition-colors hover:bg-white/5 hover:text-red-400"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
