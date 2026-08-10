import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
}

export function PageHeader({ title, description, icon: Icon }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-1.5 animate-fade-in">
            <div className="flex items-center gap-3">
                {Icon && <Icon className="h-8 w-8 text-primary" />}
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    {title}
                </h1>
            </div>
            {description && (
                <p className="text-muted-foreground text-lg ml-1">
                    {description}
                </p>
            )}
        </div>
    );
}
