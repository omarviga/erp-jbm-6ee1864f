-- Liquidaciones a productores: alias, pólizas y abonos mixtos.
-- Fecha: 2026-10-01. Idempotente y aditiva (no toca datos existentes).
--
-- Reglas que respalda:
-- - Alias del productor para búsqueda y boleta oficial.
-- - Deducción operativa fija $30/boleta + provisión $0.04/kg, separadas de báscula.
-- - Abonos mixtos (cheque con referencia obligatoria / efectivo / SPEI).
-- - El saldo global se recalcula en cliente con syncProductorSaldoPendiente
--   (src/lib/finanzas/saldos.ts) tras cada liquidación, abono o anulación.

-- 1. Alias del productor (apodo de mesa de control).
alter table public.productores
  add column if not exists alias text;

-- 2. Póliza contable de liquidación.
create table if not exists public.liquidaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  productor_id uuid not null references public.productores (id),
  kilos_netos numeric(14, 2) not null default 0,
  precio_promedio numeric(14, 4) not null default 0,
  subtotal_fruta numeric(14, 2) not null default 0,
  anticipos numeric(14, 2) not null default 0,
  deduccion_bascula numeric(14, 2) not null default 0,
  deduccion_operativa_fija numeric(14, 2) not null default 0,
  provision_operativa numeric(14, 2) not null default 0,
  total_neto numeric(14, 2) not null default 0,
  estado text not null default 'parcial' check (estado in ('parcial', 'pagada')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- 3. Boletas incluidas en cada liquidación (un lote, una sola liquidación).
create table if not exists public.liquidacion_boletas (
  liquidacion_id uuid not null references public.liquidaciones (id) on delete cascade,
  lote_id uuid not null references public.lotes (id),
  saldo_boleta numeric(14, 2) not null default 0,
  primary key (liquidacion_id, lote_id),
  unique (lote_id)
);

-- 4. Abonos mixtos (cheque exige referencia a nivel app + check parcial).
create table if not exists public.abonos_liquidacion (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null references public.liquidaciones (id) on delete cascade,
  metodo text not null check (metodo in ('cheque', 'efectivo', 'spei')),
  referencia text not null default '',
  importe numeric(14, 2) not null check (importe > 0),
  fecha timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint abono_cheque_con_referencia
    check (metodo <> 'cheque' or btrim(referencia) <> '')
);

-- La tabla pudo existir en remoto sin esta columna (aplicación manual
-- previa que omitió el CREATE): completarla antes de indexarla.
alter table public.liquidaciones
  add column if not exists estado text not null default 'parcial';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'liquidaciones_estado_check'
  ) then
    alter table public.liquidaciones
      add constraint liquidaciones_estado_check check (estado in ('parcial', 'pagada'));
  end if;
end $$;

create index if not exists ix_liquidaciones_productor
  on public.liquidaciones (productor_id, estado);
create index if not exists ix_abonos_liquidacion
  on public.abonos_liquidacion (liquidacion_id);

-- 5. RLS por rol (patrón has_role del repo).
alter table public.liquidaciones enable row level security;
alter table public.liquidacion_boletas enable row level security;
alter table public.abonos_liquidacion enable row level security;

drop policy if exists "liq_sel_fin" on public.liquidaciones;
create policy "liq_sel_fin" on public.liquidaciones for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'finanzas'));
drop policy if exists "liq_ins_fin" on public.liquidaciones;
create policy "liq_ins_fin" on public.liquidaciones for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'finanzas'));
drop policy if exists "liq_upd_fin" on public.liquidaciones;
create policy "liq_upd_fin" on public.liquidaciones for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'finanzas'));
drop policy if exists "liq_del_admin" on public.liquidaciones;
create policy "liq_del_admin" on public.liquidaciones for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "liqbol_all_fin" on public.liquidacion_boletas;
create policy "liqbol_all_fin" on public.liquidacion_boletas for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'finanzas'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'finanzas'));

drop policy if exists "abono_all_fin" on public.abonos_liquidacion;
create policy "abono_all_fin" on public.abonos_liquidacion for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'finanzas'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'finanzas'));
