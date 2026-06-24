-- Schema extra para o painel admin (opcional)
-- Tabela de logs de ações administrativas
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente admin lê logs" ON admin_logs
FOR SELECT TO authenticated
USING (public.is_admin_user());
CREATE POLICY "Somente admin insere logs" ON admin_logs
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_user());
