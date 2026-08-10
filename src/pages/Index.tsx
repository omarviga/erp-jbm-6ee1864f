import { Suspense, lazy } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentLotes } from "@/components/dashboard/RecentLotes";
import { Scale, Package, Snowflake, Factory } from "lucide-react";

const ProductionChart = lazy(() =>
  import("@/components/dashboard/ProductionChart").then((module) => ({ default: module.ProductionChart })),
);

const Dashboard = () => {
  return (
    <MainLayout title="Dashboard" subtitle="Panel de control JBM Cítricos">
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Kilos Recibidos Hoy" value={0} unit="kg" icon={Scale} variant="primary" />
        <KPICard title="Cajas Empacadas Hoy" value={0} unit="cajas" icon={Package} variant="success" />
        <KPICard title="Stock Inventarios" value={0} unit="cajas" icon={Snowflake} variant="cold" />
        <KPICard title="Stock Molino" value={0} unit="ton" icon={Factory} variant="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-3">
        <AlertCard
          type="info"
          title="Lotes por Vencer"
          description="Actualmente no hay lotes pendientes por vencer."
          count={0}
        />
        <AlertCard
          type="info"
          title="Documentación Faltante"
          description="No hay embarques con documentación pendiente."
          count={0}
        />
        <AlertCard
          type="info"
          title="Merma Controlada"
          description="Sin registros de merma para mostrar por el momento."
          count={0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-[320px] rounded-xl border bg-white animate-pulse" />}>
            <ProductionChart />
          </Suspense>
        </div>

        <div className="space-y-6">
          <QuickActions />
        </div>
      </div>

      <div className="mt-6">
        <RecentLotes />
      </div>
    </MainLayout>
  );
};

export default Dashboard;
