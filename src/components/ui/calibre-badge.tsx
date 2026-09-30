import { cn } from "@/lib/utils";

interface CalibreBadgeProps {
    calibre: string;
    className?: string;
    size?: "default" | "sm" | "lg";
}

export function CalibreBadge({
    calibre,
    className,
    size = "default"
}: CalibreBadgeProps) {
    const norm = calibre?.toString().toUpperCase() || "";

    let colorClass = "bg-slate-100 text-slate-700 border-slate-200";

    if (norm.startsWith("V-")) colorClass = "bg-green-100 text-green-800 border-green-200";
    else if (norm.startsWith("AL-")) colorClass = "bg-lime-100 text-lime-800 border-lime-200";
    else if (norm.startsWith("AM-")) colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200";

    const sizes = {
        default: "h-auto min-w-[2.5rem] px-2 py-1 text-xs",
        sm: "h-auto min-w-[2rem] px-1.5 py-0.5 text-[10px]",
        lg: "h-auto min-w-[3rem] px-3 py-1.5 text-sm",
    };

    return (
        <div className={cn(
            "flex items-center justify-center rounded-full border font-bold shadow-sm whitespace-nowrap",
            colorClass,
            sizes[size],
            className
        )}>
            {calibre}
        </div>
    );
}
