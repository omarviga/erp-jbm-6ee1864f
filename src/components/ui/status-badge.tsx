import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType =
    | "default"
    | "success"
    | "warning"
    | "destructive"
    | "outline"
    | "secondary"
    | "primera"
    | "segunda"
    | "industria"
    | "pagada"
    | "pendiente"
    | "cancelada";

interface StatusBadgeProps {
    children: React.ReactNode;
    variant?: StatusType;
    className?: string;
    size?: "default" | "sm" | "lg";
}

export function StatusBadge({
    children,
    variant = "default",
    className,
    size = "default"
}: StatusBadgeProps) {
    const variants: Record<string, string> = {
        // Standard variants
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border border-input hover:bg-accent hover:text-accent-foreground",

        // Semantic variants
        success: "bg-green-500/15 text-green-700 border-green-200 hover:bg-green-500/25 dark:text-green-400 dark:border-green-800",
        warning: "bg-yellow-500/15 text-yellow-700 border-yellow-200 hover:bg-yellow-500/25 dark:text-yellow-400 dark:border-yellow-800",

        // Business logic variants
        primera: "bg-blue-500/15 text-blue-700 border-blue-200 hover:bg-blue-500/25 dark:text-blue-400 dark:border-blue-800",
        segunda: "bg-orange-500/15 text-orange-700 border-orange-200 hover:bg-orange-500/25 dark:text-orange-400 dark:border-orange-800",
        industria: "bg-slate-500/15 text-slate-700 border-slate-200 hover:bg-slate-500/25 dark:text-slate-400 dark:border-slate-800",

        pagada: "bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/25 dark:text-emerald-400 dark:border-emerald-800",
        pendiente: "bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/25 dark:text-amber-400 dark:border-amber-800",
        cancelada: "bg-red-500/15 text-red-700 border-red-200 hover:bg-red-500/25 dark:text-red-400 dark:border-red-800",
    };

    const sizes = {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-[1px] text-[10px]",
        lg: "px-3 py-1 text-sm",
    };

    return (
        <div className={cn(
            "inline-flex items-center rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            variants[variant as string] || variants.default,
            sizes[size],
            className
        )}>
            {children}
        </div>
    );
}
