import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Product, Category, Motoboy, Order, OrderItem as FullOrderItem, AppSettings, CouponValidationResult } from '../types';
import { db, isSupabaseConfigured } from '../supabaseClient';
import { dedupeCategories, dedupeProducts } from '../utils/catalog';

type OrderItem = { id: string; name: string; price: number; cost?: number; quantity: number };

interface StoreContextValue {
  products: Product[];
  categories: Category[];
  motoboys: Motoboy[];
  orders: Order[];
  orderItems: FullOrderItem[];
  settings: AppSettings | null;
  isLoadingPublic: boolean;
  appMessage: string;

  // Data loading
  loadPublicData: () => Promise<void>;
  loadAdminData: () => Promise<void>;
  loadAllData: () => Promise<void>;

  // Real-time patch hooks (called by App.tsx subscriptions)
  addOrder: (order: Order) => void;
  patchOrder: (order: Order) => void;
  setSettings: (s: AppSettings) => void;

  // Products
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Categories
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Motoboys
  saveMotoboy: (motoboy: Motoboy) => Promise<void>;
  deleteMotoboy: (id: string) => Promise<void>;

  // Settings
  saveSettings: (s: AppSettings) => Promise<void>;

  // Orders
  createOrder: (order: Omit<Order, 'id' | 'seq_code' | 'created_at'>, items: OrderItem[]) => Promise<Order | null>;
  createCreditCardCheckout: (payload: {
    orderId: string;
    total: number;
    customerName: string;
    customerEmail?: string;
    items: Array<{ title: string; quantity: number; unit_price: number }>;
  }) => Promise<{ checkoutUrl: string }>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  updateOrderPaymentStatus: (orderId: string, paymentStatus: Order['payment_status']) => Promise<void>;
  assignMotoboy: (orderId: string, motoboyId: string | undefined) => Promise<void>;
  getOrderItems: (orderId: string) => Promise<FullOrderItem[]>;
  validateCoupon: (code: string, orderTotal: number, userId: string) => Promise<CouponValidationResult>;
  getCashbackBalance: (userId: string) => Promise<number>;
  recordCouponUse: (couponId: string, userId: string, orderId: string) => Promise<void>;
  creditCashback: (userId: string, orderId: string, amount: number) => Promise<void>;
  debitCashback: (userId: string, orderId: string, amount: number) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<FullOrderItem[]>([]);
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);
  const [appMessage, setAppMessage] = useState('');

  // Only public data (catalog + settings) on mount — fast initial load
  const loadPublicData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAppMessage('Supabase nao configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      setIsLoadingPublic(false);
      return;
    }
    setIsLoadingPublic(true);
    try {
      const [p, c, s] = await Promise.all([db.getProducts(), db.getCategories(), db.getSettings()]);
      setProducts(dedupeProducts(p));
      setCategories(dedupeCategories(c));
      setSettingsState(s);
      setAppMessage('');
    } catch (err) {
      setAppMessage(err instanceof Error ? err.message : 'Nao foi possivel carregar os dados do app.');
    } finally {
      setIsLoadingPublic(false);
    }
  }, []);

  // Orders + motoboys loaded lazily after auth resolves
  const loadAdminData = useCallback(async () => {
    try {
      const [m, o, oi] = await Promise.all([db.getMotoboys(), db.getOrders(), db.getAllOrderItems()]);
      setMotoboys(m);
      setOrders(o);
      setOrderItems(oi);
    } catch (err) {
      console.error('Erro ao carregar dados de autenticado:', err);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const [p, c, m, o, oi, s] = await Promise.all([
        db.getProducts(), db.getCategories(), db.getMotoboys(), db.getOrders(), db.getAllOrderItems(), db.getSettings(),
      ]);
      setProducts(dedupeProducts(p)); setCategories(dedupeCategories(c)); setMotoboys(m); setOrders(o); setOrderItems(oi); setSettingsState(s);
    } catch (err) {
      setAppMessage(err instanceof Error ? err.message : 'Nao foi possivel carregar os dados.');
    }
  }, []);

  useEffect(() => { loadPublicData(); }, [loadPublicData]);

  // Real-time helpers
  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => prev.some((o) => o.id === order.id) ? prev : [order, ...prev]);
  }, []);

  const patchOrder = useCallback((order: Order) => {
    setOrders((prev) => prev.map((o) => o.id === order.id ? order : o));
  }, []);

  const setSettings = useCallback((s: AppSettings) => setSettingsState(s), []);

  // CRUD
  const saveProduct = useCallback(async (product: Product) => {
    await db.saveProduct(product);
    setProducts(dedupeProducts(await db.getProducts()));
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await db.deleteProduct(id);
    setProducts(dedupeProducts(await db.getProducts()));
  }, []);

  const saveCategory = useCallback(async (category: Category) => {
    await db.saveCategory(category);
    setCategories(dedupeCategories(await db.getCategories()));
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await db.deleteCategory(id);
    setCategories(dedupeCategories(await db.getCategories()));
  }, []);

  const saveMotoboy = useCallback(async (motoboy: Motoboy) => {
    await db.saveMotoboy(motoboy);
    setMotoboys(await db.getMotoboys());
  }, []);

  const deleteMotoboy = useCallback(async (id: string) => {
    await db.deleteMotoboy(id);
    setMotoboys(await db.getMotoboys());
  }, []);

  const saveSettings = useCallback(async (s: AppSettings) => {
    const saved = await db.saveSettings(s);
    setSettingsState(saved);
  }, []);

  const createOrder = useCallback(async (
    order: Omit<Order, 'id' | 'seq_code' | 'created_at'>,
    items: OrderItem[]
  ): Promise<Order | null> => {
    try {
      const result = await db.createOrder(order, items);
      // Optimistic stock decrement
      setProducts((prev) => prev.map((p) => {
        const item = items.find((it) => it.id === p.id);
        return item ? { ...p, stock_quantity: Math.max(0, p.stock_quantity - item.quantity) } : p;
      }));
      // Refresh order list so the new order appears immediately
      setOrders(await db.getOrders());
      setOrderItems(await db.getAllOrderItems());
      return result;
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: Order['status']) => {
    await db.updateOrderStatus(orderId, status);
    setOrders(await db.getOrders());
    setOrderItems(await db.getAllOrderItems());
  }, []);

  const createCreditCardCheckout = useCallback((payload: {
    orderId: string;
    total: number;
    customerName: string;
    customerEmail?: string;
    items: Array<{ title: string; quantity: number; unit_price: number }>;
  }) => db.createCreditCardCheckout(payload), []);

  const updateOrderPaymentStatus = useCallback(async (orderId: string, paymentStatus: Order['payment_status']) => {
    await db.updateOrderPaymentStatus(orderId, paymentStatus);
    setOrders(await db.getOrders());
    setOrderItems(await db.getAllOrderItems());
  }, []);

  const assignMotoboy = useCallback(async (orderId: string, motoboyId: string | undefined) => {
    await db.assignMotoboy(orderId, motoboyId);
    setOrders(await db.getOrders());
    setOrderItems(await db.getAllOrderItems());
  }, []);

  const getOrderItems      = useCallback((orderId: string) => db.getOrderItems(orderId), []);
  const validateCoupon     = useCallback(
    (code: string, total: number, userId: string) => db.validateCoupon(code, total, userId),
    [],
  );
  const getCashbackBalance = useCallback((userId: string) => db.getCashbackBalance(userId), []);
  const recordCouponUse    = useCallback(
    (couponId: string, userId: string, orderId: string) => db.recordCouponUse(couponId, userId, orderId),
    [],
  );
  const creditCashback     = useCallback(
    (userId: string, orderId: string, amount: number) => db.creditCashback(userId, orderId, amount),
    [],
  );
  const debitCashback      = useCallback(
    (userId: string, orderId: string, amount: number) => db.debitCashback(userId, orderId, amount),
    [],
  );

  const value = useMemo(() => ({
    products, categories, motoboys, orders, orderItems, settings, isLoadingPublic, appMessage,
    loadPublicData, loadAdminData, loadAllData,
    addOrder, patchOrder, setSettings,
    saveProduct, deleteProduct,
    saveCategory, deleteCategory,
    saveMotoboy, deleteMotoboy,
    saveSettings,
    createOrder, createCreditCardCheckout, updateOrderStatus, updateOrderPaymentStatus, assignMotoboy,
    getOrderItems, validateCoupon, getCashbackBalance,
    recordCouponUse, creditCashback, debitCashback,
  }), [
    products, categories, motoboys, orders, orderItems, settings, isLoadingPublic, appMessage,
    loadPublicData, loadAdminData, loadAllData,
    addOrder, patchOrder, setSettings,
    saveProduct, deleteProduct,
    saveCategory, deleteCategory,
    saveMotoboy, deleteMotoboy,
    saveSettings,
    createOrder, createCreditCardCheckout, updateOrderStatus, updateOrderPaymentStatus, assignMotoboy,
    getOrderItems, validateCoupon, getCashbackBalance,
    recordCouponUse, creditCashback, debitCashback,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
