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
    // 1. El Provider envuelve TODO
    <SidebarProvider>

      {/* 2. El Sidebar va primero */}
      <AppSidebar />

      {/* 3. El Inset es el contenedor del resto de la página.
          Automáticamente empuja el contenido cuando el menú se abre. */}
      <SidebarInset>

        {/* Header con botón para abrir/cerrar menú (opcional) */}
        <div className="flex items-center px-4 py-2 border-b md:hidden">
          <SidebarTrigger />
          <span className="ml-2 font-semibold">Menú</span>
        </div>

        <AppHeader title={title} subtitle={subtitle} />

        <main className="p-6">
          {children}
        </main>

      </SidebarInset>
    </SidebarProvider>
  );
}