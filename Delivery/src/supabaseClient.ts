/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Category, Product, Motoboy, Order, OrderItem, AppSettings, AppUser, Coupon, CouponValidationResult } from './types';

// Environment variables
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';
const appUrl = metaEnv.VITE_APP_URL || metaEnv.APP_URL || '';
const googleRedirectUrl = metaEnv.VITE_GOOGLE_REDIRECT_URL || appUrl || window.location.origin;

export const ADMIN_APP_URL = 'https://systemdelivery.web.app/';
// Admin email is read from VITE_ADMIN_EMAIL — never hardcode here.
const DEFAULT_ADMIN_EMAILS = [
  'igor.vianaaidev@gmail.com',
  'techbilld@gmail.com',
  'techbildellivery@gmail.com',
  'igoraguiarviana@gmail.com',
];

export const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();
const parseAdminEmails = (...sources: unknown[]) =>
  Array.from(
    new Set(
      sources
        .flatMap((source) => String(source || '').split(','))
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  );

export const ADMIN_EMAILS = parseAdminEmails(
  metaEnv.VITE_ADMIN_EMAILS,
  metaEnv.VITE_ADMIN_EMAIL,
  DEFAULT_ADMIN_EMAILS.join(',')
);
export const ADMIN_EMAIL = ADMIN_EMAILS[0] || '';
export const isAllowedAdminEmail = (email?: string | null) =>
  ADMIN_EMAILS.includes(normalizeEmail(email));

// SQL setup scripts live in admin/setupSql.ts — imported only by AdminPanel (lazy chunk).

// Detect if actual keys are present and look valid
export const isSupabaseConfigured =
  supabaseUrl &&
  supabaseUrl !== 'MY_SUPABASE_URL' &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'MY_SUPABASE_ANON_KEY';

// Initialize real supabase client if configured, otherwise define a stub
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const EMPTY_SETTINGS: AppSettings = {
  establishment_name: 'TechBild Delivery',
  logo_url: '/logo.png',
  banner_url: '',
  business_hours: '',
  delivery_fee: 0,
  pix_key: '',
  pix_code: '',
  whatsapp: '',
  address: '',
  avg_delivery_time: '',
  is_open: false,
};

const ensureSupabaseConfigured = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase nao configurado. Conecte o projeto real para usar o app.');
  }
};

const throwIfSupabaseError = (error: { message?: string } | null, fallbackMessage: string) => {
  if (error) {
    const message = error.message || fallbackMessage;
    if (message.includes('infinite recursion detected in policy for relation "users"')) {
      throw new Error(
        `A policy da tabela users no Supabase entrou em recursao infinita. Execute o SQL de reparo "Users RLS Fix" no painel admin ou no SQL Editor do projeto ${supabaseUrl}.`
      );
    }
    throw new Error(message);
  }
};

const getMissingColumnFromSchemaCacheError = (message?: string | null) => {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column of '([^']+)'/i);
  if (!match) return null;
  return { column: match[1], table: match[2] };
};

const isOrderInsertAccessError = (message?: string | null) => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('row-level security')
    || normalized.includes('unauthorized')
    || normalized.includes('permission denied');
};

// Unified Database API
export const db = {
  // Config
  isMockMode: !isSupabaseConfigured,
  isConfigured: isSupabaseConfigured,

  signInWithGoogle: async (): Promise<void> => {
    ensureSupabaseConfigured();
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: googleRedirectUrl },
    });
    if (error) throw new Error(error.message || 'Nao foi possivel iniciar o login com Google.');
  },

  signOut: async (): Promise<void> => {
    ensureSupabaseConfigured();
    const { error } = await supabase!.auth.signOut();
    if (error) throw new Error(error.message || 'Nao foi possivel encerrar a sessao.');
  },

  resetStorage: () => {
    throw new Error('Reset de banco local removido. Use o banco real.');
  },

  // Users Auth & Persistence
  getCurrentUser: async (): Promise<AppUser | null> => {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) {
          const currentRecord = data as AppUser;
          const shouldBeAdmin = isAllowedAdminEmail(currentRecord.email || user.email);
          const nextRole: AppUser['tipo_usuario'] = shouldBeAdmin
            ? 'admin'
            : currentRecord.tipo_usuario === 'admin' ? 'cliente' : currentRecord.tipo_usuario;

          if (currentRecord.tipo_usuario !== nextRole) {
            const { data: updated } = await supabase
              .from('users').update({ tipo_usuario: nextRole }).eq('id', user.id).select('*').single();
            return (updated || { ...currentRecord, tipo_usuario: nextRole }) as AppUser;
          }
          return currentRecord;
        }

        // Auto-create profile on first login
        const newRecord: AppUser = {
          id: user.id,
          nome: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente',
          email: user.email || '',
          tipo_usuario: isAllowedAdminEmail(user.email) ? 'admin' : 'cliente',
          criado_em: new Date().toISOString(),
        };
        await supabase.from('users').insert(newRecord);
        return newRecord;
      }
      return null;
    }
    return null;
  },

  setCurrentUser: async (user: AppUser | null): Promise<void> => {
    if (isSupabaseConfigured && supabase && user) {
      await supabase.from('users').upsert({
        id: user.id,
        nome: user.nome,
        email: user.email,
        telefone: user.telefone,
        endereco: user.endereco,
        tipo_usuario: user.tipo_usuario,
        criado_em: user.criado_em,
      });
    }
  },

  updateCurrentUserProfile: async (nome: string, telefone: string, endereco: string): Promise<AppUser | null> => {
    const wrapper = await db.getCurrentUser();
    if (!wrapper) return null;
    const updated = { ...wrapper, nome, telefone, endereco };
    await db.setCurrentUser(updated);
    return updated;
  },

  // Categories
  getCategories: async (): Promise<Category[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
      throwIfSupabaseError(error, 'Nao foi possivel carregar categorias.');
      if (data) return data as Category[];
    }
    return [];
  },

  saveCategory: async (category: Category): Promise<Category> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('categories')
        .upsert({ id: category.id.startsWith('cat-') ? undefined : category.id, name: category.name })
        .select().single();
      throwIfSupabaseError(error, 'Nao foi possivel salvar a categoria.');
      if (data) return data as Category;
    }
    throw new Error('Supabase nao configurado. Nao e possivel salvar categorias.');
  },

  deleteCategory: async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      throwIfSupabaseError(error, 'Nao foi possivel excluir a categoria.');
    }
  },

  // Products
  getProducts: async (): Promise<Product[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
      throwIfSupabaseError(error, 'Nao foi possivel carregar produtos.');
      if (data) return data as Product[];
    }
    return [];
  },

  saveProduct: async (product: Product): Promise<Product> => {
    if (isSupabaseConfigured && supabase) {
      const payload = { ...product, id: product.id.startsWith('prod-') ? undefined : product.id };
      const { data, error } = await supabase.from('products').upsert(payload).select().single();
      throwIfSupabaseError(error, 'Nao foi possivel salvar o produto.');
      if (data) return data as Product;
    }
    throw new Error('Supabase nao configurado. Nao e possivel salvar produtos.');
  },

  deleteProduct: async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      throwIfSupabaseError(error, 'Nao foi possivel excluir o produto.');
    }
  },

  // Motoboys
  getMotoboys: async (): Promise<Motoboy[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('motoboys').select('*');
      throwIfSupabaseError(error, 'Nao foi possivel carregar motoboys.');
      if (data) return data as Motoboy[];
    }
    return [];
  },

  saveMotoboy: async (motoboy: Motoboy): Promise<Motoboy> => {
    if (isSupabaseConfigured && supabase) {
      const payload = { ...motoboy, id: motoboy.id.startsWith('moto-') ? undefined : motoboy.id };
      const { data, error } = await supabase.from('motoboys').upsert(payload).select().single();
      throwIfSupabaseError(error, 'Nao foi possivel salvar o motoboy.');
      if (data) return data as Motoboy;
    }
    throw new Error('Supabase nao configurado. Nao e possivel salvar motoboys.');
  },

  deleteMotoboy: async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('motoboys').delete().eq('id', id);
      throwIfSupabaseError(error, 'Nao foi possivel excluir o motoboy.');
    }
  },

  // App Settings
  getSettings: async (): Promise<AppSettings> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
      throwIfSupabaseError(error, 'Nao foi possivel carregar as configuracoes.');
      if (data) return data as AppSettings;
    }
    return EMPTY_SETTINGS;
  },

  saveSettings: async (settings: AppSettings): Promise<AppSettings> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('app_settings').upsert({ ...settings, id: 1 }).select().single();
      throwIfSupabaseError(error, 'Nao foi possivel salvar as configuracoes da loja.');
      if (data) return data as AppSettings;
    }
    throw new Error('Supabase nao configurado. Nao e possivel salvar configuracoes.');
  },

  // Orders
  getOrders: async (): Promise<Order[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('orders').select('*').order('created_at', { ascending: false });
      throwIfSupabaseError(error, 'Nao foi possivel carregar pedidos.');
      if (data) return data as Order[];
    }
    return [];
  },

  getOrderItems: async (orderId: string): Promise<OrderItem[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('order_items').select('*').eq('order_id', orderId);
      throwIfSupabaseError(error, 'Nao foi possivel carregar os itens do pedido.');
      if (data) return data as OrderItem[];
    }
    return [];
  },

  getAllOrderItems: async (): Promise<OrderItem[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('order_items').select('*');
      throwIfSupabaseError(error, 'Nao foi possivel carregar os itens dos pedidos.');
      if (data) return data as OrderItem[];
    }
    return [];
  },

  createOrder: async (
    order: Omit<Order, 'id' | 'seq_code' | 'created_at'>,
    items: Array<{ id: string; name: string; price: number; cost?: number; quantity: number }>
  ): Promise<Order> => {
    const payment_status: Order['payment_status'] =
      order.payment_method === 'pix' || order.payment_method === 'cartao_credito'
        ? 'aguardando_pagamento'
        : 'pendente';

    if (isSupabaseConfigured && supabase) {
      const insertPayload: Record<string, unknown> = {
        user_id: order.user_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        type: order.type,
        table_number: order.table_number,
        status: 'pendente',
        payment_method: order.payment_method,
        payment_status,
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee,
        coupon_id: order.coupon_id || null,
        coupon_discount: order.coupon_discount || null,
        cashback_used: order.cashback_used || null,
        total: order.total,
        address: order.address,
        notes: order.notes,
        change_for: order.change_for,
      };

      let dbOrder: Order | null = null;
      let oErr: { message?: string } | null = null;

      for (;;) {
        const { data, error } = await supabase
          .from('orders')
          .insert(insertPayload)
          .select().single();

        dbOrder = (data as Order | null) ?? null;
        oErr = error;

        const missingColumn = getMissingColumnFromSchemaCacheError(error?.message);
        if (!error || !missingColumn || missingColumn.table !== 'orders' || !(missingColumn.column in insertPayload)) {
          break;
        }

        delete insertPayload[missingColumn.column];
      }

      const itemsPayload = items.map((it) => ({
        order_id: dbOrder?.id,
        product_id: it.id.startsWith('prod-') ? undefined : it.id,
        product_name: it.name,
        unit_price: it.price,
        unit_cost: it.cost || 0,
        quantity: it.quantity,
        total: it.price * it.quantity,
      }));

      if ((oErr || !dbOrder) && isOrderInsertAccessError(oErr?.message)) {
        const { data: rpcOrder, error: rpcError } = await supabase
          .rpc('create_public_order', {
            p_order: insertPayload,
            p_items: itemsPayload.map(({ order_id, ...itemPayload }) => itemPayload),
          })
          .single();

        throwIfSupabaseError(rpcError, 'Erro ao criar pedido no Supabase');
        if (rpcOrder) return rpcOrder as Order;
      }

      if (oErr || !dbOrder) throw new Error(oErr?.message || 'Erro ao criar pedido no Supabase');

      const { error: itemError } = await supabase.from('order_items').insert(itemsPayload);
      throwIfSupabaseError(itemError, 'Erro ao salvar os itens do pedido no Supabase');
      return dbOrder as Order;
    }
    throw new Error('Supabase nao configurado. Nao e possivel criar pedidos.');
  },

  updateOrderStatus: async (orderId: string, status: Order['status']): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
      throwIfSupabaseError(error, 'Nao foi possivel atualizar o status do pedido.');
    }
  },

  updateOrderPaymentStatus: async (orderId: string, payment_status: Order['payment_status']): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('orders').update({ payment_status, updated_at: new Date().toISOString() }).eq('id', orderId);
      throwIfSupabaseError(error, 'Nao foi possivel atualizar o pagamento do pedido.');
    }
  },

  createCreditCardCheckout: async (payload: {
    orderId: string;
    total: number;
    customerName: string;
    customerEmail?: string;
    items: Array<{ title: string; quantity: number; unit_price: number }>;
  }): Promise<{ checkoutUrl: string }> => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase nao configurado.');
    const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
      body: payload,
    });
    if (error) {
      const rawMessage = error.message || 'Nao foi possivel iniciar o checkout de cartao.';
      if (
        rawMessage.includes('Failed to send a request') ||
        rawMessage.includes('non-2xx status code') ||
        rawMessage.includes('Edge Function')
      ) {
        throw new Error('O checkout de cartao ainda nao foi ativado no servidor desta loja.');
      }
      throw new Error(rawMessage);
    }
    if (!data?.checkoutUrl) throw new Error('O checkout de cartao nao retornou uma URL valida.');
    return data as { checkoutUrl: string };
  },

  assignMotoboy: async (orderId: string, motoboyId: string | undefined): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('orders')
        .update({ motoboy_id: motoboyId || null, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      throwIfSupabaseError(error, 'Nao foi possivel atribuir o motoboy.');
    }
  },

  validateCoupon: async (
    code: string,
    orderTotal: number,
    userId: string,
  ): Promise<CouponValidationResult> => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase nao configurado.');
    const { data, error } = await supabase.functions.invoke('validate-coupon', {
      body: { code, order_total: orderTotal, user_id: userId },
    });
    if (error) throw new Error(error.message || 'Erro ao validar cupom.');
    if (data?.error) throw new Error(data.error as string);
    return data as CouponValidationResult;
  },

  getCashbackBalance: async (userId: string): Promise<number> => {
    if (!isSupabaseConfigured || !supabase) return 0;
    const { data } = await supabase
      .from('cashback_balances')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();
    return (data as { balance: number } | null)?.balance ?? 0;
  },

  recordCouponUse: async (couponId: string, userId: string, orderId: string): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('coupon_uses').insert({ coupon_id: couponId, user_id: userId, order_id: orderId });
    await supabase.rpc('increment_coupon_used_count', { p_coupon_id: couponId });
  },

  creditCashback: async (userId: string, orderId: string, amount: number): Promise<void> => {
    if (!isSupabaseConfigured || !supabase || amount <= 0) return;
    await supabase.from('cashback_transactions').insert({
      user_id: userId,
      order_id: orderId,
      type: 'credit',
      amount: Math.round(amount * 100) / 100,
      description: 'Cashback por pedido entregue',
    });
  },

  debitCashback: async (userId: string, orderId: string, amount: number): Promise<void> => {
    if (!isSupabaseConfigured || !supabase || amount <= 0) return;
    await supabase.from('cashback_transactions').insert({
      user_id: userId,
      order_id: orderId,
      type: 'debit',
      amount: Math.round(amount * 100) / 100,
      description: 'Cashback utilizado no pedido',
    });
  },

  // Coupon CRUD (admin)
  getCoupons: async (): Promise<Coupon[]> => {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    throwIfSupabaseError(error, 'Erro ao carregar cupons.');
    return (data as Coupon[]) ?? [];
  },

  saveCoupon: async (coupon: Partial<Coupon> & { code: string }): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) return;
    if (coupon.id) {
      const { error } = await supabase.from('coupons').update(coupon).eq('id', coupon.id);
      throwIfSupabaseError(error, 'Erro ao atualizar cupom.');
    } else {
      const { error } = await supabase.from('coupons').insert({ ...coupon, used_count: 0 });
      throwIfSupabaseError(error, 'Erro ao criar cupom.');
    }
  },

  deleteCoupon: async (id: string): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    throwIfSupabaseError(error, 'Erro ao excluir cupom.');
  },
};
