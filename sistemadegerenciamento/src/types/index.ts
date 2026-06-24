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
  promo_price?: number;
  category: string;
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
  commission_rate: number;
  created_at?: string;
}

export interface Order {
  id: string;
  seq_code: string;
  user_id?: string;
  customer_name: string;
  customer_phone: string;
  type: 'delivery' | 'retirada' | 'mesa';
  table_number?: string;
  status: 'pendente' | 'aceito' | 'recusado' | 'preparando' | 'enviando' | 'entregue' | 'cancelado';
  payment_method: string;
  payment_status: 'aguardando_pagamento' | 'pendente' | 'pago';
  subtotal: number;
  delivery_fee: number;
  total: number;
  motoboy_id?: string;
  address?: string;
  notes?: string;
  change_for?: string;
  created_at: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total: number;
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

export interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  avgDeliveryMinutes: number | null;
  ordersYesterday: number;
  revenueYesterday: number;
}

export interface HourlyData {
  hour: string;
  pedidos: number;
  faturamento: number;
}
