-- Restrict admin access to the allowed Google accounts in Supabase.
-- This promotes the allowed accounts and removes admin role from every other user.

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

SELECT id, nome, email, tipo_usuario
FROM public.users
WHERE tipo_usuario = 'admin'
   OR lower(email) IN (
     lower('igor.vianaaidev@gmail.com'),
     lower('techbilld@gmail.com'),
     lower('techbildellivery@gmail.com'),
     lower('igoraguiarviana@gmail.com')
   );
