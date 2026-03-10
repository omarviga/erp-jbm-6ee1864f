import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import AccesoPendiente from "./pages/AccesoPendiente";
import AdminUsuarios from "./pages/AdminUsuarios";
import Recepcion from "./pages/Recepcion";
import Produccion from "./pages/Produccion";
import Inventarios from "./pages/Inventarios";
import Logistica from "./pages/Logistica";
import BodegaCDMX from "./pages/BodegaCDMX";
import Facturacion from "./pages/Facturacion";
import Finanzas from "./pages/Finanzas";
import Insumos from "./pages/Insumos";
import Reportes from "./pages/Reportes";
import Productores from "./pages/Productores";
import Configuracion from "./pages/Configuracion";
import LoteExpediente from "./components/trazabilidad/LoteExpediente";
import Maquila from "./pages/Maquila";
import Gastos from "./pages/Gastos";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "./pages/NotFound";
import { useSupabase } from '@/hooks/useSupabase';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
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
                <ProtectedRoute>
                  <Recepcion />
                </ProtectedRoute>
              } />
              <Route path="/produccion" element={
                <ProtectedRoute>
                  <Produccion />
                </ProtectedRoute>
              } />
              <Route path="/inventarios" element={
                <ProtectedRoute>
                  <Inventarios />
                </ProtectedRoute>
              } />
              <Route path="/camara-fria" element={<Navigate to="/inventarios" replace />} />
              <Route path="/logistica" element={
                <ProtectedRoute>
                  <Logistica />
                </ProtectedRoute>
              } />
              
              {/* BODEGA CDMX - Full module with sub-tabs */}
              <Route path="/bodega-cdmx" element={
                <ProtectedRoute>
                  <BodegaCDMX />
                </ProtectedRoute>
              } />

              <Route path="/facturacion" element={
                <ProtectedRoute>
                  <Facturacion />
                </ProtectedRoute>
              } />
              <Route path="/finanzas" element={
                <ProtectedRoute>
                  <Finanzas />
                </ProtectedRoute>
              } />
              <Route path="/insumos" element={
                <ProtectedRoute>
                  <Insumos />
                </ProtectedRoute>
              } />
              <Route path="/reportes" element={
                <ProtectedRoute>
                  <Reportes />
                </ProtectedRoute>
              } />
              <Route path="/productores" element={
                <ProtectedRoute>
                  <Productores />
                </ProtectedRoute>
              } />
              <Route path="/configuracion" element={
                <ProtectedRoute>
                  <Configuracion />
                </ProtectedRoute>
              } />
              <Route path="/lotes/:loteId" element={
                <ProtectedRoute>
                  <LoteExpediente />
                </ProtectedRoute>
              } />
              <Route path="/maquila" element={
                <ProtectedRoute>
                  <Maquila />
                </ProtectedRoute>
              } />
              <Route path="/gastos" element={
                <ProtectedRoute>
                  <Gastos />
                </ProtectedRoute>
              } />

              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;