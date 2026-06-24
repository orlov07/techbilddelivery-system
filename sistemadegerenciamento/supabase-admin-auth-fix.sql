-- ============================================================
-- TechBild Admin auth/RLS fix
-- Run this in the Supabase SQL Editor for the same project used
-- by sysstemdelivery.web.app when admin login returns 500 on
-- public.users / public.orders queries.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(public.current_user_email())) IN (
    lower(trim('igor.vianaaidev@gmail.com')),
    lower(trim('techbildellivery@gmail.com')),
    lower(trim('igoraguiarviana@gmail.com'))
  );
$$;

UPDATE public.users
SET tipo_usuario = CASE
  WHEN lower(trim(email)) IN (
    lower(trim('igor.vianaaidev@gmail.com')),
    lower(trim('techbildellivery@gmail.com')),
    lower(trim('igoraguiarviana@gmail.com'))
  ) THEN 'admin'
  WHEN tipo_usuario = 'admin' THEN 'cliente'
  ELSE tipo_usuario
END;

SELECT id, nome, email, tipo_usuario
FROM public.users
WHERE lower(trim(email)) IN (
  lower(trim('igor.vianaaidev@gmail.com')),
  lower(trim('techbildellivery@gmail.com')),
  lower(trim('igoraguiarviana@gmail.com'))
)
ORDER BY email;
