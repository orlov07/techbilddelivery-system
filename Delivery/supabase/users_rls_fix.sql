-- Corrige recursao infinita nas policies da tabela public.users.
-- Execute este script no SQL Editor do Supabase do projeto em producao.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '');
$$;

CREATE OR REPLACE FUNCTION public.is_allowed_admin_email()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT lower(public.current_user_email()) IN (
    lower('igor.vianaaidev@gmail.com'),
    lower('techbilld@gmail.com'),
    lower('techbildellivery@gmail.com'),
    lower('igoraguiarviana@gmail.com')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_allowed_admin_email();
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de si mesmo" ON public.users;
DROP POLICY IF EXISTS "Leitura de si mesmo ou admin" ON public.users;
DROP POLICY IF EXISTS "Admin lê todos os usuários" ON public.users;
DROP POLICY IF EXISTS "Insercao do proprio perfil" ON public.users;
DROP POLICY IF EXISTS "Modificacao de si mesmo" ON public.users;
DROP POLICY IF EXISTS "Atualizacao do proprio perfil" ON public.users;
DROP POLICY IF EXISTS "Admin atualiza usuários" ON public.users;

CREATE POLICY "Leitura de si mesmo ou admin"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Insercao do proprio perfil"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Atualizacao do proprio perfil"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin_user())
WITH CHECK (id = auth.uid() OR public.is_admin_user());

UPDATE public.users
SET tipo_usuario = CASE
  WHEN lower(email) IN (
    lower('igor.vianaaidev@gmail.com'),
    lower('techbilld@gmail.com'),
    lower('techbildellivery@gmail.com'),
    lower('igoraguiarviana@gmail.com')
  ) THEN 'admin'
  WHEN tipo_usuario = 'admin' THEN 'cliente'
  ELSE tipo_usuario
END;

COMMIT;

-- Verificacao rapida:
-- select policyname, tablename, cmd
-- from pg_policies
-- where schemaname = 'public' and tablename = 'users'
-- order by policyname;
