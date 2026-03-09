import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ShoppingCart, Truck, Package, Calculator, Receipt, BarChart3,
  ChevronLeft, ChevronRight, User, LogOut, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import logoJBM from "@/assets/logo-jbm.png";

// Sub-modules
import POSTab from "./POSTab";
import RecepcionesTab from "./RecepcionesTab";
import InventarioTab from "./InventarioTab";
import CorteCajaTab from "./CorteCajaTab";
import GastosTab from "./GastosTab";
import DashboardTab from "./DashboardTab";

type TabId = "pos" | "recepciones" | "inventario" | "corte" | "gastos" | "dashboard";

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const TABS: TabConfig[] = [
  { id: "pos", label: "Punto de Venta", icon: ShoppingCart },
  { id: "recepciones", label: "Recepciones", icon: Truck },
  { id: "inventario", label: "Inventario", icon: Package },
  { id: "corte", label: "Corte de Caja", icon: Calculator },
  { id: "gastos", label: "Gastos Locales", icon: Receipt },
  { id: "dashboard", label: "Rentabilidad", icon: BarChart3, adminOnly: true },
];

export default function BodegaCDMX() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("pos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Filter tabs based on role - Dashboard ONLY for admin
  const visibleTabs = TABS.filter(tab => !tab.adminOnly || isAdmin);

  const renderContent = () => {
    switch (activeTab) {
      case "pos":
        return <POSTab />;
      case "recepciones":
        return <RecepcionesTab />;
      case "inventario":
        return <InventarioTab />;
      case "corte":
        return <CorteCajaTab />;
      case "gastos":
        return <GastosTab />;
      case "dashboard":
        // Double security: even if somehow accessed, block non-admin
        return isAdmin ? <DashboardTab /> : null;
      default:
        return <POSTab />;
    }
  };

  return (
    <div className="h-screen flex bg-[#F0F2F5] overflow-hidden">
      {/* ===== LEFT SIDEBAR ===== */}
      <aside
        className={cn(
          "flex flex-col bg-white border-r border-gray-200 transition-all duration-300 shrink-0",
          sidebarCollapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-center border-b border-gray-100 px-3">
          <img
            src={logoJBM}
            alt="JBM"
            className="h-9 w-9 rounded-full object-cover"
          />
          {!sidebarCollapsed && (
            <div className="ml-2 flex flex-col">
              <span className="text-sm font-bold text-[#1E5128] leading-tight">Bodega</span>
              <span className="text-xs text-gray-500 leading-tight">CDMX</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Tooltip key={tab.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                      isActive
                        ? "bg-[#2ECC71]/10 text-[#1E5128] border-l-4 border-[#2ECC71] -ml-0.5 pl-[10px]"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-[#2ECC71]")} />
                    {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}
                  </button>
                </TooltipTrigger>
                {sidebarCollapsed && (
                  <TooltipContent side="right" className="font-medium">
                    {tab.label}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-100 p-3 space-y-2">
          {/* User info */}
          <div className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50",
            sidebarCollapsed && "justify-center"
          )}>
            <div className="h-7 w-7 rounded-full bg-[#1E5128]/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-[#1E5128]" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {user?.email?.split('@')[0] || 'Operador'}
                </p>
                <p className="text-[10px] text-gray-500">
                  {isAdmin ? 'Administrador' : 'Operador CDMX'}
                </p>
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full justify-center text-gray-400 hover:text-gray-600"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-xs">Colapsar</span>
              </>
            )}
          </Button>

          {/* Sign out */}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className={cn(
              "w-full text-gray-500 hover:text-red-600 hover:bg-red-50",
              sidebarCollapsed ? "justify-center" : "justify-start"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span className="ml-2 text-xs">Cerrar Sesión</span>}
          </Button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}
