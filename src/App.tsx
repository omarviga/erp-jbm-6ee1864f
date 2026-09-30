import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Registro = lazy(() => import("./pages/Registro"));
const AccesoPendiente = lazy(() => import("./pages/AccesoPendiente"));
const AdminUsuarios = lazy(() => import("./pages/AdminUsuarios"));
const Recepcion = lazy(() => import("./pages/Recepcion"));
const Produccion = lazy(() => import("./pages/Produccion"));
const Inventarios = lazy(() => import("./pages/Inventarios"));
const Logistica = lazy(() => import("./pages/Logistica"));
const BodegaCDMX = lazy(() => import("./pages/BodegaCDMX"));
const Facturacion = lazy(() => import("./pages/Facturacion"));
const Finanzas = lazy(() => import("./pages/Finanzas"));
const Insumos = lazy(() => import("./pages/Insumos"));
const Reportes = lazy(() => import("./pages/Reportes"));
const Productores = lazy(() => import("./pages/Productores"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const LoteExpediente = lazy(() => import("./components/trazabilidad/LoteExpediente"));
const Maquila = lazy(() => import("./pages/Maquila"));
const Gastos = lazy(() => import("./pages/Gastos"));
const Ayuda = lazy(() => import("./pages/Ayuda"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 text-sm text-muted-foreground shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      Cargando módulo...
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/registro" element={<Registro />} />

                {/* Access pending route (no roles required) */}
                <Route path="/acceso-pendiente" element={
                  <ProtectedRoute requireRoles={false}>
                    <AccesoPendiente />
                  </ProtectedRoute>
                } />

                {/* Admin-only routes */}
                <Route path="/admin/usuarios" element={
                  <ProtectedRoute adminOnly>
                    <AdminUsuarios />
                  </ProtectedRoute>
                } />

                {/* Protected routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } />
                <Route path="/recepcion" element={
                  <ProtectedRoute allowedRoles={["almacen"]}>
                    <Recepcion />
                  </ProtectedRoute>
                } />
                <Route path="/produccion" element={
                  <ProtectedRoute allowedRoles={["produccion"]}>
                    <Produccion />
                  </ProtectedRoute>
                } />
                <Route path="/inventarios" element={
                  <ProtectedRoute allowedRoles={["produccion", "almacen"]}>
                    <Inventarios />
                  </ProtectedRoute>
                } />
                <Route path="/camara-fria" element={<Navigate to="/inventarios" replace />} />
                <Route path="/logistica" element={
                  <ProtectedRoute allowedRoles={["almacen"]}>
                    <Logistica />
                  </ProtectedRoute>
                } />
                
                {/* BODEGA CDMX - Full module with sub-tabs */}
                <Route path="/bodega-cdmx" element={
                  <ProtectedRoute allowedRoles={["ventas", "almacen", "finanzas"]}>
                    <BodegaCDMX />
                  </ProtectedRoute>
                } />

                <Route path="/facturacion" element={
                  <ProtectedRoute allowedRoles={["finanzas"]}>
                    <Facturacion />
                  </ProtectedRoute>
                } />
                <Route path="/finanzas" element={
                  <ProtectedRoute allowedRoles={["finanzas"]}>
                    <Finanzas />
                  </ProtectedRoute>
                } />
                <Route path="/insumos" element={
                  <ProtectedRoute allowedRoles={["produccion", "almacen"]}>
                    <Insumos />
                  </ProtectedRoute>
                } />
                <Route path="/reportes" element={
                  <ProtectedRoute allowedRoles={["finanzas"]}>
                    <Reportes />
                  </ProtectedRoute>
                } />
                <Route path="/productores" element={
                  <ProtectedRoute allowedRoles={["almacen", "finanzas"]}>
                    <Productores />
                  </ProtectedRoute>
                } />
                <Route path="/configuracion" element={
                  <ProtectedRoute adminOnly>
                    <Configuracion />
                  </ProtectedRoute>
                } />
                <Route path="/lotes/:loteId" element={
                  <ProtectedRoute allowedRoles={["produccion", "almacen", "finanzas"]}>
                    <LoteExpediente />
                  </ProtectedRoute>
                } />
                <Route path="/maquila" element={
                  <ProtectedRoute allowedRoles={["produccion"]}>
                    <Maquila />
                  </ProtectedRoute>
                } />
                <Route path="/gastos" element={
                  <ProtectedRoute allowedRoles={["finanzas"]}>
                    <Gastos />
                  </ProtectedRoute>
                } />
                <Route path="/ayuda" element={
                  <ProtectedRoute requireRoles={false}>
                    <Ayuda />
                  </ProtectedRoute>
                } />

                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
