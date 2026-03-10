-- Crear enum para tipos de notificación
CREATE TYPE public.notification_type AS ENUM (
  'info',
  'warning', 
  'success',
  'error',
  'alert'
);

-- Crear enum para categorías de notificación
CREATE TYPE public.notification_category AS ENUM (
  'inventario',
  'transferencia',
  'venta',
  'corte_caja',
  'produccion',
  'sistema'
);

-- Tabla de notificaciones
CREATE TABLE public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo notification_type NOT NULL DEFAULT 'info',
  categoria notification_category NOT NULL DEFAULT 'sistema',
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT false,
  referencia_id UUID,
  referencia_tipo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_notificaciones_user_id ON public.notificaciones(user_id);
CREATE INDEX idx_notificaciones_leida ON public.notificaciones(user_id, leida) WHERE leida = false;
CREATE INDEX idx_notificaciones_created_at ON public.notificaciones(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios ven sus notificaciones"
ON public.notificaciones FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Sistema puede crear notificaciones"
ON public.notificaciones FOR INSERT
WITH CHECK (true);

CREATE POLICY "Usuarios actualizan sus notificaciones"
ON public.notificaciones FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin puede eliminar notificaciones"
ON public.notificaciones FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;