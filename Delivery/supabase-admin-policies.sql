-- Policies RLS para o painel administrativo
-- Execute no SQL Editor do Supabase

-- Admins podem ver todos os usuários
CREATE POLICY "Admin lê todos os usuários" ON users
FOR SELECT TO authenticated
USING (public.is_admin_user() OR id = auth.uid());

-- Admins podem atualizar qualquer usuário
CREATE POLICY "Admin atualiza usuários" ON users
FOR UPDATE TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());
