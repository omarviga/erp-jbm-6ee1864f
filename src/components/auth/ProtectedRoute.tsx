import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { AppRole, canAccessByRoles } from '@/lib/access-control';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRoles?: boolean;
  adminOnly?: boolean;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({
  children,
  requireRoles = true,
  adminOnly = false,
  allowedRoles,
}: ProtectedRouteProps) {
  const { session, loading, userRoles, isAdmin, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    // Save the attempted location for redirecting after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for admin-only routes
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // If user has no roles and roles are required, redirect to pending access page
  if (requireRoles && userRoles.length === 0 && location.pathname !== '/acceso-pendiente') {
    return <Navigate to="/acceso-pendiente" replace />;
  }

  if (!canAccessByRoles(allowedRoles, isAdmin, hasRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
