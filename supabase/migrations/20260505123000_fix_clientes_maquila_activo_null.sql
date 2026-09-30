-- Normaliza clientes de maquila con activo NULL para que sean visibles en el módulo.
-- Seguro para ejecutar múltiples veces.

begin;

-- 1) Limpieza de datos existentes
update public.clientes_maquila
set activo = true
where activo is null;

-- 2) Prevención para nuevos registros
alter table public.clientes_maquila
alter column activo set default true;

commit;

