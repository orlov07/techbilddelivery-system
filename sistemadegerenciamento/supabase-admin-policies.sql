-- ============================================================
-- RLS Policies for TechBild Admin Panel
-- Assumes public.is_admin_user() and public.current_user_email()
-- helper functions already exist in Supabase.
-- ============================================================

-- ORDERS: admin can do everything; users can read/insert their own
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_orders_all" ON orders;
CREATE POLICY "admin_orders_all" ON orders
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "user_orders_select" ON orders;
CREATE POLICY "user_orders_select" ON orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_orders_insert" ON orders;
CREATE POLICY "user_orders_insert" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ORDER_ITEMS: admin all; users read own via order
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_order_items_all" ON order_items;
CREATE POLICY "admin_order_items_all" ON order_items
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "user_order_items_select" ON order_items;
CREATE POLICY "user_order_items_select" ON order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth.uid()
    )
  );

-- PRODUCTS: admin all; public/authenticated can read active
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_products_all" ON products;
CREATE POLICY "admin_products_all" ON products
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "public_products_select" ON products;
CREATE POLICY "public_products_select" ON products
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- CATEGORIES: admin all; public read
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_categories_all" ON categories;
CREATE POLICY "admin_categories_all" ON categories
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "public_categories_select" ON categories;
CREATE POLICY "public_categories_select" ON categories
  FOR SELECT TO anon, authenticated
  USING (true);

-- MOTOBOYS: admin all; authenticated read active
ALTER TABLE motoboys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_motoboys_all" ON motoboys;
CREATE POLICY "admin_motoboys_all" ON motoboys
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "auth_motoboys_select" ON motoboys;
CREATE POLICY "auth_motoboys_select" ON motoboys
  FOR SELECT TO authenticated
  USING (is_active = true);

-- USERS: admin all; user can read/update own profile
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_all" ON users;
CREATE POLICY "admin_users_all" ON users
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "user_self_select" ON users;
CREATE POLICY "user_self_select" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "user_self_update" ON users;
CREATE POLICY "user_self_update" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "user_self_insert" ON users;
CREATE POLICY "user_self_insert" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- APP_SETTINGS: admin all; public read
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_settings_all" ON app_settings;
CREATE POLICY "admin_settings_all" ON app_settings
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "public_settings_select" ON app_settings;
CREATE POLICY "public_settings_select" ON app_settings
  FOR SELECT TO anon, authenticated
  USING (true);
