import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Mail, Phone, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AccesoPendiente() {
  const { user, signOut, userRoles } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  // If user has roles, redirect to dashboard
  useEffect(() => {
    if (userRoles.length > 0) {
      navigate('/');
    }
  }, [userRoles, navigate]);

  if (userRoles.length > 0) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">Acceso Pendiente</CardTitle>
          <CardDescription className="text-base">
            Tu cuenta ha sido creada exitosamente, pero aún no tienes roles asignados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">Conectado como:</p>
            <p className="font-medium">{user?.email}</p>
          </div>

          {/* Explanation */}
          <div className="space-y-3">
            <h3 className="font-semibold">¿Qué sigue?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                <span>Un administrador debe asignarte un rol para que puedas acceder al sistema.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                <span>Contacta al administrador del sistema para solicitar acceso.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                <span>Una vez asignado tu rol, actualiza esta página para continuar.</span>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-medium text-sm">Información de Contacto</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>admin@jbm-limon.com</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>+52 (123) 456-7890</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button onClick={handleRefresh} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Verificar acceso
            </Button>
            <Button variant="outline" onClick={handleSignOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
