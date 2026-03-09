import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, LogIn, AlertCircle, Mail, Lock, MapPin, Phone, ShieldCheck } from 'lucide-react';
import logoJBM from '@/assets/logo-jbm.png';
import limesHero from '@/assets/limes-hero.jpg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos'
        : error.message);
      setIsLoading(false);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Hero */}
      <div className="relative lg:w-1/2 min-h-[300px] lg:min-h-screen bg-[hsl(150,40%,18%)] flex flex-col justify-between overflow-hidden">
        {/* Background image overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${limesHero})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(150,40%,12%)]/80 via-[hsl(150,40%,15%)]/60 to-[hsl(150,40%,10%)]/90" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-12">
          {/* Logo */}
          <div>
            <img src={logoJBM} alt="JBM Cítricos Premium" className="h-28 lg:h-36 w-auto object-contain drop-shadow-lg" />
          </div>

          {/* Tagline */}
          <div className="my-8 lg:my-0">
            <h1 className="text-3xl lg:text-5xl font-bold text-white leading-tight mb-6">
              Limones Barragán:<br />
              Excelencia desde el Origen
            </h1>
            <p className="text-white/70 text-sm lg:text-base max-w-md leading-relaxed">
              Acceso exclusivo al sistema de planificación de recursos empresariales (ERP).
              Gestione la calidad y la logística de cítricos premium con herramientas de vanguardia.
            </p>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center gap-4 text-white/50 text-xs uppercase tracking-[0.2em] font-medium">
            <span>Calidad</span>
            <span>•</span>
            <span>Innovación</span>
            <span>•</span>
            <span>Sostenibilidad</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="lg:w-1/2 flex flex-col bg-background">
        {/* SSL badge */}
        <div className="flex justify-end p-4 lg:p-6">
          <div className="flex items-center gap-1.5 text-xs text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="uppercase tracking-wider font-medium">Conexión encriptada SSL/TLS</span>
          </div>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-6 pb-8 lg:px-16">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-foreground">Acceso ERP</h2>
              <p className="text-muted-foreground mt-1">Ingrese sus credenciales institucionales</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@jbmcitricos.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 pl-10 bg-muted/30 border-border"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">Contraseña</Label>
                  <button type="button" className="text-xs text-primary hover:underline">
                    ¿Olvidó su contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 pl-10 bg-muted/30 border-border"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="remember" />
                <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Recordar sesión en este equipo
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-lime hover:bg-lime-dark text-foreground font-bold text-sm uppercase tracking-wider"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    Iniciar Sesión
                    <LogIn className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{' '}
                <Link to="/registro" className="text-primary font-medium hover:underline">
                  Regístrate aquí
                </Link>
              </div>
            </form>

            {/* Footer info */}
            <div className="pt-6 border-t border-border space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Carretera Federal 129, Col. Centro, Martínez de la Torre, Veracruz</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>+52 (232) 123 4567 • soporte@jbmcitricos.com</span>
              </div>
              <p className="pt-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                © 2024 JBM Cítricos Premium • Limones Barragán S.A. de C.V.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
