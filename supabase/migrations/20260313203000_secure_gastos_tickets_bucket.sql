-- Secure receipts/evidence bucket for production use.
-- Switches the bucket to private and replaces broad authenticated policies
-- with explicit internal role-based access.

UPDATE storage.buckets
SET public = false
WHERE id = 'gastos-tickets';

DROP POLICY IF EXISTS "Authenticated users can upload tickets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view tickets" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete tickets" ON storage.objects;

CREATE POLICY "Role-based upload gastos tickets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gastos-tickets'
  AND auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Role-based view gastos tickets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gastos-tickets'
  AND auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'ventas'::app_role)
    OR has_role(auth.uid(), 'almacen'::app_role)
  )
);

CREATE POLICY "Admin can delete gastos tickets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'gastos-tickets'
  AND auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);
