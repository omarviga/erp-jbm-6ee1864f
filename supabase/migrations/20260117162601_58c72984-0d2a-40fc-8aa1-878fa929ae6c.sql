-- Enums para el sistema
CREATE TYPE public.estado_lote AS ENUM ('pendiente', 'en_proceso', 'liquidado');
CREATE TYPE public.calibre_limon AS ENUM ('200', '300', '400', '500', '600', 'extras');
CREATE TYPE public.color_limon AS ENUM ('verde_oscuro', 'verde', 'alimonado', 'amarillo');
CREATE TYPE public.calidad_limon AS ENUM ('primera', 'segunda', 'industria');
CREATE TYPE public.destino_produccion AS ENUM ('piso_empaque', 'camara_fria', 'molino');
CREATE TYPE public.tipo_cliente AS ENUM ('nacional', 'mayorista', 'exportacion_usa');
CREATE TYPE public.tipo_insumo AS ENUM ('caja_plastica', 'arpilla', 'tarima', 'esquinero', 'fleje');
CREATE TYPE public.forma_pago AS ENUM ('efectivo', 'cheque', 'transferencia');
CREATE TYPE public.app_role AS ENUM ('admin', 'produccion', 'finanzas', 'ventas', 'almacen');

-- Tabla de productores
CREATE TABLE public.productores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  rfc TEXT,
  saldo_anticipos DECIMAL(12,2) DEFAULT 0,
  saldo_pendiente DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de huertos (cosecha propia)
CREATE TABLE public.huertos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  hectareas DECIMAL(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de cortadores
CREATE TABLE public.cortadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de lotes
CREATE TABLE public.lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lote TEXT UNIQUE NOT NULL,
  productor_id UUID REFERENCES public.productores(id),
  huerto_id UUID REFERENCES public.huertos(id),
  es_cosecha_propia BOOLEAN DEFAULT false,
  fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT now(),
  peso_bruto DECIMAL(10,2) NOT NULL,
  peso_tara DECIMAL(10,2) NOT NULL DEFAULT 0,
  peso_neto DECIMAL(10,2) GENERATED ALWAYS AS (peso_bruto - peso_tara) STORED,
  precio_pactado_kg DECIMAL(10,2),
  estado estado_lote NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registro de cortadores por lote (cosecha propia)
CREATE TABLE public.lote_cortadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE NOT NULL,
  cortador_id UUID REFERENCES public.cortadores(id) NOT NULL,
  cajas_recolectadas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Presentaciones de empaque
CREATE TABLE public.presentaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  peso_kg DECIMAL(6,2) NOT NULL,
  tipo TEXT NOT NULL,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de producción (clasificación)
CREATE TABLE public.produccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE NOT NULL,
  calibre calibre_limon NOT NULL,
  color color_limon NOT NULL,
  calidad calidad_limon NOT NULL,
  presentacion_id UUID REFERENCES public.presentaciones(id),
  cantidad_cajas INTEGER NOT NULL DEFAULT 0,
  peso_total_kg DECIMAL(10,2),
  destino destino_produccion NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventario cámara fría
CREATE TABLE public.camara_fria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produccion_id UUID REFERENCES public.produccion(id) ON DELETE CASCADE NOT NULL,
  fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT now(),
  cantidad_cajas INTEGER NOT NULL,
  cantidad_disponible INTEGER NOT NULL,
  temperatura_actual DECIMAL(4,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registro de temperaturas
CREATE TABLE public.registro_temperaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camara_fria_id UUID REFERENCES public.camara_fria(id) ON DELETE CASCADE NOT NULL,
  temperatura DECIMAL(4,1) NOT NULL,
  registrado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock molino (industria)
CREATE TABLE public.stock_molino (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE NOT NULL,
  peso_kg DECIMAL(10,2) NOT NULL,
  peso_disponible DECIMAL(10,2) NOT NULL,
  fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo tipo_cliente NOT NULL DEFAULT 'nacional',
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  limite_credito DECIMAL(12,2) DEFAULT 0,
  dias_credito INTEGER DEFAULT 0,
  saldo_deudor DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guías de salida (embarques)
CREATE TABLE public.guias_salida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_guia TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  fecha_salida TIMESTAMPTZ NOT NULL DEFAULT now(),
  destino TEXT,
  -- Documentos para exportación USA
  certificado_fitosanitario BOOLEAN DEFAULT false,
  fda_prior_notice BOOLEAN DEFAULT false,
  carta_porte BOOLEAN DEFAULT false,
  temperatura_precarga DECIMAL(4,1),
  documentacion_completa BOOLEAN DEFAULT false,
  total_cajas INTEGER DEFAULT 0,
  valor_total DECIMAL(12,2) DEFAULT 0,
  notas TEXT,
  finalizada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detalle de guías de salida
CREATE TABLE public.guia_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id UUID REFERENCES public.guias_salida(id) ON DELETE CASCADE NOT NULL,
  camara_fria_id UUID REFERENCES public.camara_fria(id),
  stock_molino_id UUID REFERENCES public.stock_molino(id),
  cantidad INTEGER NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insumos
CREATE TABLE public.insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo tipo_insumo NOT NULL,
  cantidad_disponible INTEGER NOT NULL DEFAULT 0,
  cantidad_minima INTEGER NOT NULL DEFAULT 0,
  costo_unitario DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Movimientos de insumos
CREATE TABLE public.insumo_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id UUID REFERENCES public.insumos(id) ON DELETE CASCADE NOT NULL,
  tipo_movimiento TEXT NOT NULL, -- 'entrada' | 'salida' | 'ajuste'
  cantidad INTEGER NOT NULL,
  referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anticipos a productores
CREATE TABLE public.anticipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id UUID REFERENCES public.productores(id) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  forma_pago forma_pago NOT NULL,
  referencia TEXT,
  amortizado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Liquidaciones a productores
CREATE TABLE public.liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id UUID REFERENCES public.productores(id) NOT NULL,
  fecha_liquidacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_kilos DECIMAL(12,2) NOT NULL,
  precio_por_kg DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (total_kilos * precio_por_kg) STORED,
  deduccion_corte DECIMAL(12,2) DEFAULT 0,
  deduccion_flete DECIMAL(12,2) DEFAULT 0,
  deduccion_anticipo DECIMAL(12,2) DEFAULT 0,
  total_pagar DECIMAL(12,2),
  forma_pago forma_pago NOT NULL,
  referencia_pago TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lotes incluidos en liquidación
CREATE TABLE public.liquidacion_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id UUID REFERENCES public.liquidaciones(id) ON DELETE CASCADE NOT NULL,
  lote_id UUID REFERENCES public.lotes(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ventas (POS)
CREATE TABLE public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_venta TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  fecha_venta TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT NOT NULL, -- 'mayorista' | 'molino' | 'pos_cdmx'
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  pagado BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detalle de ventas
CREATE TABLE public.venta_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES public.ventas(id) ON DELETE CASCADE NOT NULL,
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pagos de clientes
CREATE TABLE public.pagos_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  venta_id UUID REFERENCES public.ventas(id),
  monto DECIMAL(12,2) NOT NULL,
  forma_pago forma_pago NOT NULL,
  referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (siguiendo mejores prácticas de seguridad)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_productores_updated_at BEFORE UPDATE ON public.productores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lotes_updated_at BEFORE UPDATE ON public.lotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_camara_fria_updated_at BEFORE UPDATE ON public.camara_fria FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_guias_salida_updated_at BEFORE UPDATE ON public.guias_salida FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generador de número de lote
CREATE OR REPLACE FUNCTION public.generate_lote_number()
RETURNS TEXT AS $$
DECLARE
  today_count INTEGER;
  today_date TEXT;
BEGIN
  today_date := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO today_count FROM public.lotes WHERE DATE(fecha_recepcion) = CURRENT_DATE;
  RETURN 'L' || today_date || '-' || LPAD(today_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Enable RLS on all tables
ALTER TABLE public.productores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huertos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote_cortadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camara_fria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_temperaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_molino ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guias_salida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guia_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumo_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidacion_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Authenticated users can read/write all data (will be refined per role later)
CREATE POLICY "Authenticated users can view productores" ON public.productores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert productores" ON public.productores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update productores" ON public.productores FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view huertos" ON public.huertos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert huertos" ON public.huertos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update huertos" ON public.huertos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view cortadores" ON public.cortadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cortadores" ON public.cortadores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cortadores" ON public.cortadores FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view lotes" ON public.lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lotes" ON public.lotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update lotes" ON public.lotes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view lote_cortadores" ON public.lote_cortadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lote_cortadores" ON public.lote_cortadores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view presentaciones" ON public.presentaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert presentaciones" ON public.presentaciones FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view produccion" ON public.produccion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert produccion" ON public.produccion FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view camara_fria" ON public.camara_fria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert camara_fria" ON public.camara_fria FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update camara_fria" ON public.camara_fria FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view registro_temperaturas" ON public.registro_temperaturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert registro_temperaturas" ON public.registro_temperaturas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view stock_molino" ON public.stock_molino FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock_molino" ON public.stock_molino FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_molino" ON public.stock_molino FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view guias_salida" ON public.guias_salida FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert guias_salida" ON public.guias_salida FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update guias_salida" ON public.guias_salida FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view guia_detalles" ON public.guia_detalles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert guia_detalles" ON public.guia_detalles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view insumos" ON public.insumos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert insumos" ON public.insumos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update insumos" ON public.insumos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view insumo_movimientos" ON public.insumo_movimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert insumo_movimientos" ON public.insumo_movimientos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view anticipos" ON public.anticipos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert anticipos" ON public.anticipos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update anticipos" ON public.anticipos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view liquidaciones" ON public.liquidaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert liquidaciones" ON public.liquidaciones FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view liquidacion_lotes" ON public.liquidacion_lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert liquidacion_lotes" ON public.liquidacion_lotes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view ventas" ON public.ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ventas" ON public.ventas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ventas" ON public.ventas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view venta_detalles" ON public.venta_detalles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert venta_detalles" ON public.venta_detalles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view pagos_clientes" ON public.pagos_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pagos_clientes" ON public.pagos_clientes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Insert default presentations
INSERT INTO public.presentaciones (nombre, peso_kg, tipo) VALUES
  ('Caja Exhibidora 10 lb', 4.5, 'caja'),
  ('Europack 40 lb', 18.0, 'caja'),
  ('Caja Plástica 10 kg', 10.0, 'caja'),
  ('Caja Plástica 15 kg', 15.0, 'caja'),
  ('Caja Plástica 20 kg', 20.0, 'caja'),
  ('Arpilla 17 kg', 17.0, 'arpilla'),
  ('Arpilla 25 kg', 25.0, 'arpilla');

-- Insert default insumos
INSERT INTO public.insumos (nombre, tipo, cantidad_disponible, cantidad_minima) VALUES
  ('Caja Plástica Nueva', 'caja_plastica', 500, 100),
  ('Caja Plástica Usada', 'caja_plastica', 1000, 200),
  ('Arpilla Verde 17kg', 'arpilla', 300, 50),
  ('Arpilla Verde 25kg', 'arpilla', 200, 50),
  ('Tarima Nacional', 'tarima', 100, 20),
  ('Tarima Exportación', 'tarima', 50, 10),
  ('Esquineros', 'esquinero', 500, 100),
  ('Flejes', 'fleje', 200, 50);