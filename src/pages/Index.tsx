import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { ProductionChart } from "@/components/dashboard/ProductionChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentLotes } from "@/components/dashboard/RecentLotes";
import { Scale, Package, Snowflake, Factory } from "lucide-react";

const Dashboard = () => {
  return (
    <MainLayout title="Dashboard" subtitle="Panel de control JBM Cítricos">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Kilos Recibidos Hoy"
          value={12450}
          unit="kg"
          icon={Scale}
          variant="primary"
          trend={{ value: 8.2, isPositive: true }}
        />
        <KPICard
          title="Cajas Empacadas Hoy"
          value={856}
          unit="cajas"
          icon={Package}
          variant="success"
          trend={{ value: 12.5, isPositive: true }}
        />
        <KPICard
          title="Stock Cámara Fría"
          value={4280}
          unit="cajas"
          icon={Snowflake}
          variant="cold"
        />
        <KPICard
          title="Stock Molino"
          value={8.5}
          unit="ton"
          icon={Factory}
          variant="warning"
        />
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <AlertCard
          type="critical"
          title="Lotes por Vencer"
          description="5 lotes con más de 15 días almacenados requieren atención urgente"
          count={5}
          action={{
            label: "Ver lotes",
            onClick: () => console.log("Ver lotes por vencer"),
          }}
        />
        <AlertCard
          type="warning"
          title="Documentación Faltante"
          description="2 embarques para USA sin documentación completa"
          count={2}
          action={{
            label: "Completar documentos",
            onClick: () => console.log("Completar documentos"),
          }}
        />
        <AlertCard
          type="info"
          title="Merma Controlada"
          description="La merma del día está en 3.2%, dentro del rango aceptable"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart - Takes 2 columns */}
        <div className="lg:col-span-2">
          <ProductionChart />
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <QuickActions />
        </div>
      </div>

      {/* Recent Lotes */}
      <div className="mt-6">
        <RecentLotes />
      </div>
    </MainLayout>
  );
};

export default Dashboard;
