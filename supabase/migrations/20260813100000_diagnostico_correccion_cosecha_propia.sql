-- ==========================================================
-- DIAGNÓSTICO: lotes de COSECHA PROPIA registrados como compra
-- a terceros (solo lectura, no modifica ningún dato).
--
-- Causa: la versión anterior del formulario de Recepción
-- guardaba la pestaña "Cosecha Propia" con
--   es_cosecha_propia = false
--   origen           = 'interno'
--   precio_pactado_kg = <precio por CAJA de referencia>
--                       (el campo se etiquetaba "Precio por Caja
--                        para pago a cortadores")
-- y nunca guardaba huerto_id ni las cajas de los cortadores.
--
-- Consecuencia: el trigger trg_sync_cxp_from_lote (que filtra por
-- es_cosecha_propia, no por origen) creó notas en
-- cuentas_por_pagar con importe = kilos × precio_por_caja, muy por
-- encima del valor real, y esos importes se propagaron a
-- productores.saldo_pendiente.
--
-- Firma exacta del bug (el filtro es origen = 'interno', no
-- huerto_id IS NOT NULL: el huerto solo se captura en cosecha
-- propia, así que ese dato no distingue nada por sí solo):
--   COALESCE(es_cosecha_propia, false) = false
--   AND COALESCE(origen, '') = 'interno'
--
-- El rediseño del formulario (quitar transporte, variedad y huerto
-- en compra externa) no cambia este criterio: los lotes nuevos de
-- cosecha propia ya se guardan con es_cosecha_propia = true y los
-- de terceros con origen = 'externo'.
--
-- Uso:
--   SELECT * FROM public.diagnostico_correccion_cosecha_propia();
--   SELECT clasificacion, COUNT(*), SUM(monto_total)
--   FROM public.diagnostico_correccion_cosecha_propia()
--   GROUP BY clasificacion;
-- ==========================================================

CREATE OR REPLACE FUNCTION public.diagnostico_correccion_cosecha_propia()
RETURNS TABLE (
  lote_id UUID,
  numero_lote TEXT,
  fecha_recepcion TIMESTAMPTZ,
  origen TEXT,
  es_cosecha_propia BOOLEAN,
  huerto_id UUID,
  kilos_netos NUMERIC,
  precio_pactado_kg NUMERIC,
  cxp_id UUID,
  monto_total NUMERIC,
  monto_pagado NUMERIC,
  saldo_pendiente NUMERIC,
  estado_cxp TEXT,
  tiene_abonos BOOLEAN,
  lote_liquidado BOOLEAN,
  clasificacion TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se exige rol admin/finanzas cuando la llamada viene de la API (hay JWT).
  -- Sin JWT (SQL Editor, supabase db push, service_role) se permite, porque
  -- es una función de solo lectura y el acceso a la API queda cerrado por
  -- el REVOKE de más abajo.
  IF auth.uid() IS NOT NULL
     AND NOT (
       public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'finanzas'::public.app_role)
     ) THEN
    RAISE EXCEPTION 'No autorizado. Se requiere rol admin o finanzas.';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.numero_lote,
    l.fecha_recepcion,
    l.origen,
    COALESCE(l.es_cosecha_propia, false),
    l.huerto_id,
    COALESCE(l.peso_neto, 0),
    l.precio_pactado_kg,
    c.id,
    COALESCE(c.monto_total, 0),
    COALESCE(c.monto_pagado, 0),
    COALESCE(c.saldo_pendiente, 0),
    c.estado,
    EXISTS (
      SELECT 1 FROM public.abono_asignaciones a WHERE a.cxp_id = c.id
    ),
    EXISTS (
      SELECT 1 FROM public.liquidacion_lotes ll WHERE ll.lote_id = l.id
    ),
    CASE
      WHEN c.id IS NULL THEN 'sin_nota_cxp'
      WHEN COALESCE(c.monto_pagado, 0) > 0.009
        OR EXISTS (SELECT 1 FROM public.abono_asignaciones a WHERE a.cxp_id = c.id)
        OR EXISTS (SELECT 1 FROM public.liquidacion_lotes ll WHERE ll.lote_id = l.id)
        THEN 'requiere_revision_manual'
      WHEN COALESCE(c.monto_total, 0) > 0.009 THEN 'nota_anulable'
      ELSE 'sin_importe'
    END
  FROM public.lotes l
  LEFT JOIN public.cuentas_por_pagar c ON c.lote_id = l.id
  WHERE COALESCE(l.es_cosecha_propia, false) = false
    AND COALESCE(l.origen, '') = 'interno'
  ORDER BY l.fecha_recepcion ASC;
END;
$$;

-- Cierra el acceso vía API a cualquier rol salvo authenticated/service_role;
-- el chequeo de rol de la función decide después quién puede ver el detalle.
REVOKE ALL ON FUNCTION public.diagnostico_correccion_cosecha_propia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnostico_correccion_cosecha_propia() TO authenticated, service_role;

COMMENT ON FUNCTION public.diagnostico_correccion_cosecha_propia() IS
  'Lista los lotes de cosecha propia registrados por error como compra a terceros y el estado de su nota en cuentas_por_pagar. Solo lectura.';

-- Resumen inmediato al aplicar la migración (aparece en el panel de avisos).
DO $$
DECLARE
  v_total INTEGER := 0;
  v_anulables INTEGER := 0;
  v_manual INTEGER := 0;
  v_sin_nota INTEGER := 0;
  v_importe NUMERIC := 0;
  v_pagado NUMERIC := 0;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE clasificacion = 'nota_anulable'),
    COUNT(*) FILTER (WHERE clasificacion = 'requiere_revision_manual'),
    COUNT(*) FILTER (WHERE clasificacion = 'sin_nota_cxp'),
    COALESCE(SUM(monto_total), 0),
    COALESCE(SUM(monto_pagado), 0)
  INTO v_total, v_anulables, v_manual, v_sin_nota, v_importe, v_pagado
  FROM public.diagnostico_correccion_cosecha_propia();

  RAISE NOTICE 'Diagnóstico cosecha propia: % lote(s) afectado(s).', v_total;
  RAISE NOTICE '  - Notas anulables automáticamente: %', v_anulables;
  RAISE NOTICE '  - Requieren revisión manual (ya tienen pagos): %', v_manual;
  RAISE NOTICE '  - Lotes sin nota de CxP: %', v_sin_nota;
  RAISE NOTICE '  - Importe inflado total en cuentas_por_pagar: $%', v_importe;
  RAISE NOTICE '  - Importe ya pagado sobre esas notas: $%', v_pagado;
  RAISE NOTICE 'Revisa el detalle con: SELECT * FROM public.diagnostico_correccion_cosecha_propia();';
END;
$$;
