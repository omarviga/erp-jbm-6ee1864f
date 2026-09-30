import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    description?: string;
    variant?: "default" | "primary" | "secondary" | "success" | "warning" | "destructive";
}

export function StatCard({
    title,
    value,
    icon: Icon,
    description,
    variant = "default"
}: StatCardProps) {
    const variants = {
        default: "bg-card text-card-foreground",
        primary: "bg-primary/10 text-primary border-primary/20",
        secondary: "bg-secondary/50 text-secondary-foreground border-secondary",
        success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
        warning: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
        destructive: "bg-destructive/10 text-destructive border-destructive/20",
    };

    const iconVariants = {
        default: "text-muted-foreground",
        primary: "text-primary",
        secondary: "text-secondary-foreground",
        success: "text-green-600 dark:text-green-400",
        warning: "text-yellow-600 dark:text-yellow-400",
        destructive: "text-destructive",
    };

    return (
        <Card className={cn("transition-all hover:shadow-md", variants[variant])}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
                <Icon className={cn("h-4 w-4", iconVariants[variant])} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
