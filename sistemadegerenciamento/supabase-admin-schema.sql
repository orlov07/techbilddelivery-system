-- ============================================================
-- Helper functions for TechBild Admin Panel
-- Run these in Supabase SQL Editor if not already present.
-- ============================================================

-- Returns the email of the currently authenticated user
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '');
$$;

-- Returns true if the current user is the designated admin
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

-- ============================================================
-- Schema reference (tables already exist — do NOT re-run CREATE TABLE)
-- Listed here for documentation purposes only.
-- ============================================================

/*
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  telefone      TEXT,
  endereco      TEXT,
  tipo_usuario  TEXT NOT NULL DEFAULT 'cliente' CHECK (tipo_usuario IN ('cliente','admin','motoboy')),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  price          NUMERIC(10,2) NOT NULL,
  promo_price    NUMERIC(10,2),
  category       TEXT NOT NULL DEFAULT '',
  image_url      TEXT NOT NULL DEFAULT '',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  stock_quantity INTEGER NOT NULL DEFAULT 99,
  is_promo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.motoboys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT NOT NULL,
  license_plate   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 5,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_code        TEXT NOT NULL,
  user_id         UUID REFERENCES public.users(id),
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('delivery','retirada','mesa')),
  table_number    TEXT,
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','aceito','recusado','preparando','enviando','entregue','cancelado')),
  payment_method  TEXT NOT NULL,
  payment_status  TEXT NOT NULL DEFAULT 'aguardando_pagamento'
                    CHECK (payment_status IN ('aguardando_pagamento','pendente','pago')),
  subtotal        NUMERIC(10,2) NOT NULL,
  delivery_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  motoboy_id      UUID REFERENCES public.motoboys(id),
  notes           TEXT,
  change_for      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL,
  product_name TEXT NOT NULL,
  unit_price   NUMERIC(10,2) NOT NULL,
  quantity     INTEGER NOT NULL,
  total        NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id                 INTEGER PRIMARY KEY DEFAULT 1,
  establishment_name TEXT NOT NULL DEFAULT 'Meu Restaurante',
  logo_url           TEXT NOT NULL DEFAULT '',
  banner_url         TEXT NOT NULL DEFAULT '',
  business_hours     TEXT NOT NULL DEFAULT '08:00-22:00',
  delivery_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
  pix_key            TEXT NOT NULL DEFAULT '',
  pix_code           TEXT NOT NULL DEFAULT '',
  whatsapp           TEXT NOT NULL DEFAULT '',
  address            TEXT NOT NULL DEFAULT '',
  avg_delivery_time  TEXT NOT NULL DEFAULT '40-60 min',
  is_open            BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
*/
