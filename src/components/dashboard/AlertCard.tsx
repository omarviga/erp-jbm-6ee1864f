import { cn } from "@/lib/utils";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";

interface AlertCardProps {
  title: string;
  description: string;
  type: "critical" | "warning" | "info";
  count?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const alertConfig = {
  critical: {
    icon: AlertCircle,
    className: "alert-critical border",
    iconClass: "text-destructive",
    emoji: "🔴",
  },
  warning: {
    icon: AlertTriangle,
    className: "alert-warning border",
    iconClass: "text-warning-foreground",
    emoji: "⚠️",
  },
  info: {
    icon: Info,
    className: "alert-info border",
    iconClass: "text-cold-foreground",
    emoji: "ℹ️",
  },
};

export function AlertCard({ title, description, type, count, action }: AlertCardProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn("rounded-lg p-4 animate-fade-in", config.className)}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", config.iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{title}</h4>
            {count !== undefined && (
              <span className="bg-foreground/10 text-xs font-bold px-2 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </div>
          <p className="text-sm opacity-80 mt-1">{description}</p>
          {action && (
            <button
              onClick={action.onClick}
              className="text-sm font-medium underline-offset-4 hover:underline mt-2"
            >
              {action.label} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
