
-- Create categoria_gasto enum
CREATE TYPE public.categoria_gasto AS ENUM (
  'mantenimiento',
  'viaticos',
  'combustible',
  'papeleria',
  'limpieza',
  'refacciones',
  'servicios',
  'otros'
);

-- Create gastos table
CREATE TABLE public.gastos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  concepto TEXT NOT NULL,
  categoria categoria_gasto NOT NULL DEFAULT 'otros',
  monto NUMERIC NOT NULL DEFAULT 0,
  proveedor TEXT,
  numero_ticket TEXT,
  notas TEXT,
  imagen_url TEXT,
  usuario_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Role-based view gastos"
  ON public.gastos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'finanzas'::app_role)
  ));

CREATE POLICY "Role-based insert gastos"
  ON public.gastos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'finanzas'::app_role)
  ));

CREATE POLICY "Role-based update gastos"
  ON public.gastos FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'finanzas'::app_role)
  ));

CREATE POLICY "Admin can delete gastos"
  ON public.gastos FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('gastos-tickets', 'gastos-tickets', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload tickets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gastos-tickets');

CREATE POLICY "Anyone can view tickets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'gastos-tickets');

CREATE POLICY "Admin can delete tickets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gastos-tickets' AND auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
