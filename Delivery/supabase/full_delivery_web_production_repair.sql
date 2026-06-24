-- ============================================================================
-- TechBild Delivery - Banco completo de producao
-- SQL unica para executar no Supabase SQL Editor
-- Reconstrui: base do delivery, seguranca RLS, cupons, cashback, realtime,
-- push notifications e funcoes auxiliares usadas pelo frontend atual.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSOES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 2. TABELAS BASE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  establishment_name text NOT NULL DEFAULT 'TechBild Delivery',
  logo_url text NOT NULL DEFAULT '/logo.png',
  banner_url text NOT NULL DEFAULT '',
  banner_title text,
  banner_subtitle text,
  business_hours text NOT NULL DEFAULT '',
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  pix_key text NOT NULL DEFAULT '',
  pix_code text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  avg_delivery_time text NOT NULL DEFAULT '',
  is_open boolean NOT NULL DEFAULT true,
  cashback_percent numeric(5,2) NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT app_settings_singleton CHECK (id = 1),
  CONSTRAINT app_settings_cashback_percent_check CHECK (cashback_percent >= 0 AND cashback_percent <= 100)
);

CREATE TABLE IF NOT EXISTS public.app_private_settings (
  singleton boolean PRIMARY KEY DEFAULT true,
  push_function_url text,
  push_function_token text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT app_private_settings_singleton CHECK (singleton = true)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_idx
  ON public.categories (lower(name));

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  promo_price numeric(10,2),
  category text NOT NULL,
  image_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  stock_quantity integer NOT NULL DEFAULT 99,
  is_promo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT products_price_check CHECK (price >= 0),
  CONSTRAINT products_cost_price_check CHECK (cost_price >= 0),
  CONSTRAINT products_promo_price_check CHECK (promo_price IS NULL OR promo_price >= 0),
  CONSTRAINT products_stock_quantity_check CHECK (stock_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  endereco text,
  tipo_usuario text NOT NULL DEFAULT 'cliente',
  criado_em timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT users_tipo_usuario_check CHECK (tipo_usuario IN ('cliente', 'admin', 'motoboy'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON public.users (lower(email));

CREATE TABLE IF NOT EXISTS public.motoboys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  license_plate text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  commission_rate numeric(10,2) NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT motoboys_commission_rate_check CHECK (commission_rate >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS motoboys_email_unique_idx
  ON public.motoboys (lower(email));

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  type text NOT NULL,
  value numeric(10,2) NOT NULL,
  min_order numeric(10,2) NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT timezone('utc', now()),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT coupons_type_check CHECK (type IN ('percent', 'fixed')),
  CONSTRAINT coupons_value_check CHECK (value >= 0),
  CONSTRAINT coupons_min_order_check CHECK (min_order >= 0),
  CONSTRAINT coupons_max_uses_check CHECK (max_uses IS NULL OR max_uses >= 0),
  CONSTRAINT coupons_used_count_check CHECK (used_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique_idx
  ON public.coupons (upper(code));

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_code text,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  type text NOT NULL,
  table_number text,
  status text NOT NULL DEFAULT 'pendente',
  payment_method text NOT NULL,
  payment_status text NOT NULL DEFAULT 'pendente',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  coupon_discount numeric(10,2),
  cashback_used numeric(10,2),
  total numeric(10,2) NOT NULL DEFAULT 0,
  motoboy_id uuid REFERENCES public.motoboys(id) ON DELETE SET NULL,
  address text,
  notes text,
  change_for text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT orders_type_check CHECK (type IN ('delivery', 'retirada', 'mesa')),
  CONSTRAINT orders_status_check CHECK (status IN ('pendente', 'aceito', 'recusado', 'preparando', 'enviando', 'entregue', 'cancelado')),
  CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'pagamento_entrega', 'pagamento_mesa')),
  CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('aguardando_pagamento', 'pendente', 'pago')),
  CONSTRAINT orders_subtotal_check CHECK (subtotal >= 0),
  CONSTRAINT orders_delivery_fee_check CHECK (delivery_fee >= 0),
  CONSTRAINT orders_coupon_discount_check CHECK (coupon_discount IS NULL OR coupon_discount >= 0),
  CONSTRAINT orders_cashback_used_check CHECK (cashback_used IS NULL OR cashback_used >= 0),
  CONSTRAINT orders_total_check CHECK (total >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_seq_code_unique_idx
  ON public.orders (seq_code)
  WHERE seq_code IS NOT NULL AND btrim(seq_code) <> '';

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_motoboy_id_idx ON public.orders (motoboy_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  total numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT order_items_unit_cost_check CHECK (unit_cost >= 0),
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_total_check CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

CREATE TABLE IF NOT EXISTS public.coupon_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS coupon_uses_coupon_user_unique_idx
  ON public.coupon_uses (coupon_id, user_id);

CREATE INDEX IF NOT EXISTS coupon_uses_order_id_idx ON public.coupon_uses (order_id);

CREATE TABLE IF NOT EXISTS public.cashback_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL,
  amount numeric(10,2) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT cashback_transactions_type_check CHECK (type IN ('credit', 'debit')),
  CONSTRAINT cashback_transactions_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS cashback_transactions_user_id_idx
  ON public.cashback_transactions (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS cashback_credit_once_per_order_idx
  ON public.cashback_transactions (user_id, order_id, type)
  WHERE order_id IS NOT NULL AND type = 'credit';

CREATE UNIQUE INDEX IF NOT EXISTS cashback_debit_once_per_order_idx
  ON public.cashback_transactions (user_id, order_id, type)
  WHERE order_id IS NOT NULL AND type = 'debit';

DO $$
DECLARE
  v_has_created_at boolean;
  v_has_updated_at boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'cashback_balances'
  ) THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cashback_balances'
        AND column_name = 'created_at'
    ) INTO v_has_created_at;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cashback_balances'
        AND column_name = 'updated_at'
    ) INTO v_has_updated_at;

    IF v_has_created_at AND v_has_updated_at THEN
      CREATE TEMP TABLE tmp_cashback_balances_backup AS
      SELECT
        user_id,
        balance,
        COALESCE(created_at, timezone('utc', now())) AS created_at,
        COALESCE(updated_at, timezone('utc', now())) AS updated_at
      FROM public.cashback_balances;
    ELSIF v_has_created_at THEN
      CREATE TEMP TABLE tmp_cashback_balances_backup AS
      SELECT
        user_id,
        balance,
        COALESCE(created_at, timezone('utc', now())) AS created_at,
        timezone('utc', now()) AS updated_at
      FROM public.cashback_balances;
    ELSIF v_has_updated_at THEN
      CREATE TEMP TABLE tmp_cashback_balances_backup AS
      SELECT
        user_id,
        balance,
        timezone('utc', now()) AS created_at,
        COALESCE(updated_at, timezone('utc', now())) AS updated_at
      FROM public.cashback_balances;
    ELSE
      CREATE TEMP TABLE tmp_cashback_balances_backup AS
      SELECT
        user_id,
        balance,
        timezone('utc', now()) AS created_at,
        timezone('utc', now()) AS updated_at
      FROM public.cashback_balances;
    END IF;

    DROP VIEW public.cashback_balances;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.cashback_balances (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF to_regclass('pg_temp.tmp_cashback_balances_backup') IS NOT NULL THEN
    INSERT INTO public.cashback_balances (user_id, balance, created_at, updated_at)
    SELECT user_id, balance, created_at, updated_at
    FROM pg_temp.tmp_cashback_balances_backup
    ON CONFLICT (user_id) DO UPDATE
      SET balance = EXCLUDED.balance,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at;

    DROP TABLE pg_temp.tmp_cashback_balances_backup;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_role text,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT push_subscriptions_user_role_check CHECK (user_role IS NULL OR user_role IN ('cliente', 'admin', 'motoboy'))
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique_idx
  ON public.push_subscriptions (endpoint);

CREATE TABLE IF NOT EXISTS public.order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL DEFAULT '/',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS order_notifications_user_id_idx
  ON public.order_notifications (user_id, created_at DESC);

-- ============================================================================
-- 3. LINHAS SINGLETON INICIAIS
-- ============================================================================

INSERT INTO public.app_settings (
  id,
  establishment_name,
  logo_url,
  banner_url,
  business_hours,
  delivery_fee,
  pix_key,
  pix_code,
  whatsapp,
  address,
  avg_delivery_time,
  is_open,
  cashback_percent
)
VALUES (
  1,
  'TechBild Delivery',
  '/logo.png',
  '',
  '',
  0,
  '',
  '',
  '',
  '',
  '',
  true,
  2
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_private_settings (
  singleton,
  push_function_url,
  push_function_token
)
VALUES (
  true,
  'https://YOUR_PROJECT_REF.functions.supabase.co/send-push',
  'COLE_AQUI_O_PUSH_FUNCTION_TOKEN'
)
ON CONFLICT (singleton) DO NOTHING;

-- ============================================================================
-- 4. FUNCOES AUXILIARES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '');
$$;

CREATE OR REPLACE FUNCTION public.is_allowed_admin_email()
RETURNS boolean
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
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_allowed_admin_email();
$$;

CREATE OR REPLACE FUNCTION public.current_motoboy_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id
  FROM public.motoboys AS m
  WHERE lower(m.email) = lower(public.current_user_email())
    AND m.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_coupon_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_user_role_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));

  IF NEW.nome IS NULL OR btrim(NEW.nome) = '' THEN
    NEW.nome := split_part(NEW.email, '@', 1);
  END IF;

  IF lower(NEW.email) IN (
    lower('igor.vianaaidev@gmail.com'),
    lower('techbilld@gmail.com'),
    lower('techbildellivery@gmail.com'),
    lower('igoraguiarviana@gmail.com')
  ) THEN
    NEW.tipo_usuario := 'admin';
  ELSIF NEW.tipo_usuario NOT IN ('cliente', 'motoboy') THEN
    NEW.tipo_usuario := 'cliente';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_known_admins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  END,
      updated_at = timezone('utc', now());
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.order_seq_counter
  START WITH 1001
  INCREMENT BY 1
  MINVALUE 1;

CREATE OR REPLACE FUNCTION public.set_order_seq_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.seq_code IS NULL OR btrim(NEW.seq_code) = '' THEN
    NEW.seq_code := '#' || LPAD(nextval('public.order_seq_counter')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(p_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coupons
  SET used_count = used_count + 1,
      updated_at = timezone('utc', now())
  WHERE id = p_coupon_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_cashback_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta numeric(10,2);
BEGIN
  v_delta := CASE
    WHEN NEW.type = 'credit' THEN NEW.amount
    ELSE -NEW.amount
  END;

  INSERT INTO public.cashback_balances (user_id, balance, created_at, updated_at)
  VALUES (NEW.user_id, v_delta, timezone('utc', now()), timezone('utc', now()))
  ON CONFLICT (user_id)
  DO UPDATE
    SET balance = public.cashback_balances.balance + EXCLUDED.balance,
        updated_at = timezone('utc', now());

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_order jsonb,
  p_items jsonb
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
    NULLIF(p_order ->> 'user_id', '')::uuid,
    COALESCE(NULLIF(p_order ->> 'customer_name', ''), 'Cliente'),
    COALESCE(NULLIF(p_order ->> 'customer_phone', ''), ''),
    COALESCE(NULLIF(p_order ->> 'type', ''), 'delivery'),
    NULLIF(p_order ->> 'table_number', ''),
    COALESCE(NULLIF(p_order ->> 'status', ''), 'pendente'),
    COALESCE(NULLIF(p_order ->> 'payment_method', ''), 'pix'),
    COALESCE(NULLIF(p_order ->> 'payment_status', ''), 'pendente'),
    COALESCE((p_order ->> 'subtotal')::numeric, 0),
    COALESCE((p_order ->> 'delivery_fee')::numeric, 0),
    NULLIF(p_order ->> 'coupon_id', '')::uuid,
    NULLIF(p_order ->> 'coupon_discount', '')::numeric,
    NULLIF(p_order ->> 'cashback_used', '')::numeric,
    COALESCE((p_order ->> 'total')::numeric, 0),
    NULLIF(p_order ->> 'address', ''),
    NULLIF(p_order ->> 'notes', ''),
    NULLIF(p_order ->> 'change_for', '')
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
    NULLIF(item.product_id, '')::uuid,
    item.product_name,
    COALESCE(item.unit_price, 0),
    COALESCE(item.unit_cost, 0),
    COALESCE(item.quantity, 1),
    COALESCE(item.total, 0)
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    product_id text,
    product_name text,
    unit_price numeric,
    unit_cost numeric,
    quantity integer,
    total numeric
  );

  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_push_subscription_secure(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_role text,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  INSERT INTO public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_role,
    user_agent,
    is_active,
    updated_at
  )
  VALUES (
    auth.uid(),
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_role,
    NULLIF(left(COALESCE(p_user_agent, ''), 250), ''),
    true,
    timezone('utc', now())
  )
  ON CONFLICT (endpoint)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_role = EXCLUDED.user_role,
    user_agent = EXCLUDED.user_agent,
    is_active = true,
    updated_at = timezone('utc', now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_push_subscription_secure(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  UPDATE public.push_subscriptions
  SET is_active = false,
      updated_at = timezone('utc', now())
  WHERE endpoint = p_endpoint
    AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.list_order_notifications_secure(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  order_id uuid,
  title text,
  body text,
  url text,
  is_read boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.user_id,
    n.order_id,
    n.title,
    n.body,
    n.url,
    n.is_read,
    n.created_at
  FROM public.order_notifications AS n
  WHERE n.user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.mark_order_notifications_read_secure(
  p_notification_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  UPDATE public.order_notifications
  SET is_read = true,
      updated_at = timezone('utc', now())
  WHERE user_id = auth.uid()
    AND id = ANY(COALESCE(p_notification_ids, ARRAY[]::uuid[]));
END;
$$;

CREATE OR REPLACE FUNCTION public.send_order_push_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_push_url text;
  v_push_token text;
  v_admin_ids uuid[];
  v_customer_title text;
  v_customer_body text;
  v_admin_title text;
  v_admin_body text;
  v_motoboy_user_id uuid;
  v_recipient_user_ids uuid[];
BEGIN
  SELECT push_function_url, push_function_token
  INTO v_push_url, v_push_token
  FROM public.app_private_settings
  WHERE singleton = true;

  SELECT array_agg(id)
  INTO v_admin_ids
  FROM public.users
  WHERE tipo_usuario = 'admin';

  IF TG_OP = 'INSERT' THEN
    v_customer_title := 'Pedido recebido';
    v_customer_body := 'Seu pedido ' || COALESCE(NEW.seq_code, '') || ' foi criado com sucesso.';
    v_admin_title := 'Novo pedido';
    v_admin_body := COALESCE(NEW.seq_code, 'Novo pedido') || ' de ' || NEW.customer_name || '.';

    IF NEW.user_id IS NOT NULL THEN
      INSERT INTO public.order_notifications (user_id, order_id, title, body, url)
      VALUES (NEW.user_id, NEW.id, v_customer_title, v_customer_body, '/');
    END IF;

    IF v_admin_ids IS NOT NULL AND array_length(v_admin_ids, 1) > 0 THEN
      INSERT INTO public.order_notifications (user_id, order_id, title, body, url)
      SELECT admin_id, NEW.id, v_admin_title, v_admin_body, '/'
      FROM unnest(v_admin_ids) AS admin_id;
    END IF;

    IF v_push_url IS NOT NULL
       AND btrim(v_push_url) <> ''
       AND v_push_token IS NOT NULL
       AND btrim(v_push_token) <> ''
       AND v_push_token <> 'COLE_AQUI_O_PUSH_FUNCTION_TOKEN' THEN
      v_recipient_user_ids := ARRAY[]::uuid[];
      IF NEW.user_id IS NOT NULL THEN
        v_recipient_user_ids := array_append(v_recipient_user_ids, NEW.user_id);
      END IF;

      PERFORM net.http_post(
        url := v_push_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_push_token
        ),
        body := jsonb_build_object(
          'recipientUserIds', to_jsonb(v_recipient_user_ids),
          'recipientRoles', jsonb_build_array('admin'),
          'notification', jsonb_build_object(
            'title', v_admin_title,
            'body', v_admin_body,
            'url', '/',
            'icon', '/icon-192.png',
            'badge', '/icon-192.png',
            'orderId', NEW.id,
            'orderCode', COALESCE(NEW.seq_code, ''),
            'status', NEW.status
          )
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.user_id IS NOT NULL THEN
      v_customer_title := 'Atualizacao do pedido';
      v_customer_body := CASE NEW.status
        WHEN 'aceito' THEN 'Seu pedido ' || COALESCE(NEW.seq_code, '') || ' foi aceito.'
        WHEN 'preparando' THEN 'Seu pedido ' || COALESCE(NEW.seq_code, '') || ' esta sendo preparado.'
        WHEN 'enviando' THEN 'Seu pedido ' || COALESCE(NEW.seq_code, '') || ' saiu para entrega.'
        WHEN 'entregue' THEN 'Seu pedido ' || COALESCE(NEW.seq_code, '') || ' foi entregue.'
        WHEN 'recusado' THEN 'Seu pedido ' || COALESCE(NEW.seq_code, '') || ' foi recusado.'
        WHEN 'cancelado' THEN 'Seu pedido ' || COALESCE(NEW.seq_code, '') || ' foi cancelado.'
        ELSE 'Seu pedido ' || COALESCE(NEW.seq_code, '') || ' foi atualizado.'
      END;

      INSERT INTO public.order_notifications (user_id, order_id, title, body, url)
      VALUES (NEW.user_id, NEW.id, v_customer_title, v_customer_body, '/');
    END IF;

    IF NEW.motoboy_id IS DISTINCT FROM OLD.motoboy_id AND NEW.motoboy_id IS NOT NULL THEN
      SELECT u.id
      INTO v_motoboy_user_id
      FROM public.motoboys AS m
      JOIN public.users AS u
        ON lower(u.email) = lower(m.email)
      WHERE m.id = NEW.motoboy_id
      LIMIT 1;

      IF v_motoboy_user_id IS NOT NULL THEN
        INSERT INTO public.order_notifications (user_id, order_id, title, body, url)
        VALUES (
          v_motoboy_user_id,
          NEW.id,
          'Nova entrega para voce',
          'O pedido ' || COALESCE(NEW.seq_code, '') || ' foi atribuido ao seu painel.',
          '/'
        );
      END IF;
    END IF;

    IF v_push_url IS NOT NULL
       AND btrim(v_push_url) <> ''
       AND v_push_token IS NOT NULL
       AND btrim(v_push_token) <> ''
       AND v_push_token <> 'COLE_AQUI_O_PUSH_FUNCTION_TOKEN' THEN
      v_recipient_user_ids := ARRAY[]::uuid[];

      IF NEW.user_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
        v_recipient_user_ids := array_append(v_recipient_user_ids, NEW.user_id);
      END IF;

      IF NEW.motoboy_id IS DISTINCT FROM OLD.motoboy_id AND v_motoboy_user_id IS NOT NULL THEN
        v_recipient_user_ids := array_append(v_recipient_user_ids, v_motoboy_user_id);
      END IF;

      IF array_length(v_recipient_user_ids, 1) IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_push_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_push_token
          ),
          body := jsonb_build_object(
            'recipientUserIds', to_jsonb(v_recipient_user_ids),
            'recipientRoles', '[]'::jsonb,
            'notification', jsonb_build_object(
              'title', 'Pedido atualizado',
              'body', 'O pedido ' || COALESCE(NEW.seq_code, '') || ' foi atualizado para ' || NEW.status || '.',
              'url', '/',
              'icon', '/icon-192.png',
              'badge', '/icon-192.png',
              'orderId', NEW.id,
              'orderCode', COALESCE(NEW.seq_code, ''),
              'status', NEW.status
            )
          )
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_app_private_settings_updated_at ON public.app_private_settings;
CREATE TRIGGER trg_app_private_settings_updated_at
BEFORE UPDATE ON public.app_private_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_motoboys_updated_at ON public.motoboys;
CREATE TRIGGER trg_motoboys_updated_at
BEFORE UPDATE ON public.motoboys
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cashback_balances_updated_at ON public.cashback_balances;
CREATE TRIGGER trg_cashback_balances_updated_at
BEFORE UPDATE ON public.cashback_balances
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_order_notifications_updated_at ON public.order_notifications;
CREATE TRIGGER trg_order_notifications_updated_at
BEFORE UPDATE ON public.order_notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_coupons_normalize_code ON public.coupons;
CREATE TRIGGER trg_coupons_normalize_code
BEFORE INSERT OR UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.normalize_coupon_code();

DROP TRIGGER IF EXISTS trg_users_role_defaults ON public.users;
CREATE TRIGGER trg_users_role_defaults
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_role_defaults();

DROP TRIGGER IF EXISTS trg_orders_set_seq_code ON public.orders;
CREATE TRIGGER trg_orders_set_seq_code
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_seq_code();

DROP TRIGGER IF EXISTS trg_cashback_transactions_sync_balance ON public.cashback_transactions;
CREATE TRIGGER trg_cashback_transactions_sync_balance
AFTER INSERT ON public.cashback_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_cashback_balance();

DROP TRIGGER IF EXISTS trg_orders_push_events ON public.orders;
CREATE TRIGGER trg_orders_push_events
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.send_order_push_event();

SELECT public.promote_known_admins();

-- ============================================================================
-- 6. RLS
-- ============================================================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_private_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motoboys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Leitura privada por admin" ON public.app_private_settings;
CREATE POLICY "Leitura privada por admin"
ON public.app_private_settings
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

DROP POLICY IF EXISTS "Leitura de si mesmo ou admin" ON public.users;
CREATE POLICY "Leitura de si mesmo ou admin"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Insercao do proprio perfil" ON public.users;
CREATE POLICY "Insercao do proprio perfil"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Atualizacao do proprio perfil" ON public.users;
CREATE POLICY "Atualizacao do proprio perfil"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin_user())
WITH CHECK (id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Leitura de motoboys por admin ou por si" ON public.motoboys;
CREATE POLICY "Leitura de motoboys por admin ou por si"
ON public.motoboys
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
  OR lower(email) = lower(public.current_user_email())
);

DROP POLICY IF EXISTS "Gerenciamento de motoboys por admin" ON public.motoboys;
CREATE POLICY "Gerenciamento de motoboys por admin"
ON public.motoboys
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Leitura de cupons por admin" ON public.coupons;
CREATE POLICY "Leitura de cupons por admin"
ON public.coupons
FOR SELECT
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "Gerenciamento de cupons por admin" ON public.coupons;
CREATE POLICY "Gerenciamento de cupons por admin"
ON public.coupons
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Leitura de pedidos autorizados" ON public.orders;
CREATE POLICY "Leitura de pedidos autorizados"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
  OR user_id = auth.uid()
  OR motoboy_id = public.current_motoboy_id()
  OR (
    public.current_motoboy_id() IS NOT NULL
    AND type = 'delivery'
    AND motoboy_id IS NULL
    AND status IN ('aceito', 'preparando')
  )
);

DROP POLICY IF EXISTS "Insercao controlada de pedidos" ON public.orders;
CREATE POLICY "Insercao controlada de pedidos"
ON public.orders
FOR INSERT
WITH CHECK (
  user_id IS NULL
  OR user_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "Atualizacao de pedidos por admin ou motoboy" ON public.orders;
CREATE POLICY "Atualizacao de pedidos por admin ou motoboy"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  public.is_admin_user()
  OR (
    public.current_motoboy_id() IS NOT NULL
    AND type = 'delivery'
    AND (
      motoboy_id = public.current_motoboy_id()
      OR (motoboy_id IS NULL AND status IN ('aceito', 'preparando'))
    )
  )
)
WITH CHECK (
  public.is_admin_user()
  OR (
    public.current_motoboy_id() IS NOT NULL
    AND type = 'delivery'
    AND motoboy_id = public.current_motoboy_id()
  )
);

DROP POLICY IF EXISTS "Leitura de itens por pedido autorizado" ON public.order_items;
CREATE POLICY "Leitura de itens por pedido autorizado"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND (
        public.is_admin_user()
        OR o.user_id = auth.uid()
        OR o.motoboy_id = public.current_motoboy_id()
      )
  )
);

DROP POLICY IF EXISTS "Insercao de itens por pedido autorizado" ON public.order_items;
CREATE POLICY "Insercao de itens por pedido autorizado"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND (
        public.is_admin_user()
        OR o.user_id IS NULL
        OR o.user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Leitura de usos de cupom por admin ou dono" ON public.coupon_uses;
CREATE POLICY "Leitura de usos de cupom por admin ou dono"
ON public.coupon_uses
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Insercao de uso de cupom por admin ou dono" ON public.coupon_uses;
CREATE POLICY "Insercao de uso de cupom por admin ou dono"
ON public.coupon_uses
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_user()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Leitura de cashback por admin ou dono" ON public.cashback_transactions;
CREATE POLICY "Leitura de cashback por admin ou dono"
ON public.cashback_transactions
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Insercao de cashback por admin ou dono" ON public.cashback_transactions;
CREATE POLICY "Insercao de cashback por admin ou dono"
ON public.cashback_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_user()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Leitura do saldo de cashback por admin ou dono" ON public.cashback_balances;
CREATE POLICY "Leitura do saldo de cashback por admin ou dono"
ON public.cashback_balances
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Leitura de push por admin" ON public.push_subscriptions;
CREATE POLICY "Leitura de push por admin"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "Leitura de notificacoes por admin ou dono" ON public.order_notifications;
CREATE POLICY "Leitura de notificacoes por admin ou dono"
ON public.order_notifications
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Atualizacao de notificacoes por admin ou dono" ON public.order_notifications;
CREATE POLICY "Atualizacao de notificacoes por admin ou dono"
ON public.order_notifications
FOR UPDATE
TO authenticated
USING (
  public.is_admin_user()
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_admin_user()
  OR user_id = auth.uid()
);

-- ============================================================================
-- 7. REALTIME E AJUSTES DE REPLICA
-- ============================================================================

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'orders'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'app_settings'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings';
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- 8. GRANTS PARA FUNCOES SEGURAS
-- ============================================================================

REVOKE ALL ON FUNCTION public.create_public_order(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(jsonb, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_order(jsonb, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.increment_coupon_used_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_coupon_used_count(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_push_subscription_secure(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription_secure(text, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.disable_push_subscription_secure(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disable_push_subscription_secure(text) TO authenticated;

REVOKE ALL ON FUNCTION public.list_order_notifications_secure(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_order_notifications_secure(integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_order_notifications_read_secure(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_order_notifications_read_secure(uuid[]) TO authenticated;

COMMIT;

-- ============================================================================
-- 9. POS-EXECUCAO MANUAL OBRIGATORIA
-- ============================================================================
-- 1. Ajuste a URL em public.app_private_settings.push_function_url
-- 2. Ajuste o token em public.app_private_settings.push_function_token
-- 3. Cadastre os secrets da Edge Function:
--    PUSH_FUNCTION_TOKEN
--    VAPID_PUBLIC_KEY
--    VAPID_PRIVATE_KEY
--    VAPID_SUBJECT
--    MERCADO_PAGO_ACCESS_TOKEN
-- 4. Faça deploy das Edge Functions:
--    validate-coupon
--    send-push
--    create-credit-checkout
