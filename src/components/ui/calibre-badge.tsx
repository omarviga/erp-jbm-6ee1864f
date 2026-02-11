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
    // Normalize calibre string
    const normCalibre = calibre?.toString().toUpperCase() || "";

    // Determine color based on calibre logic
    let colorClass = "bg-slate-100 text-slate-700 border-slate-200"; // Default

    if (["37", "40", "4"].includes(normCalibre)) colorClass = "bg-green-100 text-green-800 border-green-200";
    else if (["110", "150", "X"].includes(normCalibre)) colorClass = "bg-blue-100 text-blue-800 border-blue-200";
    else if (["175", "200", "XX"].includes(normCalibre)) colorClass = "bg-purple-100 text-purple-800 border-purple-200";
    else if (["230", "250", "XXX"].includes(normCalibre)) colorClass = "bg-pink-100 text-pink-800 border-pink-200";

    const sizes = {
        default: "h-8 w-8 text-sm",
        sm: "h-6 w-6 text-xs",
        lg: "h-10 w-10 text-base",
    };

    return (
        <div className={cn(
            "flex items-center justify-center rounded-full border font-bold shadow-sm",
            colorClass,
            sizes[size],
            className
        )}>
            {calibre}
        </div>
    );
}
