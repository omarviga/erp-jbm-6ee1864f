import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex items-center border-b border-border/70 bg-background/95 px-4 py-2 md:hidden">
          <SidebarTrigger />
          <span className="ml-2 text-sm font-semibold text-slate-700">Menú</span>
        </div>

        <AppHeader title={title} subtitle={subtitle} />

        <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
