-- Fix de visibilidade do catalogo para usuarios anonimos e autenticados.
-- Use este script quando os produtos aparecem deslogado, mas somem apos login.

BEGIN;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de configuracoes" ON public.app_settings;
CREATE POLICY "Leitura publica de configuracoes"
ON public.app_settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Escrita de configuracoes por admin" ON public.app_settings;
CREATE POLICY "Escrita de configuracoes por admin"
ON public.app_settings
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Leitura publica de categorias" ON public.categories;
CREATE POLICY "Leitura publica de categorias"
ON public.categories
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Escrita de categorias por admin" ON public.categories;
CREATE POLICY "Escrita de categorias por admin"
ON public.categories
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Leitura publica de produtos" ON public.products;
CREATE POLICY "Leitura publica de produtos"
ON public.products
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Modificacao de produtos por admin" ON public.products;
CREATE POLICY "Modificacao de produtos por admin"
ON public.products
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

COMMIT;

-- Verificacao rapida apos executar:
-- select policyname, tablename, permissive, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('app_settings', 'categories', 'products')
-- order by tablename, policyname;
