-- Secure sensitive customer data by splitting the table
-- 1. Create new sensitive data table
CREATE TABLE IF NOT EXISTS public.clientes_sensible (
    id UUID PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
    email TEXT,
    telefono TEXT,
    direccion TEXT,
    limite_credito DECIMAL(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS on new table
ALTER TABLE public.clientes_sensible ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_sensible FORCE ROW LEVEL SECURITY;

-- 3. Migrate existing data (safeguard: check if columns exist before trying to move)
-- We use a DO block to handle potential repeated execution safely or compilation errors provided columns exist
DO $$
BEGIN
    -- Only migrate if specific columns still exist in 'clientes'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'email') THEN
        INSERT INTO public.clientes_sensible (id, email, telefono, direccion, limite_credito)
        SELECT id, email, telefono, direccion, limite_credito
        FROM public.clientes;
    END IF;
END $$;

-- 4. Drop columns from public table (schema modification)
ALTER TABLE public.clientes 
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS telefono,
DROP COLUMN IF EXISTS direccion,
DROP COLUMN IF EXISTS limite_credito;

-- 5. Create RLS Policies for sensitive table
-- Only Admin and Finanzas can view sensitive data. Ventas CANNOT.

DROP POLICY IF EXISTS "Restricted access to sensitive info" ON public.clientes_sensible;

CREATE POLICY "Restricted access to sensitive info"
ON public.clientes_sensible
FOR ALL
TO authenticated
USING (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  (auth.uid() IS NOT NULL)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

-- 6. Grant basic permissions
GRANT ALL ON public.clientes_sensible TO authenticated;
GRANT ALL ON public.clientes_sensible TO service_role;
