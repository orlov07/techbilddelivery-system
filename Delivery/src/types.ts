/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppUser {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  endereco?: string;
  tipo_usuario: 'cliente' | 'admin' | 'motoboy';
  criado_em: string;
}

export interface Category {
  id: string;
  name: string;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  cost_price?: number;
  promo_price?: number;
  category: string; // Category name or ID
  image_url: string;
  is_active: boolean;
  stock_quantity: number;
  is_promo: boolean;
  created_at?: string;
}

export interface Motoboy {
  id: string;
  name: string;
  phone: string;
  email: string;
  license_plate: string;
  is_active: boolean;
  commission_rate: number; // Commission per delivery
  created_at?: string;
}

export interface Order {
  id: string;
  seq_code: string; // Human-friendly code (e.g., #1024)
  user_id?: string;
  customer_name: string;
  customer_phone: string;
  type: 'delivery' | 'retirada' | 'mesa';
  table_number?: string;
  status: 'pendente' | 'aceito' | 'recusado' | 'preparando' | 'enviando' | 'entregue' | 'cancelado';
  payment_method: 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pagamento_entrega' | 'pagamento_mesa';
  payment_status: 'aguardando_pagamento' | 'pendente' | 'pago';
  subtotal: number;
  delivery_fee: number;
  coupon_id?: string;
  coupon_discount?: number;
  cashback_used?: number;
  total: number;
  motoboy_id?: string; // Assigned motoboy
  address?: string;
  notes?: string;
  change_for?: string; // Change amount for cash
  created_at: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  unit_price: number;
  unit_cost?: number;
  quantity: number;
  total: number;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CouponValidationResult {
  coupon_id: string;
  code: string;
  type: 'percent' | 'fixed';
  discount: number;
}

export interface CashbackTransaction {
  id: string;
  user_id: string;
  order_id?: string;
  type: 'credit' | 'debit';
  amount: number;
  description?: string;
  created_at: string;
}

export interface AppSettings {
  establishment_name: string;
  logo_url: string;
  banner_url: string;
  banner_title?: string;
  banner_subtitle?: string;
  business_hours: string;
  delivery_fee: number;
  pix_key: string;
  pix_code: string;
  whatsapp: string;
  address: string;
  avg_delivery_time: string;
  is_open: boolean;
  cashback_percent?: number;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_role: 'cliente' | 'admin' | 'motoboy' | null;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderNotification {
  id: string;
  user_id: string;
  order_id: string | null;
  title: string;
  body: string;
  url: string;
  is_read: boolean;
  created_at: string;
}
