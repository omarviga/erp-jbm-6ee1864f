import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "warning" | "cold" | "success";
  className?: string;
}

const variantStyles = {
  default: {
    container: "kpi-card",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
  primary: {
    container: "kpi-card border-primary/20",
    icon: "bg-primary/10 text-primary",
    value: "text-primary",
  },
  warning: {
    container: "kpi-card border-warning/20",
    icon: "bg-warning/10 text-warning-foreground",
    value: "text-warning-foreground",
  },
  cold: {
    container: "kpi-card border-cold-foreground/20",
    icon: "bg-cold text-cold-foreground",
    value: "text-cold-foreground",
  },
  success: {
    container: "kpi-card border-success/20",
    icon: "bg-success/10 text-success",
    value: "text-success",
  },
};

export function KPICard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: KPICardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn(styles.container, "animate-fade-in", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="kpi-label">{title}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={cn("kpi-value", styles.value)}>
              {typeof value === "number" ? value.toLocaleString("es-MX") : value}
            </span>
            {unit && (
              <span className="text-lg font-medium text-muted-foreground">{unit}</span>
            )}
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-sm font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal">vs ayer</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", styles.icon)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
