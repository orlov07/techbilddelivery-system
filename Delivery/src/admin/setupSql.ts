/**
 * SQL setup scripts shown to the admin for manual execution in the Supabase dashboard.
 * This module is ONLY imported by AdminPanel (lazy-loaded), so these strings stay
 * out of the main bundle and are never downloaded by regular users.
 */

const defaultAdminEmails = [
  'igor.vianaaidev@gmail.com',
  'techbilld@gmail.com',
  'techbildellivery@gmail.com',
  'igoraguiarviana@gmail.com',
];

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const adminEmails = Array.from(
  new Set(
    [
      ...defaultAdminEmails,
      ...String((import.meta as any).env?.VITE_ADMIN_EMAILS ?? '')
        .split(','),
      String((import.meta as any).env?.VITE_ADMIN_EMAIL ?? ''),
    ]
      .map(normalizeEmail)
      .filter(Boolean)
  )
);
const adminEmailListSql = adminEmails.map((email) => `lower('${email.replace(/'/g, "''")}')`).join(',\n    ');
export const SUPABASE_PROMOTE_ADMIN_SQL = `UPDATE public.users
SET tipo_usuario = CASE
  WHEN lower(email) IN (
    ${adminEmailListSql}
  ) THEN 'admin'
  WHEN tipo_usuario = 'admin' THEN 'cliente'
  ELSE tipo_usuario
END;

SELECT id, nome, email, tipo_usuario
FROM public.users
WHERE tipo_usuario = 'admin'
   OR lower(email) IN (
     ${adminEmailListSql}
   );`;

export const SUPABASE_REALTIME_SQL = `-- Migração: Realtime para pedidos + seq_code gerado pelo banco
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. Habilitar a tabela orders na publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 2. Criar sequência para códigos únicos de pedido
CREATE SEQUENCE IF NOT EXISTS order_seq_counter START 1001 INCREMENT 1;

-- 3. Função que gera o seq_code automaticamente no INSERT
CREATE OR REPLACE FUNCTION set_order_seq_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.seq_code IS NULL OR NEW.seq_code = '' THEN
    NEW.seq_code := '#' || LPAD(nextval('order_seq_counter')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger BEFORE INSERT para disparar a função
DROP TRIGGER IF EXISTS trg_set_order_seq_code ON orders;
CREATE TRIGGER trg_set_order_seq_code
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION set_order_seq_code();
`;

export const SUPABASE_FIX_USERS_RLS_SQL = `-- Repair users RLS recursion by replacing any self-referencing admin check.
-- Run this in the Supabase SQL Editor for the target project.

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
    ${adminEmailListSql}
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
DROP POLICY IF EXISTS "Insercao do proprio perfil" ON public.users;
DROP POLICY IF EXISTS "Modificacao de si mesmo" ON public.users;

CREATE POLICY "Leitura de si mesmo" ON public.users
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Insercao do proprio perfil" ON public.users
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Modificacao de si mesmo" ON public.users
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin_user())
WITH CHECK (id = auth.uid() OR public.is_admin_user());

UPDATE public.users
SET tipo_usuario = CASE
  WHEN lower(email) IN (
    ${adminEmailListSql}
  ) THEN 'admin'
  WHEN tipo_usuario = 'admin' THEN 'cliente'
  ELSE tipo_usuario
END;

SELECT 'users_rls_repaired' AS status;`;

export const SUPABASE_SETUP_SQL = `-- SCRIPT SQL COMPLETO PARA CONFIGURAÇÃO DO BANCO DE DADOS NO SUPABASE
-- Execute esse script no SQL Editor do seu painel do Supabase.

-- 1. Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Configurações do Estabelecimento
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  establishment_name TEXT NOT NULL DEFAULT 'Gourmet Burger & Cia',
  logo_url TEXT NOT NULL DEFAULT '/logo.png',
  banner_url TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=1200&h=400',
  business_hours TEXT NOT NULL DEFAULT 'Terça a Domingo - 18h às 23h30',
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 7.00,
  pix_key TEXT NOT NULL DEFAULT 'contato@gourmetburger.com.br',
  pix_code TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '5511999999999',
  address TEXT NOT NULL DEFAULT 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  avg_delivery_time TEXT NOT NULL DEFAULT '35 - 50 min',
  is_open BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO app_settings (id, establishment_name, logo_url, banner_url, business_hours, delivery_fee, pix_key, whatsapp, address, avg_delivery_time, is_open)
  VALUES (1, 'Gourmet Burger & Cia', '/logo.png', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=1200&h=400', 'Terça a Domingo - 18h às 23h30', 7.00, 'contato@gourmetburger.com.br', '5511999999999', 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP', '35 - 50 min', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Tabela de Categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Tabela de Produtos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  promo_price NUMERIC(10,2),
  category TEXT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  stock_quantity INT NOT NULL DEFAULT 99,
  is_promo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Tabela de Motoboys
CREATE TABLE IF NOT EXISTS motoboys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  license_plate TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  commission_rate NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  endereco TEXT,
  tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('cliente', 'admin', 'motoboy')) DEFAULT 'cliente',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 7. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seq_code TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('delivery', 'retirada', 'mesa')),
  table_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'aceito', 'recusado', 'preparando', 'enviando', 'entregue', 'cancelado')) DEFAULT 'pendente',
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('aguardando_pagamento', 'pendente', 'pago')) DEFAULT 'pendente',
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_discount NUMERIC(10,2),
  cashback_used NUMERIC(10,2),
  total NUMERIC(10,2) NOT NULL,
  motoboy_id UUID REFERENCES motoboys(id) ON DELETE SET NULL,
  address TEXT,
  notes TEXT,
  change_for TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 8. Tabela de Itens de Pedidos
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  quantity INT NOT NULL DEFAULT 1,
  total NUMERIC(10,2) NOT NULL
);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '');
$$;

CREATE OR REPLACE FUNCTION public.is_allowed_admin_email()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT lower(public.current_user_email()) IN (
    ${adminEmailListSql}
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_allowed_admin_email();
$$;

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoboys ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de configuracoes" ON app_settings;
DROP POLICY IF EXISTS "Escrita de configuracoes por admin" ON app_settings;
DROP POLICY IF EXISTS "Leitura publica de categorias" ON categories;
DROP POLICY IF EXISTS "Escrita de categorias por admin" ON categories;
DROP POLICY IF EXISTS "Leitura publica de produtos" ON products;
DROP POLICY IF EXISTS "Modificacao por admin" ON products;
DROP POLICY IF EXISTS "Leitura de motoboys por admin ou entregador vinculado" ON motoboys;
DROP POLICY IF EXISTS "Gerenciamento de motoboys por admin" ON motoboys;
DROP POLICY IF EXISTS "Leitura de si mesmo" ON users;
DROP POLICY IF EXISTS "Insercao do proprio perfil" ON users;
DROP POLICY IF EXISTS "Modificacao de si mesmo" ON users;
DROP POLICY IF EXISTS "Clientes leem seus proprios pedidos" ON orders;
DROP POLICY IF EXISTS "Pedidos insercao controlada" ON orders;
DROP POLICY IF EXISTS "Modificacao de pedidos por admin ou motoboy" ON orders;
DROP POLICY IF EXISTS "Leitura de itens de pedido" ON order_items;
DROP POLICY IF EXISTS "Insercao de itens controlada" ON order_items;

CREATE POLICY "Leitura publica de configuracoes" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Escrita de configuracoes por admin" ON app_settings FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Leitura publica de categorias" ON categories FOR SELECT USING (true);
CREATE POLICY "Escrita de categorias por admin" ON categories FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Leitura publica de produtos" ON products FOR SELECT USING (true);
CREATE POLICY "Modificacao por admin" ON products FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "Leitura de motoboys por admin ou entregador vinculado" ON motoboys
FOR SELECT TO authenticated USING (
  public.is_admin_user() OR lower(email) = lower(public.current_user_email())
);
CREATE POLICY "Gerenciamento de motoboys por admin" ON motoboys FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "Leitura de si mesmo" ON users FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Insercao do proprio perfil" ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Modificacao de si mesmo" ON users FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin_user()) WITH CHECK (id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Clientes leem seus proprios pedidos" ON orders
FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.is_admin_user()
  OR motoboy_id IN (SELECT id FROM motoboys WHERE lower(email) = lower(public.current_user_email()))
);
CREATE POLICY "Pedidos insercao controlada" ON orders FOR INSERT WITH CHECK (
  user_id IS NULL OR user_id = auth.uid() OR public.is_admin_user()
);
CREATE POLICY "Modificacao de pedidos por admin ou motoboy" ON orders FOR UPDATE TO authenticated
USING (
  public.is_admin_user()
  OR (
    type = 'delivery'
    AND motoboy_id IS NULL
    AND status IN ('aceito', 'preparando')
    AND EXISTS (
      SELECT 1
      FROM motoboys
      WHERE lower(email) = lower(public.current_user_email())
        AND is_active = true
    )
  )
  OR motoboy_id IN (SELECT id FROM motoboys WHERE lower(email) = lower(public.current_user_email()))
)
WITH CHECK (
  public.is_admin_user()
  OR motoboy_id IN (
    SELECT id
    FROM motoboys
    WHERE lower(email) = lower(public.current_user_email())
      AND is_active = true
  )
);

CREATE POLICY "Leitura de itens de pedido" ON order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (
    orders.user_id = auth.uid() OR public.is_admin_user()
    OR orders.motoboy_id IN (SELECT id FROM motoboys WHERE lower(email) = lower(public.current_user_email()))
  ))
);
CREATE POLICY "Insercao de itens controlada" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (
    orders.user_id IS NULL OR orders.user_id = auth.uid() OR public.is_admin_user()
  ))
);

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_order JSONB,
  p_items JSONB
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
BEGIN
  INSERT INTO public.orders (
    user_id,
    customer_name,
    customer_phone,
    type,
    table_number,
    status,
    payment_method,
    payment_status,
    subtotal,
    delivery_fee,
    coupon_id,
    coupon_discount,
    cashback_used,
    total,
    address,
    notes,
    change_for
  )
  VALUES (
    NULLIF(p_order->>'user_id', '')::UUID,
    p_order->>'customer_name',
    p_order->>'customer_phone',
    p_order->>'type',
    NULLIF(p_order->>'table_number', ''),
    COALESCE(NULLIF(p_order->>'status', ''), 'pendente'),
    p_order->>'payment_method',
    COALESCE(NULLIF(p_order->>'payment_status', ''), 'pendente'),
    COALESCE((p_order->>'subtotal')::NUMERIC, 0),
    COALESCE((p_order->>'delivery_fee')::NUMERIC, 0),
    NULLIF(p_order->>'coupon_id', '')::UUID,
    NULLIF(p_order->>'coupon_discount', '')::NUMERIC,
    NULLIF(p_order->>'cashback_used', '')::NUMERIC,
    COALESCE((p_order->>'total')::NUMERIC, 0),
    NULLIF(p_order->>'address', ''),
    NULLIF(p_order->>'notes', ''),
    NULLIF(p_order->>'change_for', '')
  )
  RETURNING * INTO v_order;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    product_name,
    unit_price,
    unit_cost,
    quantity,
    total
  )
  SELECT
    v_order.id,
    NULLIF(item.product_id, '')::UUID,
    item.product_name,
    item.unit_price,
    COALESCE(item.unit_cost, 0),
    item.quantity,
    item.total
  FROM jsonb_to_recordset(p_items) AS item(
    product_id TEXT,
    product_name TEXT,
    unit_price NUMERIC,
    unit_cost NUMERIC,
    quantity INTEGER,
    total NUMERIC
  );

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(JSONB, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_order(JSONB, JSONB) TO authenticated;
`;
