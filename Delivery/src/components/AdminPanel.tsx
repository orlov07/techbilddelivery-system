/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import {
  LayoutDashboard, ShoppingBag, ListCollapse, ListOrdered, Bike, DollarSign, Settings,
  Plus, Edit2, Trash2, Check, X, ShieldAlert, Copy, RefreshCw, Calendar, Power
} from 'lucide-react';
import { Product, Category, Motoboy, Order, AppSettings, OrderItem, Coupon } from '../types';
import { ADMIN_EMAILS } from '../supabaseClient';
import { SUPABASE_FIX_USERS_RLS_SQL, SUPABASE_PROMOTE_ADMIN_SQL, SUPABASE_REALTIME_SQL, SUPABASE_SETUP_SQL } from '../admin/setupSql';
import ActionDialog from './ActionDialog';

interface AdminPanelProps {
  products: Product[];
  categories: Category[];
  motoboys: Motoboy[];
  orders: Order[];
  orderItems: OrderItem[];
  settings: AppSettings;
  isMockMode: boolean;
  onRefreshData: () => Promise<void>;
  onSaveProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onSaveCategory: (category: Category) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onSaveMotoboy: (motoboy: Motoboy) => Promise<void>;
  onDeleteMotoboy: (id: string) => Promise<void>;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  onUpdateOrderPaymentStatus: (orderId: string, status: Order['payment_status']) => Promise<void>;
  onAssignMotoboy: (orderId: string, motoboyId: string | undefined) => Promise<void>;
  onResetDatabase: () => void;
}

type AdminTab = 'dashboard' | 'pedidos' | 'produtos' | 'categorias' | 'motoboys' | 'financeiro' | 'config' | 'cupons' | 'supabase';

interface AdminDialogState {
  open: boolean;
  title: string;
  message: string;
  tone: 'success' | 'danger';
  confirmLabel: string;
  cancelLabel: string;
  showCancel: boolean;
  onConfirm?: () => void | Promise<void>;
}

export default function AdminPanel({
  products,
  categories,
  motoboys,
  orders,
  orderItems,
  settings,
  isMockMode,
  onRefreshData,
  onSaveProduct,
  onDeleteProduct,
  onSaveCategory,
  onDeleteCategory,
  onSaveMotoboy,
  onDeleteMotoboy,
  onSaveSettings,
  onUpdateOrderStatus,
  onUpdateOrderPaymentStatus,
  onAssignMotoboy,
  onResetDatabase
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form Modals states
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [motoboyModalOpen, setMotoboyModalOpen] = useState<boolean>(false);
  const [editingMotoboy, setEditingMotoboy] = useState<Motoboy | null>(null);

  // Financial Filters
  const [finFilter, setFinFilter] = useState<'hoje' | 'semana' | 'mes' | 'personalizado'>('hoje');
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');

  // Selected Order Detail (for items popup)
  const [activeOrderItems, setActiveOrderItems] = useState<OrderItem[]>([]);
  const [activeOrderItemsId, setActiveOrderItemsId] = useState<string | null>(null);

  // Product Form Input bindings
  const [pId, setPId] = useState<string>('');
  const [pName, setPName] = useState<string>('');
  const [pDesc, setPDesc] = useState<string>('');
  const [pPrice, setPPrice] = useState<number>(0);
  const [pCostPrice, setPCostPrice] = useState<number>(0);
  const [pPromoPrice, setPPromoPrice] = useState<number>(0);
  const [pCategory, setPCategory] = useState<string>('');
  const [pImage, setPImage] = useState<string>('');
  const [pActive, setPActive] = useState<boolean>(true);
  const [pStock, setPStock] = useState<number>(99);
  const [pIsPromo, setPIsPromo] = useState<boolean>(false);

  // Helper trigger
  const handleOpenProductModal = (prod: Product | null) => {
    if (prod) {
      setEditingProduct(prod);
      setPId(prod.id);
      setPName(prod.name);
      setPDesc(prod.description);
      setPPrice(prod.price);
      setPCostPrice(prod.cost_price || 0);
      setPPromoPrice(prod.promo_price || 0);
      setPCategory(prod.category);
      setPImage(prod.image_url);
      setPActive(prod.is_active);
      setPStock(prod.stock_quantity);
      setPIsPromo(prod.is_promo);
    } else {
      setEditingProduct(null);
      setPId('');
      setPName('');
      setPDesc('');
      setPPrice(0);
      setPCostPrice(0);
      setPPromoPrice(0);
      setPCategory(categories[0]?.name || '');
      setPImage('');
      setPActive(true);
      setPStock(99);
      setPIsPromo(false);
    }
    setProductModalOpen(true);
  };

  const handleSaveProductForm = async (e: FormEvent) => {
    e.preventDefault();
    const productPayload: Product = {
      id: pId || 'prod-' + Math.random().toString(36).substring(2, 9),
      name: pName,
      description: pDesc,
      price: Number(pPrice),
      cost_price: Number(pCostPrice),
      promo_price: pIsPromo && pPromoPrice ? Number(pPromoPrice) : undefined,
      category: pCategory,
      image_url: pImage,
      is_active: pActive,
      stock_quantity: Number(pStock),
      is_promo: pIsPromo
    };

    await runAdminAction(
      () => onSaveProduct(productPayload),
      {
        successTitle: editingProduct ? 'Produto atualizado' : 'Produto criado',
        successMessage: editingProduct ? 'O produto foi atualizado no painel admin.' : 'O novo produto foi salvo com sucesso.',
        errorTitle: 'Falha ao salvar produto',
        onSuccess: () => setProductModalOpen(false)
      }
    );
  };

  // Category Edit Actions
  const [cId, setCId] = useState<string>('');
  const [cName, setCName] = useState<string>('');

  const handleOpenCategoryModal = (cat: Category | null) => {
    if (cat) {
      setEditingCategory(cat);
      setCId(cat.id);
      setCName(cat.name);
    } else {
      setEditingCategory(null);
      setCId('');
      setCName('');
    }
    setCategoryModalOpen(true);
  };

  const handleSaveCategoryForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) return;
    await runAdminAction(
      () => onSaveCategory({
        id: cId || 'cat-' + Math.random().toString(36).substring(2, 9),
        name: cName.trim()
      }),
      {
        successTitle: editingCategory ? 'Categoria atualizada' : 'Categoria criada',
        successMessage: editingCategory ? 'A categoria foi atualizada com sucesso.' : 'A categoria foi criada com sucesso.',
        errorTitle: 'Falha ao salvar categoria',
        onSuccess: () => setCategoryModalOpen(false)
      }
    );
  };

  // Motoboy Edit Actions
  const [mId, setMId] = useState<string>('');
  const [mName, setMName] = useState<string>('');
  const [mPhone, setMPhone] = useState<string>('');
  const [mEmail, setMEmail] = useState<string>('');
  const [mPlate, setMPlate] = useState<string>('');
  const [mRate, setMRate] = useState<number>(5.00);
  const [mActive, setMActive] = useState<boolean>(true);

  const handleOpenMotoboyModal = (boy: Motoboy | null) => {
    if (boy) {
      setEditingMotoboy(boy);
      setMId(boy.id);
      setMName(boy.name);
      setMPhone(boy.phone);
      setMEmail(boy.email);
      setMPlate(boy.license_plate);
      setMRate(boy.commission_rate);
      setMActive(boy.is_active);
    } else {
      setEditingMotoboy(null);
      setMId('');
      setMName('');
      setMPhone('');
      setMEmail('');
      setMPlate('');
      setMRate(5.50);
      setMActive(true);
    }
    setMotoboyModalOpen(true);
  };

  const handleSaveMotoboyForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!mName.trim() || !mPhone.trim() || !mEmail.trim()) return;
    await runAdminAction(
      () => onSaveMotoboy({
        id: mId || 'moto-' + Math.random().toString(36).substring(2, 9),
        name: mName,
        phone: mPhone,
        email: mEmail,
        license_plate: mPlate,
        commission_rate: Number(mRate),
        is_active: mActive
      }),
      {
        successTitle: editingMotoboy ? 'Motoboy atualizado' : 'Motoboy cadastrado',
        successMessage: editingMotoboy ? 'Os dados do motoboy foram atualizados.' : 'O novo motoboy foi salvo com sucesso.',
        errorTitle: 'Falha ao salvar motoboy',
        onSuccess: () => setMotoboyModalOpen(false)
      }
    );
  };

  // Quick settings binders
  const [stName, setStName] = useState<string>(settings.establishment_name);
  const [stLogo, setStLogo] = useState<string>(settings.logo_url);
  const [stBanner, setStBanner] = useState<string>(settings.banner_url);
  const [stHours, setStHours] = useState<string>(settings.business_hours);
  const [stFee, setStFee] = useState<number>(settings.delivery_fee);
  const [stPixKey, setStPixKey] = useState<string>(settings.pix_key);
  const [stPixCode, setStPixCode] = useState<string>(settings.pix_code);
  const [stWhatsapp, setStWhatsapp] = useState<string>(settings.whatsapp);
  const [stAddress, setStAddress] = useState<string>(settings.address);
  const [stAvgTime, setStAvgTime] = useState<string>(settings.avg_delivery_time);
  const [stOpen, setStOpen] = useState<boolean>(settings.is_open);
  const [stBannerTitle,    setStBannerTitle]    = useState<string>(settings.banner_title    ?? '');
  const [stBannerSubtitle, setStBannerSubtitle] = useState<string>(settings.banner_subtitle ?? '');
  const [stCashbackPct,    setStCashbackPct]    = useState<number>(settings.cashback_percent ?? 2);

  // Coupon tab state
  const [coupons,        setCoupons]        = useState<Coupon[]>([]);
  const [couponsLoaded,  setCouponsLoaded]  = useState(false);
  const [couponForm,     setCouponForm]     = useState<Partial<Coupon> & { code: string }>({ code: '', type: 'percent', value: 10, is_active: true, min_order: 0, max_uses: null });
  const [editingCoupon,  setEditingCoupon]  = useState<Coupon | null>(null);
  const [couponModalOpen, setCouponModalOpen] = useState(false);

  const [dialogState, setDialogState] = useState<AdminDialogState>({
    open: false,
    title: '',
    message: '',
    tone: 'success',
    confirmLabel: 'OK',
    cancelLabel: 'Cancelar',
    showCancel: false
  });

  const closeDialog = () => {
    setDialogState(prev => ({ ...prev, open: false, onConfirm: undefined }));
  };

  const getErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallbackMessage;
  };

  const openInfoDialog = (title: string, message: string) => {
    setDialogState({
      open: true,
      title,
      message,
      tone: 'success',
      confirmLabel: 'OK',
      cancelLabel: 'Cancelar',
      showCancel: false,
      onConfirm: () => closeDialog()
    });
  };

  const openConfirmDialog = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = 'Confirmar'
  ) => {
    setDialogState({
      open: true,
      title,
      message,
      tone: 'danger',
      confirmLabel,
      cancelLabel: 'Cancelar',
      showCancel: true,
      onConfirm: async () => {
        closeDialog();
        await onConfirm();
      }
    });
  };

  const runAdminAction = async (
    action: () => Promise<void>,
    options?: {
      successTitle?: string;
      successMessage?: string;
      errorTitle?: string;
      errorMessage?: string;
      onSuccess?: () => void;
    }
  ) => {
    setIsLoading(true);

    try {
      await action();
      options?.onSuccess?.();

      if (options?.successTitle && options?.successMessage) {
        openInfoDialog(options.successTitle, options.successMessage);
      }
    } catch (error) {
      openInfoDialog(
        options?.errorTitle || 'Falha na operacao',
        getErrorMessage(error, options?.errorMessage || 'Nao foi possivel concluir a operacao no Supabase.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setStName(settings.establishment_name);
    setStLogo(settings.logo_url);
    setStBanner(settings.banner_url);
    setStHours(settings.business_hours);
    setStFee(settings.delivery_fee);
    setStPixKey(settings.pix_key);
    setStPixCode(settings.pix_code);
    setStWhatsapp(settings.whatsapp);
    setStAddress(settings.address);
    setStAvgTime(settings.avg_delivery_time);
    setStOpen(settings.is_open);
    setStBannerTitle(settings.banner_title    ?? '');
    setStBannerSubtitle(settings.banner_subtitle ?? '');
    setStCashbackPct(settings.cashback_percent ?? 2);
  }, [settings]);

  const buildSettingsPayload = (overrides?: Partial<AppSettings>): AppSettings => ({
    establishment_name: stName,
    logo_url: stLogo,
    banner_url: stBanner,
    business_hours: stHours,
    delivery_fee: Number(stFee),
    pix_key: stPixKey,
    pix_code: stPixCode,
    whatsapp: stWhatsapp,
    address: stAddress,
    avg_delivery_time: stAvgTime,
    is_open: stOpen,
    banner_title:    stBannerTitle    || undefined,
    banner_subtitle: stBannerSubtitle || undefined,
    cashback_percent: Number(stCashbackPct),
    ...overrides
  });

  const handleToggleStoreOpen = async () => {
    const nextOpen = !stOpen;
    setStOpen(nextOpen);

    try {
      setIsLoading(true);
      await onSaveSettings(buildSettingsPayload({ is_open: nextOpen }));
    } catch (error) {
      setStOpen(!nextOpen);
      openInfoDialog(
        'Falha ao atualizar status da loja',
        getErrorMessage(error, 'Nao foi possivel atualizar o status aberto/fechado no Supabase.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEstablishmentSettings = async (e: FormEvent) => {
    e.preventDefault();
    await runAdminAction(
      () => onSaveSettings(buildSettingsPayload()),
      {
        successTitle: 'Configuracoes salvas',
        successMessage: 'As informacoes da loja foram atualizadas com sucesso.',
        errorTitle: 'Falha ao salvar configuracoes'
      }
    );
    return;
    setIsLoading(true);
    await onSaveSettings({
      establishment_name: stName,
      logo_url: stLogo,
      banner_url: stBanner,
      business_hours: stHours,
      delivery_fee: Number(stFee),
      pix_key: stPixKey,
      pix_code: stPixCode,
      whatsapp: stWhatsapp,
      address: stAddress,
      avg_delivery_time: stAvgTime,
      is_open: stOpen
    });
    setIsLoading(false);
    openInfoDialog('Configurações salvas', 'As informações da loja foram atualizadas com sucesso.');
  };

  // Live calculation of current orders items for detailed preview
  const handleLoadItems = async (orderId: string) => {
    if (activeOrderItemsId === orderId) {
      setActiveOrderItemsId(null);
      setActiveOrderItems([]);
    } else {
      setIsLoading(true);
      try {
        // We load from Supabase Client or local storage helper directly
        const fetchItems = await import('../supabaseClient').then(m => m.db.getOrderItems(orderId));
        setActiveOrderItems(fetchItems);
        setActiveOrderItemsId(orderId);
      } catch (error) {
        openInfoDialog('Falha ao carregar itens', getErrorMessage(error, 'Nao foi possivel carregar os itens deste pedido.'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Copy SQL setup helper
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);
  const [adminSqlCopied, setAdminSqlCopied] = useState<boolean>(false);
  const [usersFixSqlCopied, setUsersFixSqlCopied] = useState<boolean>(false);
  const [realtimeSqlCopied, setRealtimeSqlCopied] = useState<boolean>(false);
  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const handleCopyAdminSQL = () => {
    navigator.clipboard.writeText(SUPABASE_PROMOTE_ADMIN_SQL);
    setAdminSqlCopied(true);
    setTimeout(() => setAdminSqlCopied(false), 3000);
  };

  const handleCopyUsersFixSQL = () => {
    navigator.clipboard.writeText(SUPABASE_FIX_USERS_RLS_SQL);
    setUsersFixSqlCopied(true);
    setTimeout(() => setUsersFixSqlCopied(false), 3000);
  };

  const handleCopyRealtimeSQL = () => {
    navigator.clipboard.writeText(SUPABASE_REALTIME_SQL);
    setRealtimeSqlCopied(true);
    setTimeout(() => setRealtimeSqlCopied(false), 3000);
  };

  // ===============================================
  // REAL-TIME STATS PROCESSING FOR DASHBOARD & FINANCE
  // ===============================================

  // Date filters helper
  const matchesDateFilter = (createdAtStr: string, mode: typeof finFilter) => {
    const creation = new Date(createdAtStr);
    const now = new Date();
    
    // Set boundaries to UTC/local Day start
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    
    if (mode === 'hoje') {
      return creation.getTime() >= todayStart.getTime();
    }
    
    if (mode === 'semana') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      weekAgo.setHours(0,0,0,0);
      return creation.getTime() >= weekAgo.getTime();
    }
    
    if (mode === 'mes') {
      const monthAgo = new Date();
      monthAgo.setDate(now.getDate() - 30);
      monthAgo.setHours(0,0,0,0);
      return creation.getTime() >= monthAgo.getTime();
    }
    
    if (mode === 'personalizado' && startDateStr && endDateStr) {
      const sDate = new Date(startDateStr);
      const eDate = new Date(endDateStr);
      sDate.setHours(0,0,0,0);
      eDate.setHours(23,59,59,999);
      return creation.getTime() >= sDate.getTime() && creation.getTime() <= eDate.getTime();
    }
    
    return true;
  };

  // Filter orders based on active finance filter
  const financialFilteredOrders = orders.filter(ord => matchesDateFilter(ord.created_at, finFilter));

  // Orders today for dashboard metric
  const todayOrders = orders.filter(ord => matchesDateFilter(ord.created_at, 'hoje'));

  // Calcs
  const getMetrics = (ordersList: Order[]) => {
    let revenueTotal = 0;
    let revenueDelivery = 0;
    let revenueMesa = 0;
    let revenueRetirada = 0;
    let productCostTotal = 0;
    
    let ordersCount = ordersList.length;
    let countPending = 0;
    let countPreparo = 0;
    let countEnviados = 0;
    let countEntregues = 0;
    let countRecusados = 0; // recusados ou cancelados
    
    let motoboyCommissionTotal = 0;
    let motoboyDeliveriesCount = 0;
    let grossProfitEst = 0;
    let valueLiquidEst = 0;

    const validOrderIds = new Set<string>();

    ordersList.forEach(ord => {
      // We only count revenue of valid accepted or delivered orders (exclude recusado, cancelado)
      const isValid = ord.status !== 'recusado' && ord.status !== 'cancelado';
      if (isValid) {
        validOrderIds.add(ord.id);
        revenueTotal += ord.total;
        if (ord.type === 'delivery') {
          revenueDelivery += ord.total;
        } else if (ord.type === 'mesa') {
          revenueMesa += ord.total;
        } else {
          revenueRetirada += ord.total;
        }

        if (ord.motoboy_id) {
          motoboyDeliveriesCount++;
          // Find motoboy commission rate
          const boyObj = motoboys.find(m => m.id === ord.motoboy_id);
          motoboyCommissionTotal += boyObj?.commission_rate || 5.00;
        }
      }

      if (ord.status === 'pendente') countPending++;
      else if (ord.status === 'preparando' || ord.status === 'aceito') countPreparo++;
      else if (ord.status === 'enviando') countEnviados++;
      else if (ord.status === 'entregue') countEntregues++;
      else countRecusados++;
    });

    orderItems.forEach((item) => {
      if (!validOrderIds.has(item.order_id)) return;
      const fallbackProductCost = item.product_id
        ? (products.find((product) => product.id === item.product_id)?.cost_price || 0)
        : 0;
      productCostTotal += ((item.unit_cost ?? fallbackProductCost) || 0) * item.quantity;
    });

    grossProfitEst = revenueTotal - productCostTotal;
    valueLiquidEst = grossProfitEst - motoboyCommissionTotal;

    return {
      revenueTotal,
      revenueDelivery,
      revenueMesa,
      revenueRetirada,
      productCostTotal,
      ordersCount,
      countPending,
      countPreparo,
      countEnviados,
      countEntregues,
      countRecusados,
      motoboyCommissionTotal,
      motoboyDeliveriesCount,
      grossProfitEst,
      valueLiquidEst
    };
  };

  const todayMetrics = getMetrics(todayOrders);
  const finMetrics = getMetrics(financialFilteredOrders);
  const grossMarginPct = finMetrics.revenueTotal > 0 ? (finMetrics.grossProfitEst / finMetrics.revenueTotal) * 100 : 0;
  const netMarginPct = finMetrics.revenueTotal > 0 ? (finMetrics.valueLiquidEst / finMetrics.revenueTotal) * 100 : 0;
  const formatPct = (value: number) => `${value.toFixed(1).replace('.', ',')}%`;
  const isNetProfitNegative = finMetrics.valueLiquidEst < 0;
  const isNetProfitLow = finMetrics.valueLiquidEst >= 0 && finMetrics.valueLiquidEst <= finMetrics.revenueTotal * 0.1;
  const netProfitCardClass = isNetProfitNegative
    ? 'border-red-500/40 bg-red-950/20'
    : isNetProfitLow
      ? 'border-amber-500/30 bg-amber-950/20'
      : 'border-neutral-850';
  const netProfitValueClass = isNetProfitNegative
    ? 'text-red-400'
    : isNetProfitLow
      ? 'text-amber-300'
      : 'text-emerald-400';

  // Motoboy summary cards statistics (accumulated past deliveries and comission)
  const getMotoboyCommissionCalculated = (boyId: string) => {
    let count = 0;
    let paidAmt = 0;
    orders.forEach(o => {
      if (o.motoboy_id === boyId && o.status === 'entregue') {
        count++;
        const b = motoboys.find(mb => mb.id === boyId);
        paidAmt += b?.commission_rate || 5.00;
      }
    });
    return { count, commission: paidAmt };
  };

  const formatOrderDateTime = (createdAt: string) => {
    const orderDate = new Date(createdAt);

    return {
      date: orderDate.toLocaleDateString('pt-BR'),
      time: orderDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  return (
    <div id="admin-module-root" className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-4 text-white">
      
      {/* 1. Left Nav Sidebar Panel */}
      <div id="admin-nav-sidebar" className="lg:col-span-1 flex flex-col bg-neutral-900 border border-neutral-850 p-4 rounded-2xl h-fit space-y-2 select-none">
        
        <div className="flex items-center gap-2 px-3 py-3 border-b border-neutral-800 mb-2">
          <Settings className="w-5 h-5 text-orange-500 hover:rotate-45 transition duration-300" />
          <span className="font-extrabold text-sm uppercase tracking-wider text-neutral-300">Painel de Controle</span>
        </div>

        <button
          id="btn-tab-dash"
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left transition ${
            activeTab === 'dashboard' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
        >
          <LayoutDashboard className="w-4.5 h-4.5" />
          <span>Dashboard</span>
        </button>

        <button
          id="btn-tab-pedidos"
          onClick={() => setActiveTab('pedidos')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left transition ${
            activeTab === 'pedidos' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
        >
          <ListOrdered className="w-4.5 h-4.5" />
          <div className="flex-1 flex justify-between items-center">
            <span>Pedidos</span>
            {todayMetrics.countPending > 0 && (
              <span className="h-5 px-1.5 rounded-full bg-amber-500 text-black text-[10px] font-bold animate-pulse flex items-center justify-center">
                {todayMetrics.countPending}
              </span>
            )}
          </div>
        </button>

        <button
          id="btn-tab-prods"
          onClick={() => setActiveTab('produtos')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left transition ${
            activeTab === 'produtos' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
        >
          <ShoppingBag className="w-4.5 h-4.5" />
          <span>Produtos</span>
        </button>

        <button
          id="btn-tab-cats"
          onClick={() => setActiveTab('categorias')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left transition ${
            activeTab === 'categorias' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
        >
          <ListCollapse className="w-4.5 h-4.5" />
          <span>Categorias</span>
        </button>

        <button
          id="btn-tab-motos"
          onClick={() => setActiveTab('motoboys')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left transition ${
            activeTab === 'motoboys' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
        >
          <Bike className="w-4.5 h-4.5" />
          <span>Motoboys</span>
        </button>

        <button
          id="btn-tab-fin"
          onClick={() => setActiveTab('financeiro')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left transition ${
            activeTab === 'financeiro' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
        >
          <DollarSign className="w-4.5 h-4.5" />
          <span>Giro / Financeiro</span>
        </button>

        <button
          id="btn-tab-config"
          onClick={() => setActiveTab('config')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left transition ${
            activeTab === 'config' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
        >
          <Settings className="w-4.5 h-4.5" />
          <span>Dados de Loja</span>
        </button>

        <button
          id="btn-tab-cupons"
          onClick={() => setActiveTab('cupons')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left transition ${
            activeTab === 'cupons' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
          }`}
        >
          <DollarSign className="w-4.5 h-4.5" />
          <span>Cupons & Cashback</span>
        </button>

        <button
          id="btn-tab-supabase"
          hidden
          onClick={() => setActiveTab('supabase')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-left border border-dashed border-orange-500/20 bg-orange-950/10 text-orange-400 hover:bg-orange-950/30 transition`}
        >
          <Copy className="w-4.5 h-4.5" />
          <span>Integração Supabase</span>
        </button>

        <div className="border-t border-neutral-800 pt-4 mt-4 text-[10px] text-neutral-500 text-center space-y-1 bg-neutral-950/20 p-2.5 rounded-lg select-text">
          <p>Database: <strong className={isMockMode ? "text-amber-500" : "text-emerald-400"}>{isMockMode ? "Supabase nao configurado" : "Supabase Real"}</strong></p>
        </div>
      </div>

      {/* 2. Main Content Board Tab Render */}
      <div id="admin-main-board" className="lg:col-span-4 bg-neutral-900/40 p-6 md:p-8 rounded-2xl border border-neutral-850 min-h-[550px] relative">
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
            <RefreshCw className="w-10 h-10 text-orange-500 animate-spin" />
          </div>
        )}

        <ActionDialog
          open={dialogState.open}
          title={dialogState.title}
          message={dialogState.message}
          tone={dialogState.tone}
          confirmLabel={dialogState.confirmLabel}
          cancelLabel={dialogState.cancelLabel}
          showCancel={dialogState.showCancel}
          onCancel={closeDialog}
          onConfirm={dialogState.onConfirm || closeDialog}
        />

        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold">Resumo Diário (Hoje)</h3>
                <p className="text-xs text-neutral-400">Visão geral instantânea do faturamento de hoje</p>
              </div>
              <button
                onClick={onRefreshData}
                className="flex items-center gap-1.5 p-2 bg-neutral-950 hover:bg-neutral-800 text-xs text-neutral-300 font-bold border border-neutral-800 rounded-lg transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Core Stats Bento Blocks Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Giro Geral Hoje</span>
                <span className="text-xl font-extrabold text-orange-400 mt-2 block">R$ {todayMetrics.revenueTotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Registros Hoje</span>
                <span className="text-xl font-extrabold text-neutral-100 mt-2 block">{todayMetrics.ordersCount} pedidos</span>
              </div>
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Faturamento Delivery</span>
                <span className="text-xl font-extrabold text-white mt-2 block">R$ {todayMetrics.revenueDelivery.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Comanda em Mesa</span>
                <span className="text-xl font-extrabold text-white mt-2 block">R$ {todayMetrics.revenueMesa.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Separation Details Column */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="bg-neutral-950/60 p-4.5 rounded-xl border border-neutral-850 text-center">
                <div className="text-lg font-bold text-neutral-400">{todayMetrics.countPending}</div>
                <div className="text-[10px] text-amber-500 uppercase font-semibold mt-1">Pendentes</div>
              </div>
              <div className="bg-neutral-950/60 p-4.5 rounded-xl border border-neutral-850 text-center">
                <div className="text-lg font-bold text-neutral-400">{todayMetrics.countPreparo}</div>
                <div className="text-[10px] text-blue-400 uppercase font-semibold mt-1">Em Preparo</div>
              </div>
              <div className="bg-neutral-950/60 p-4.5 rounded-xl border border-neutral-855 text-center">
                <div className="text-lg font-bold text-neutral-400">{todayMetrics.countEnviados}</div>
                <div className="text-[10px] text-orange-400 uppercase font-semibold mt-1">Saiu p/ entrega</div>
              </div>
              <div className="bg-neutral-950/60 p-4.5 rounded-xl border border-neutral-850 text-center">
                <div className="text-lg font-bold text-neutral-400">{todayMetrics.countEntregues}</div>
                <div className="text-[10px] text-emerald-400 uppercase font-semibold mt-1">Entregues</div>
              </div>
            </div>

            {/* Splitted relative weights bar chart */}
            <div className="p-5 bg-neutral-955 bg-neutral-950 border border-neutral-850 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-440">Divisão de Giro por Tipo de Faturamento</h4>
              
              <div className="space-y-4">
                {/* Visual Relative bar */}
                <div className="h-6.5 w-full bg-neutral-900 rounded-full overflow-hidden flex text-xs font-bold text-white tracking-widest">
                  {todayMetrics.revenueTotal === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600 font-medium">Nenhum faturamento registrado hoje</div>
                  ) : (
                    <>
                      {todayMetrics.revenueDelivery > 0 && (
                        <div
                          style={{ width: `${(todayMetrics.revenueDelivery / todayMetrics.revenueTotal) * 100}%` }}
                          className="bg-orange-600 h-full flex items-center justify-center min-w-[20px]"
                          title="Delivery"
                        >
                          D
                        </div>
                      )}
                      {todayMetrics.revenueMesa > 0 && (
                        <div
                          style={{ width: `${(todayMetrics.revenueMesa / todayMetrics.revenueTotal) * 100}%` }}
                          className="bg-amber-500 h-full text-black flex items-center justify-center min-w-[20px]"
                          title="Comanda Mesa"
                        >
                          M
                        </div>
                      )}
                      {todayMetrics.revenueRetirada > 0 && (
                        <div
                          style={{ width: `${(todayMetrics.revenueRetirada / todayMetrics.revenueTotal) * 100}%` }}
                          className="bg-neutral-600 h-full flex items-center justify-center min-w-[20px]"
                          title="Retirada/Balcão"
                        >
                          R
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Legend details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-orange-600 block shrink-0" />
                    <span className="text-neutral-400">Delivery Tradicional:</span>
                    <strong className="text-neutral-200">R$ {todayMetrics.revenueDelivery.toFixed(2).replace('.', ',')}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-500 block shrink-0" />
                    <span className="text-neutral-400">Pedidos para Mesa:</span>
                    <strong className="text-neutral-200">R$ {todayMetrics.revenueMesa.toFixed(2).replace('.', ',')}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-neutral-600 block shrink-0" />
                    <span className="text-neutral-400">Retirada no Balcão:</span>
                    <strong className="text-neutral-200">R$ {todayMetrics.revenueRetirada.toFixed(2).replace('.', ',')}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick action shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-950/40 border border-neutral-850 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider block">Serviço de Entregas por Motoboy</span>
                <p className="text-xs text-neutral-400">Hoje foram delegados <strong className="text-white">{todayMetrics.motoboyDeliveriesCount} pedidos</strong> de entrega a prestadores, com custo de intermediação comissária de <strong className="text-orange-400">R$ {todayMetrics.motoboyCommissionTotal.toFixed(2).replace('.', ',')}</strong>.</p>
              </div>
              <div className="p-4 bg-neutral-950/40 border border-neutral-850 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-neutral-455 uppercase tracking-wider block">Saldo do Estabelecimento</span>
                <p className="text-xs text-neutral-400">Faturamento consolidado líquido descontadas as taxas e comissões dos motoboys: <strong className="text-emerald-400">R$ {todayMetrics.valueLiquidEst.toFixed(2).replace('.', ',')}</strong>.</p>
              </div>
            </div>

          </div>
        )}

        {/* TAB: PEDIDOS */}
        {activeTab === 'pedidos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold">Gestão Real-Time de Pedidos</h3>
                <p className="text-xs text-neutral-400">Controle de preparo, envio, motoboys e faturamento de comanda</p>
              </div>
              <button
                onClick={onRefreshData}
                className="flex items-center gap-1.5 p-2 bg-neutral-950 hover:bg-neutral-800 text-xs text-neutral-350 border border-neutral-800 rounded-lg transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar Lista</span>
              </button>
            </div>

            {/* List entries */}
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="text-center py-16 bg-neutral-950/30 rounded-2xl border border-dashed border-neutral-800">
                  <p className="text-neutral-500 font-medium text-sm">Nenhum pedido registrado no banco de dados.</p>
                </div>
              ) : (
                orders.map((ord) => (
                  <div
                    id={`admin-order-item-${ord.id}`}
                    key={ord.id}
                    className="bg-neutral-950 p-5 rounded-2xl border border-neutral-850 hover:border-neutral-800 transition space-y-4"
                  >
                    {/* Primary top row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-base font-extrabold text-orange-400">{ord.seq_code}</span>
                        <span className="text-xs text-neutral-500">{formatOrderDateTime(ord.created_at).time}</span>
                        <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-400">
                          {formatOrderDateTime(ord.created_at).date}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          ord.type === 'delivery' ? 'bg-orange-950 text-orange-400 border border-orange-800/30' :
                          ord.type === 'mesa' ? 'bg-amber-950 text-amber-400 border border-amber-800/30' :
                          'bg-neutral-900 text-neutral-400 border border-neutral-800'
                        }`}>
                          {ord.type === 'delivery' ? 'Entrega' : ord.type === 'retirada' ? 'Retirada' : `Mesa ${ord.table_number}`}
                        </span>
                      </div>

                      {/* Selectable Order States Dropdown Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {ord.status === 'pendente' && (
                          <>
                            <button
                              id={`accept-order-${ord.id}`}
                              onClick={() => onUpdateOrderStatus(ord.id, 'preparando')}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition"
                            >
                              Aceitar Pedido
                            </button>
                            <button
                              id={`refuse-order-${ord.id}`}
                              onClick={() => openConfirmDialog(
                                'Recusar pedido',
                                'Deseja realmente recusar esse pedido?',
                                () => onUpdateOrderStatus(ord.id, 'recusado'),
                                'Recusar'
                              )}
                              className="px-3 py-1.5 bg-red-950/60 border border-red-900/30 text-red-400 hover:text-red-300 font-bold text-xs rounded-xl transition"
                            >
                              Recusar
                            </button>
                          </>
                        )}

                        {ord.status !== 'pendente' && ord.status !== 'recusado' && ord.status !== 'entregue' && ord.status !== 'cancelado' && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold text-neutral-450 uppercase mr-1 select-none">Progredir para:</span>
                            
                            {ord.status === 'aceito' || ord.status === 'preparando' ? (
                              <button
                                onClick={() => onUpdateOrderStatus(ord.id, 'enviando')}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition"
                              >
                                {ord.type === 'delivery' ? 'Pronto (Despachar)' : 'Chamar Cliente'}
                              </button>
                            ) : ord.status === 'enviando' ? (
                              <button
                                onClick={() => onUpdateOrderStatus(ord.id, 'entregue')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition"
                              >
                                Finalizar (Entregue)
                              </button>
                            ) : null}

                            <button
                              onClick={() => onUpdateOrderStatus(ord.id, 'cancelado')}
                              className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-red-400 hover:border-red-950 font-bold text-xs rounded-xl transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}

                        {/* Order closed indicators */}
                        {ord.status === 'entregue' && (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/30 px-3 py-1 rounded-xl border border-emerald-900/20 uppercase tracking-widest flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Entregue
                          </span>
                        )}

                        {ord.status === 'cancelado' && (
                          <span className="text-xs font-bold text-red-500 bg-red-950/30 px-3 py-1 rounded-xl border border-red-900/20 uppercase tracking-widest flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> Cancelado
                          </span>
                        )}
                        
                        {ord.status === 'recusado' && (
                          <span className="text-xs font-bold text-neutral-500 bg-neutral-900 px-3 py-1 rounded-xl border border-neutral-800 uppercase tracking-widest flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> Recusado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Secondary detail blocks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-500 font-semibold block select-none uppercase text-[9px]">Cliente</span>
                        <strong className="text-neutral-200 block text-sm mt-0.5">{ord.customer_name}</strong>
                        <span className="text-neutral-400 mt-0.5 block select-all">{ord.customer_phone}</span>
                      </div>

                      <div>
                        <span className="text-neutral-500 font-semibold block select-none uppercase text-[9px]">Faturamento e Troco</span>
                        <strong className="text-neutral-200 block text-sm mt-0.5">R$ {ord.total.toFixed(2).replace('.', ',')}</strong>
                        <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                          {ord.payment_method.replace('_', ' ')}
                        </span>
                        {ord.change_for && (
                          <span className="text-red-400 block font-semibold text-[10px] mt-0.5">Levar troco para R$ {ord.change_for} (Troco: {(parseFloat(ord.change_for) - ord.total).toFixed(2).replace('.', ',')})</span>
                        )}
                      </div>

                      <div>
                        <span className="text-neutral-500 font-semibold block select-none uppercase text-[9px]">Status de Cobrança</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            ord.payment_status === 'pago' ? 'bg-emerald-950/60 text-emerald-400' : 'bg-red-953 bg-amber-950/60 text-amber-400'
                          }`}>
                            {ord.payment_status.replace('_', ' ')}
                          </span>

                          {ord.payment_status !== 'pago' && (
                            <button
                              onClick={() => onUpdateOrderPaymentStatus(ord.id, 'pago')}
                              className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded hover:text-emerald-400 hover:border-emerald-900 transition"
                            >
                              Marcar como Pago
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Custom general remarks */}
                    {ord.notes && (
                      <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850/40 text-xs italic text-neutral-400 leading-snug">
                        Obs: "{ord.notes}"
                      </div>
                    )}

                    {/* Order action 3: Motoboy assigned */}
                    {ord.type === 'delivery' && ord.status !== 'cancelado' && ord.status !== 'recusado' && (
                      <div className="p-4 bg-neutral-950/60 border border-neutral-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Bike className="w-4.5 h-4.5 text-neutral-500 shrink-0" />
                          <div>
                            <span className="text-[10px] text-neutral-500 font-semibold block select-none uppercase">Distribuição da Entrega</span>
                            <strong className="text-neutral-200">
                              {ord.motoboy_id
                                ? motoboys.find(m => m.id === ord.motoboy_id)?.name || 'Motoboy Atribuído'
                                : 'Aguardando Atribuição'
                              }
                            </strong>
                          </div>
                        </div>

                        {/* Assign motoboy selector dropdown */}
                        <div className="flex items-center gap-2">
                          <select
                            id={`assign-select-${ord.id}`}
                            value={ord.motoboy_id || ''}
                            onChange={(e) => onAssignMotoboy(ord.id, e.target.value ? e.target.value : undefined)}
                            className="bg-neutral-900 border border-neutral-800 text-neutral-350 p-2 text-xs rounded-xl focus:outline-none"
                          >
                            <option value="">-- Selecionar Motoboy --</option>
                            {motoboys.filter(m => m.is_active).map(boy => (
                              <option key={boy.id} value={boy.id}>
                                {boy.name} (Taxa R$ {boy.commission_rate.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Accordion products items display */}
                    <div className="space-y-1">
                      <button
                        onClick={() => handleLoadItems(ord.id)}
                        className="text-xs text-neutral-400 hover:text-orange-400 flex items-center gap-1 font-bold underline transition"
                      >
                        {activeOrderItemsId === ord.id ? 'Ocultar Produtos do Pedido' : 'Ver Detalhes do Pedido (Itens)'}
                      </button>

                      {activeOrderItemsId === ord.id && (
                        <div className="bg-neutral-950/80 p-4 border border-neutral-850 rounded-xl space-y-2 mt-2 animate-fade-in text-xs max-w-md">
                          <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Lista de Itens</h4>
                          <div className="space-y-1 pt-1.5 division-y division-neutral-850">
                            {activeOrderItems.map(it => (
                              <div key={it.id} className="flex justify-between items-center py-1">
                                <span className="font-semibold text-neutral-200">{it.quantity}x {it.product_name}</span>
                                <span className="text-neutral-400">R$ {it.total.toFixed(2).replace('.', ',')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* TAB: PRODUTOS */}
        {activeTab === 'produtos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold">Gerenciamento de Produtos</h3>
                <p className="text-xs text-neutral-400">Crie, edite, controle estoque e mude valores dos lanches</p>
              </div>
              <button
                id="add-product-btn"
                onClick={() => handleOpenProductModal(null)}
                className="flex items-center gap-1.5 p-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-xs text-white font-bold rounded-xl transition shadow-lg shadow-orange-950/20"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Produto</span>
              </button>
            </div>

            {/* Catalog list matrix */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {products.map(p => (
                <div
                  id={`admin-product-item-${p.id}`}
                  key={p.id}
                  className="relative flex w-full max-w-full gap-3 overflow-hidden rounded-xl border border-neutral-850 bg-neutral-950 p-4 pr-20 text-xs transition hover:border-neutral-800"
                >
                  <img
                    src={p.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=50&w=200'}
                    alt={p.name}
                    className="h-14 w-14 shrink-0 rounded-lg border border-neutral-850 bg-neutral-900 object-cover sm:h-16 sm:w-16"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 pr-2">
                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest bg-orange-950/40 px-1.5 py-0.5 rounded-md inline-block select-none mb-1">
                          {p.category}
                        </span>
                        <h4 className="mb-1 text-sm font-bold leading-tight text-neutral-200">{p.name}</h4>
                      </div>

                      <div className="absolute right-3 top-3 flex shrink-0 gap-1">
                        <button
                          id={`edit-prod-${p.id}`}
                          onClick={() => handleOpenProductModal(p)}
                          className="p-1 text-neutral-450 hover:text-white transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-prod-${p.id}`}
                          onClick={() => openConfirmDialog(
                            'Excluir produto',
                            `Deseja realmente excluir ${p.name}?`,
                            () => runAdminAction(() => onDeleteProduct(p.id), {
                              successTitle: 'Produto removido',
                              successMessage: 'O produto foi removido com sucesso.',
                              errorTitle: 'Falha ao excluir produto'
                            }),
                            'Excluir'
                          )}
                          className="p-1 text-neutral-455 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-1 text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        Preço: <strong className="text-white">R$ {p.price.toFixed(2).replace('.', ',')}</strong>
                        {p.is_promo && p.promo_price && (
                          <span className="text-orange-450 ml-1.5 text-[10px]">Promo R$ {p.promo_price.toFixed(2).replace('.', ',')}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 sm:text-right">
                        <div>Custo: <strong className="text-neutral-300">R$ {(p.cost_price ?? 0).toFixed(2).replace('.', ',')}</strong></div>
                        Estoque: <strong className={p.stock_quantity === 0 ? "text-red-500" : "text-white"}>{p.stock_quantity} un</strong>
                      </div>
                    </div>

                    {/* Status quick toggle bar */}
                    <div className="mt-2.5 flex flex-col gap-2 border-t border-neutral-900 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[10px] text-neutral-500">Exibir no Cardápio do Cliente:</span>
                      <button
                        onClick={() => onSaveProduct({ ...p, is_active: !p.is_active })}
                        className={`w-fit text-[9px] px-2 py-0.5 font-bold uppercase rounded ${p.is_active ? "bg-emerald-950 text-emerald-400" : "bg-red-952 bg-red-950 text-red-500"}`}
                      >
                        {p.is_active ? "Ativado" : "Desativado"}
                      </button>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {/* MODAL: EDIT/ADD PRODUCT */}
            {productModalOpen && (
              <div id="product-form-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <form onSubmit={handleSaveProductForm} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">{editingProduct ? 'Editar Produto' : 'Cadastrar Novo Lanche'}</h3>
                  
                  <div className="grid grid-cols-1 gap-3 text-xs text-neutral-350 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block">Nome do Lanche</label>
                      <input
                        type="text"
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="block">Descrição Curta (Ingredientes)</label>
                      <textarea
                        value={pDesc}
                        onChange={(e) => setPDesc(e.target.value)}
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white h-16 resize-none outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block">Preço Unitário (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pPrice}
                        onChange={(e) => setPPrice(Number(e.target.value))}
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block">Custo do Produto (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pCostPrice}
                        onChange={(e) => setPCostPrice(Number(e.target.value))}
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block">Quantidade em Estoque</label>
                      <input
                        type="number"
                        value={pStock}
                        onChange={(e) => setPStock(Number(e.target.value))}
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block">Categoria</label>
                      <select
                        value={pCategory}
                        onChange={(e) => setPCategory(e.target.value)}
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block">Imagem (URL)</label>
                      <input
                        type="text"
                        value={pImage}
                        onChange={(e) => setPImage(e.target.value)}
                        placeholder="http://..."
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                      />
                    </div>

                    {/* Promotion toggle */}
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-850 bg-neutral-950 p-3.5 sm:col-span-2">
                      <div>
                        <span className="block font-bold">Colocar em Oferta/Promoção?</span>
                        <span className="text-[10px] text-neutral-500">Permite aplicar preço promocional rebaixado</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={pIsPromo}
                        onChange={(e) => setPIsPromo(e.target.checked)}
                        className="h-5 w-5 rounded border-neutral-800 text-orange-600 bg-neutral-950 text-right shrink-0"
                      />
                    </div>

                    {pIsPromo && (
                      <div className="space-y-1 animate-fade-in sm:col-span-2">
                        <label className="block text-orange-400">Preço Promocional (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={pPromoPrice}
                          onChange={(e) => setPPromoPrice(Number(e.target.value))}
                          className="w-full bg-neutral-950 p-2.5 border border-orange-950/40 rounded-xl text-white outline-none font-bold text-orange-400"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-850 bg-neutral-950 p-3.5 sm:col-span-2">
                      <div>
                        <span className="block font-bold">Lanche Ativo?</span>
                        <span className="text-[10px] text-neutral-500">Se desativado, oculta temporariamente o produto do cardápio</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={pActive}
                        onChange={(e) => setPActive(e.target.checked)}
                        className="h-5 w-5 rounded border-neutral-800 text-orange-600 bg-neutral-950 shrink-0 text-right"
                      />
                    </div>

                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setProductModalOpen(false)}
                      className="flex-1 py-2.5 bg-neutral-950 border border-neutral-805 text-neutral-450 font-bold text-xs rounded-xl"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 bg-orange-600 text-white hover:bg-orange-700 font-bold text-xs rounded-xl"
                    >
                      {isLoading ? 'Salvando...' : 'Salvar Produto'}
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}

        {/* TAB: CATEGORIAS */}
        {activeTab === 'categorias' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold">Cadastro de Categorias</h3>
                <p className="text-xs text-neutral-400">Crie seções como Hambúrgueres, Combos, Bebidas e etc.</p>
              </div>
              <button
                id="add-category-btn"
                onClick={() => handleOpenCategoryModal(null)}
                className="flex items-center gap-1.5 p-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-xs text-white font-bold rounded-xl transition shadow-lg shadow-orange-950/20"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Categoria</span>
              </button>
            </div>

            {/* List entries layout */}
            <div className="max-w-md space-y-2">
              {categories.map(c => (
                <div
                  id={`admin-category-item-${c.id}`}
                  key={c.id}
                  className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 flex items-center justify-between text-xs"
                >
                  <strong className="text-sm text-neutral-200">{c.name}</strong>
                  
                  <div className="flex gap-2">
                    <button
                      id={`edit-cat-${c.id}`}
                      onClick={() => handleOpenCategoryModal(c)}
                      className="text-neutral-500 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`delete-cat-${c.id}`}
                      onClick={() => {
                        return openConfirmDialog('Excluir categoria', `Deseja realmente deletar a categoria ${c.name}? Lanches com esta categoria podem precisar ser reatribuídos.`, () => onDeleteCategory(c.id), 'Excluir');
                      }}
                      className="text-neutral-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* MODAL: CATEGORY FIELD */}
            {categoryModalOpen && (
              <div id="category-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <form onSubmit={handleSaveCategoryForm} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
                  <h3 className="text-sm font-bold uppercase text-white tracking-widest">{editingCategory ? "Editar Categoria" : "Nova Categoria"}</h3>
                  
                  <div className="space-y-1 text-xs">
                    <label className="text-neutral-450 block">Nome do agrupamento</label>
                    <input
                      type="text"
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder="Ex: Porções Finas"
                      className="w-full bg-neutral-950 p-3 rounded-xl border border-neutral-805 text-white outline-none font-bold"
                      required
                    />
                  </div>

                  <div className="flex gap-2 text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setCategoryModalOpen(false)}
                      className="flex-1 py-2 bg-neutral-950 border border-neutral-800 text-neutral-400 rounded-xl"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-orange-600 hover:bg-orange-750 text-white font-bold rounded-xl"
                    >
                      Salvar Seção
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}

        {/* TAB: MOTOBOYS */}
        {activeTab === 'motoboys' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold">Cadastro de Motoboys</h3>
                <p className="text-xs text-neutral-400">Cadastre motoboys, comissão fixa e confira histórico de entregas</p>
              </div>
              <button
                id="add-motoboy-btn"
                onClick={() => handleOpenMotoboyModal(null)}
                className="flex items-center gap-1.5 p-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-xs text-white font-bold rounded-xl transition shadow-lg shadow-orange-950/20"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Prestador</span>
              </button>
            </div>

            {/* Drivers cards listing */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {motoboys.map(boy => {
                const results = getMotoboyCommissionCalculated(boy.id);
                return (
                  <div
                    id={`admin-motoboy-item-${boy.id}`}
                    key={boy.id}
                    className="bg-neutral-950 p-5 rounded-2xl border border-neutral-850 hover:border-neutral-800 transition text-xs space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-neutral-200">{boy.name}</h4>
                        <p className="text-neutral-500 mt-0.5 font-mono select-all text-[11px]">Placa: {boy.license_plate || 'N/A'}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          id={`edit-boy-${boy.id}`}
                          onClick={() => handleOpenMotoboyModal(boy)}
                          className="text-neutral-500 hover:text-white transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-boy-${boy.id}`}
                          onClick={() => {
                            return openConfirmDialog('Remover motoboy', `Deseja realmente remover o cadastro de ${boy.name}?`, () => onDeleteMotoboy(boy.id), 'Remover');
                          }}
                          className="text-neutral-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-850/40 bg-neutral-9003/30 p-3 text-[11px] font-semibold leading-relaxed text-neutral-450 sm:grid-cols-2">
                      <div className="min-w-0">
                        WhatsApp: <span className="text-white select-all">{boy.phone}</span>
                      </div>
                      <div className="min-w-0">
                        E-mail: <span className="text-white select-all">{boy.email}</span>
                      </div>
                      <div>
                        Comissão: <span className="text-white">R$ {boy.commission_rate.toFixed(2).replace('.', ',')} / entrega</span>
                      </div>
                      <div>
                        Status: <span className={boy.is_active ? "text-emerald-400" : "text-red-500"}>{boy.is_active ? "Ativo" : "Inativo"}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-neutral-900 pt-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        Entregas concls: <strong className="text-orange-400">{results.count} corridas</strong>
                      </div>
                      <div>
                        Comissões Acumuladas: <strong className="text-emerald-400">R$ {results.commission.toFixed(2).replace('.', ',')}</strong>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* MODAL: MOTOBOY FIELD */}
            {motoboyModalOpen && (
              <div id="motoboy-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <form onSubmit={handleSaveMotoboyForm} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-4">
                  <h3 className="text-sm font-bold uppercase text-white tracking-widest">{editingMotoboy ? "Editar Motoboy" : "Cadastrar Motoboy"}</h3>
                  
                  <div className="grid grid-cols-1 gap-3 text-xs text-neutral-350 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label>Nome Completo</label>
                      <input
                        type="text"
                        value={mName}
                        onChange={(e) => setMName(e.target.value)}
                        placeholder="Ex: João Batista"
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label>WhatsApp</label>
                      <input
                        type="text"
                        value={mPhone}
                        onChange={(e) => setMPhone(e.target.value)}
                        placeholder="Ex: (11) 98888-2222"
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label>E-mail (Credencial)</label>
                      <input
                        type="email"
                        value={mEmail}
                        onChange={(e) => setMEmail(e.target.value)}
                        placeholder="Ex: joao@gmail.com"
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label>Placa da Motocicleta</label>
                      <input
                        type="text"
                        value={mPlate}
                        onChange={(e) => setMPlate(e.target.value)}
                        placeholder="Ex: MTO-9281"
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label>Comissão por Entrega (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mRate}
                        onChange={(e) => setMRate(Number(e.target.value))}
                        className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-850 bg-neutral-955 bg-neutral-950 p-3 sm:col-span-2">
                      <div>
                        <span className="block font-bold">Prestador Ativo?</span>
                        <span className="text-[10px] text-neutral-500">Motoboys inativos não aparecem na triagem de entrega</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={mActive}
                        onChange={(e) => setMActive(e.target.checked)}
                        className="h-5 w-5 rounded border-neutral-800 text-orange-600 bg-neutral-950 text-right"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 text-xs pt-2">
                    <button
                      type="button"
                      onClick={() => setMotoboyModalOpen(false)}
                      className="flex-1 py-2.5 bg-neutral-950 border border-neutral-800 text-neutral-400 rounded-xl"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl"
                    >
                      Salvar Prestador
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}

        {/* TAB: FINANCEIRO / GIRO */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold">Giro Financeiro e Conciliação</h3>
                <p className="text-xs text-neutral-400">Separação exata de faturamento, liquidez e comissão de entrega</p>
              </div>

              {/* Timeframe filters selector */}
              <div className="flex w-full max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-neutral-850 bg-neutral-950 p-1 select-none sm:w-auto">
                <button
                  onClick={() => setFinFilter('hoje')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition ${
                    finFilter === 'hoje' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Hoje
                </button>
                <button
                  onClick={() => setFinFilter('semana')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition ${
                    finFilter === 'semana' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  7 Dias
                </button>
                <button
                  onClick={() => setFinFilter('mes')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition ${
                    finFilter === 'mes' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  30 Dias
                </button>
                <button
                  onClick={() => setFinFilter('personalizado')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition ${
                    finFilter === 'personalizado' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Filtro Calendário
                </button>
              </div>
            </div>

            {/* Custom inputs calendar overlay popup if selected */}
            {finFilter === 'personalizado' && (
              <div className="space-y-3 rounded-xl border border-neutral-850 bg-neutral-950 p-4 text-xs">
                <h4 className="font-extrabold uppercase text-[10px] text-neutral-500 tracking-wider">Período Selecionado</h4>
                <div className="flex max-w-sm flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="date"
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="bg-neutral-900 border border-neutral-805 p-1 px-2.5 rounded text-white"
                  />
                  <span className="text-neutral-450">Até</span>
                  <input
                    type="date"
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="bg-neutral-900 border border-neutral-805 p-1 px-2.5 rounded text-white"
                  />
                </div>
              </div>
            )}

            {/* Complete Consolidate accounting sheet details */}
            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2 xl:grid-cols-5">
              
              <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-850 flex min-h-[220px] flex-col gap-4">
                <div>
                  <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider block">Receita Bruta</span>
                  <p className="text-xs text-neutral-400 mt-1">Soma bruta de todos os lanches, bebidas e taxas no período</p>
                </div>
                <div className="mt-auto text-2xl font-extrabold text-orange-400 font-mono leading-none">R$ {finMetrics.revenueTotal.toFixed(2).replace('.', ',')}</div>
              </div>

              <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-850 flex min-h-[220px] flex-col gap-4">
                <div>
                  <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider block">Custo dos Produtos</span>
                  <p className="text-xs text-neutral-400 mt-1">Soma do custo de produÃ§Ã£o dos itens vendidos no perÃ­odo</p>
                </div>
                <div className="mt-auto text-2xl font-extrabold text-amber-300 font-mono leading-none">R$ {finMetrics.productCostTotal.toFixed(2).replace('.', ',')}</div>
              </div>

              <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-850 flex min-h-[220px] flex-col gap-4">
                <div>
                  <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider block">Lucro Bruto</span>
                  <p className="text-xs text-neutral-400 mt-1">Faturamento bruto menos custo dos produtos vendidos</p>
                  <p className="mt-2 text-[11px] font-semibold text-sky-200">Margem bruta: {formatPct(grossMarginPct)}</p>
                </div>
                <div className="mt-auto text-2xl font-extrabold text-sky-300 font-mono leading-none">R$ {finMetrics.grossProfitEst.toFixed(2).replace('.', ',')}</div>
              </div>

              <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-850 flex min-h-[220px] flex-col gap-4">
                <div>
                  <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider block">Comissão Delivery</span>
                  <p className="text-xs text-neutral-400 mt-1">Remuneração paga aos entregadores terceirizados no período</p>
                </div>
                <div className="mt-auto text-2xl font-extrabold text-red-400 font-mono leading-none">R$ {finMetrics.motoboyCommissionTotal.toFixed(2).replace('.', ',')}</div>
              </div>

              <div className={`bg-neutral-950 p-5 rounded-2xl border flex min-h-[220px] flex-col gap-4 ${netProfitCardClass}`}>
                <div>
                  <span className="text-[10px] text-neutral-450 font-semibold uppercase tracking-wider block">Lucro Líquido</span>
                  <p className="text-xs text-neutral-400 mt-1">Lucro bruto menos comissão do entregador no período</p>
                  <p className={`mt-2 text-[11px] font-semibold ${isNetProfitNegative ? 'text-red-200' : isNetProfitLow ? 'text-amber-200' : 'text-emerald-200'}`}>Margem líquida: {formatPct(netMarginPct)}</p>
                  {isNetProfitNegative && (
                    <p className="mt-2 text-[11px] font-semibold text-red-300">Resultado negativo: os custos e comissões passaram a receita do período.</p>
                  )}
                  {!isNetProfitNegative && isNetProfitLow && (
                    <p className="mt-2 text-[11px] font-semibold text-amber-200">Margem baixa: o lucro líquido está muito próximo de zero.</p>
                  )}
                </div>
                <div className={`mt-auto text-2xl font-extrabold font-mono leading-none ${netProfitValueClass}`}>R$ {finMetrics.valueLiquidEst.toFixed(2).replace('.', ',')}</div>
              </div>

            </div>

            {/* Split specifics details sheet list */}
            <div className="p-6 bg-neutral-950 border border-neutral-850 rounded-2xl text-xs space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider block select-none">Resumo Financeiro do Período</h4>
              
              <div className="space-y-2 pt-2 border-t border-neutral-900 division-y division-neutral-905">
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Receita bruta de delivery:</span>
                  <strong className="text-neutral-200">R$ {finMetrics.revenueDelivery.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Receita bruta de mesa/comanda:</span>
                  <strong className="text-neutral-200">R$ {finMetrics.revenueMesa.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Receita bruta de retirada/balcão:</span>
                  <strong className="text-neutral-200">R$ {finMetrics.revenueRetirada.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Entregas realizadas no período:</span>
                  <strong className="text-neutral-200">{finMetrics.motoboyDeliveriesCount} corridas</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Custo total dos produtos vendidos:</span>
                  <strong className="text-amber-300">R$ {finMetrics.productCostTotal.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Lucro bruto do período:</span>
                  <strong className="text-sky-300">R$ {finMetrics.grossProfitEst.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Comissão total dos entregadores:</span>
                  <strong className="text-red-400">R$ {finMetrics.motoboyCommissionTotal.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Lucro líquido do período:</span>
                  <strong className="text-emerald-400">R$ {finMetrics.valueLiquidEst.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Margem bruta do período:</span>
                  <strong className="text-sky-200">{formatPct(grossMarginPct)}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-neutral-400">Margem líquida do período:</span>
                  <strong className={isNetProfitNegative ? 'text-red-300' : isNetProfitLow ? 'text-amber-200' : 'text-emerald-300'}>{formatPct(netMarginPct)}</strong>
                </div>
                <div className="flex justify-between items-center py-2 select-text">
                  <span className="text-neutral-400">Pedidos cadastrados no período:</span>
                  <strong className="text-neutral-200">{finMetrics.ordersCount} pedidos</strong>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB: CONFIGURAÇÕES DA LOJA */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveEstablishmentSettings} className="space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="border-b border-neutral-800 pb-4">
              <h3 className="text-xl font-bold">Configurações Gerais do Estabelecimento</h3>
              <p className="text-xs text-neutral-400">Nome, endereços, PIX e horário de funcionamento ao vivo</p>
            </div>

            {/* Fields layout */}
            <div className="grid grid-cols-1 gap-4 text-xs text-neutral-350 sm:grid-cols-2">
              
              {/* Store state switch banner layout */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-850 bg-neutral-955 bg-neutral-950 p-4 sm:col-span-2">
                <div>
                  <span className="block font-bold">Estabelecimento Aberto? (Status On-line)</span>
                  <span className="text-[10px] text-neutral-500">Se fechado, clientes visualizam os produtos, mas são impedidos de fechar novos pedidos</span>
                </div>
                <button
                  type="button"
                  id="store-state-toggle-btn"
                  onClick={() => {
                    void handleToggleStoreOpen();
                  }}
                  disabled={isLoading}
                  className={`px-4 py-2 font-bold uppercase rounded-xl transition ${
                    stOpen ? 'bg-emerald-600 text-white' : 'bg-red-650 bg-red-950 text-red-500'
                  }`}
                >
                  {stOpen ? 'Aberto (Recebendo)' : 'Fechado (Apenas Leitura)'}
                </button>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label>Nome do Estabelecimento / Empresa</label>
                <input
                  type="text"
                  value={stName}
                  onChange={(e) => setStName(e.target.value)}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none font-bold text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label>Avg. Tempo de Entrega</label>
                <input
                  type="text"
                  value={stAvgTime}
                  onChange={(e) => setStAvgTime(e.target.value)}
                  placeholder="Ex: 30 a 50 min"
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label>Taxa de Entrega de Balcão/Motoboy (R$)</label>
                <input
                  type="number"
                  step="0.1"
                  value={stFee}
                  onChange={(e) => setStFee(Number(e.target.value))}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label>Horário de Funcionamento em texto corrido</label>
                <input
                  type="text"
                  value={stHours}
                  onChange={(e) => setStHours(e.target.value)}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label>Endereço Físico completo da Sede</label>
                <input
                  type="text"
                  value={stAddress}
                  onChange={(e) => setStAddress(e.target.value)}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label>Chave Pix oficial da Empresa</label>
                <input
                  type="text"
                  value={stPixKey}
                  onChange={(e) => setStPixKey(e.target.value)}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label>WhatsApp contato (Ex: 5511999999999)</label>
                <input
                  type="text"
                  value={stWhatsapp}
                  onChange={(e) => setStWhatsapp(e.target.value)}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none font-mono"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label>Código Pix Estático "Copia e Cola" (Opcional)</label>
                <textarea
                  value={stPixCode}
                  onChange={(e) => setStPixCode(e.target.value)}
                  placeholder="00020101021126580014..."
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white h-16 resize-none outline-none font-mono text-[10px]"
                />
              </div>

              <div className="space-y-1">
                <label>Imagem da Logo (URL)</label>
                <input
                  type="text"
                  value={stLogo}
                  onChange={(e) => setStLogo(e.target.value)}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label>Imagem do Banner Superior (URL)</label>
                <input
                  type="text"
                  value={stBanner}
                  onChange={(e) => setStBanner(e.target.value)}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label>Título do Banner (deixe vazio para usar o nome da loja)</label>
                <input
                  type="text"
                  value={stBannerTitle}
                  onChange={(e) => setStBannerTitle(e.target.value)}
                  placeholder={stName}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label>Subtítulo do Banner</label>
                <input
                  type="text"
                  value={stBannerSubtitle}
                  onChange={(e) => setStBannerSubtitle(e.target.value)}
                  placeholder="Confira nosso cardápio e peça agora!"
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label>Cashback (% sobre o subtotal entregue)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={stCashbackPct}
                  onChange={(e) => setStCashbackPct(Number(e.target.value))}
                  className="w-full bg-neutral-950 p-2.5 border border-neutral-805 rounded-xl text-white outline-none"
                />
              </div>

            </div>

            <button
              id="submit-settings-btn"
              type="submit"
              className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 shadow"
            >
              <span>Salvar Configurações da Loja</span>
            </button>

          </form>
        )}

        {/* TAB: CUPONS & CASHBACK */}
        {activeTab === 'cupons' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-xl font-bold">Cupons de Desconto</h3>
                <p className="text-xs text-neutral-400">Crie e gerencie cupons de desconto para seus clientes</p>
              </div>
              <button
                onClick={async () => {
                  if (!couponsLoaded) {
                    const { db } = await import('../supabaseClient');
                    setCoupons(await db.getCoupons());
                    setCouponsLoaded(true);
                  }
                  setCouponForm({ code: '', type: 'percent', value: 10, is_active: true, min_order: 0, max_uses: null });
                  setEditingCoupon(null);
                  setCouponModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700"
              >
                <Plus className="h-4 w-4" /> Novo Cupom
              </button>
            </div>

            {!couponsLoaded ? (
              <div className="flex flex-col items-center gap-3 py-12 text-neutral-500">
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const { db } = await import('../supabaseClient');
                      setCoupons(await db.getCoupons());
                      setCouponsLoaded(true);
                    } catch (e) {
                      openInfoDialog('Erro', 'Não foi possível carregar os cupons.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
                >
                  <RefreshCw className="h-4 w-4" /> Carregar Cupons
                </button>
              </div>
            ) : coupons.length === 0 ? (
              <div className="py-12 text-center text-neutral-500">
                <p>Nenhum cupom cadastrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {coupons.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">{c.code}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${c.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
                          {c.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {c.type === 'percent' ? `${c.value}% de desconto` : `R$ ${c.value.toFixed(2)} de desconto`}
                        {c.min_order > 0 ? ` · Mínimo R$ ${c.min_order.toFixed(2)}` : ''}
                        {c.max_uses ? ` · Limite: ${c.used_count}/${c.max_uses} usos` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const { db } = await import('../supabaseClient');
                          await db.saveCoupon({ ...c, is_active: !c.is_active });
                          setCoupons((prev) => prev.map((x) => x.id === c.id ? { ...x, is_active: !c.is_active } : x));
                        }}
                        className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:text-white"
                        title={c.is_active ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setCouponForm({ ...c });
                          setEditingCoupon(c);
                          setCouponModalOpen(true);
                        }}
                        className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:text-white"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          openConfirmDialog('Excluir cupom', `Deseja excluir o cupom "${c.code}"?`, async () => {
                            const { db } = await import('../supabaseClient');
                            await db.deleteCoupon(c.id);
                            setCoupons((prev) => prev.filter((x) => x.id !== c.id));
                          });
                        }}
                        className="rounded-lg border border-red-900/40 p-2 text-red-400 hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Coupon form modal */}
            {couponModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white">{editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}</h4>
                    <button onClick={() => setCouponModalOpen(false)} className="text-neutral-400 hover:text-white"><X className="h-5 w-5" /></button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-neutral-400">Código *</label>
                      <input
                        type="text"
                        value={couponForm.code}
                        onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                        placeholder="EX: PROMO10"
                        className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 font-mono text-white outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-neutral-400">Tipo</label>
                        <select
                          value={couponForm.type}
                          onChange={(e) => setCouponForm((p) => ({ ...p, type: e.target.value as Coupon['type'] }))}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-white outline-none focus:border-orange-500"
                        >
                          <option value="percent">Porcentagem (%)</option>
                          <option value="fixed">Valor fixo (R$)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-neutral-400">Desconto {couponForm.type === 'percent' ? '(%)' : '(R$)'}</label>
                        <input
                          type="number"
                          min={0}
                          step={couponForm.type === 'percent' ? 1 : 0.5}
                          value={couponForm.value ?? ''}
                          onChange={(e) => setCouponForm((p) => ({ ...p, value: Number(e.target.value) }))}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-white outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-neutral-400">Pedido mínimo (R$)</label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={couponForm.min_order ?? ''}
                          onChange={(e) => setCouponForm((p) => ({ ...p, min_order: Number(e.target.value) || 0 }))}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-white outline-none focus:border-orange-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-neutral-400">Máx. usos</label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={couponForm.max_uses ?? ''}
                          onChange={(e) => setCouponForm((p) => ({ ...p, max_uses: Number(e.target.value) || null }))}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-white outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="coupon-active"
                        type="checkbox"
                        checked={couponForm.is_active ?? true}
                        onChange={(e) => setCouponForm((p) => ({ ...p, is_active: e.target.checked }))}
                        className="accent-orange-500"
                      />
                      <label htmlFor="coupon-active" className="text-neutral-300">Ativo</label>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setCouponModalOpen(false)}
                      className="flex-1 rounded-xl border border-neutral-800 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        if (!couponForm.code.trim()) return;
                        setIsLoading(true);
                        try {
                          const { db } = await import('../supabaseClient');
                          await db.saveCoupon(couponForm as Coupon);
                          const fresh = await db.getCoupons();
                          setCoupons(fresh);
                          setCouponModalOpen(false);
                        } catch (e) {
                          openInfoDialog('Erro', 'Não foi possível salvar o cupom.');
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      className="flex-[2] rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white hover:bg-orange-700"
                    >
                      {editingCoupon ? 'Salvar alterações' : 'Criar Cupom'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: SUPABASE SETUP INTEGRATION CONSOLE */}
        {false && activeTab === 'supabase' && (
          <div className="space-y-6">
            <div className="border-b border-neutral-800 pb-4">
              <h3 className="text-xl font-bold">Instalação e Conexão de Banco Real (Supabase)</h3>
              <p className="text-xs text-neutral-400">Instruções para migrar sua persistência localStorage para produção em nuvem</p>
            </div>

            {/* Instruction cards */}
            <div className="space-y-4 text-xs text-neutral-300 leading-relaxed bg-neutral-950/80 p-5 rounded-2xl border border-neutral-850">
              <h4 className="text-xs font-extrabold uppercase text-orange-400 tracking-wider">Como Ligar Seu Supabase?</h4>
              
              <ol className="list-decimal list-inside space-y-2 text-neutral-400">
                <li>Acesse o seu console em <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-orange-400 underline">supabase.com</a> e crie um novo projeto gratuito.</li>
                <li>Clique em <strong>SQL Editor</strong> e crie uma nova query.</li>
                <li>Copie o script SQL abaixo clicando no botão ao lado direito e execute no painel. Ele criará as tabelas, relacionamentos e as <strong>regras de segurança RLS</strong> perfeitamente.</li>
                <li>Vá em <strong>Project Settings &gt; API</strong> no Supabase e copie suas chaves: <code>Anon public key</code> e <code>Project URL</code>.</li>
                <li>Abra o menu de Configurações no AI Studio Build e adicione as duas variáveis correspondentes:
                  <ul className="list-disc list-inside pl-4 mt-1 font-mono text-[11px] text-amber-500">
                    <li>VITE_SUPABASE_URL</li>
                    <li>VITE_SUPABASE_ANON_KEY</li>
                  </ul>
                </li>
              </ol>
            </div>

            {/* SQL window display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Script de Migração SQL</span>
                <button
                  id="copy-sql-code-btn"
                  onClick={handleCopySQL}
                  className="flex items-center gap-1.5 px-3 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-805 text-[11px] text-orange-400 rounded-lg font-bold transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{sqlCopied ? "Copiado!" : "Copiar Código SQL"}</span>
                </button>
              </div>

              <pre className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl text-[10px] font-mono text-neutral-450 h-56 overflow-auto select-all leading-snug">
                {SUPABASE_SETUP_SQL}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Users RLS Fix</span>
                <button
                  type="button"
                  onClick={handleCopyUsersFixSQL}
                  className="flex items-center gap-1.5 px-3 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-805 text-[11px] text-orange-400 rounded-lg font-bold transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{usersFixSqlCopied ? 'Copiado!' : 'Copiar SQL de Reparo'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-red-800/60 bg-red-950/20 p-4 text-xs text-red-200">
                Use este SQL quando aparecer o erro <strong>infinite recursion detected in policy for relation "users"</strong>. Ele recria a funcao
                <code className="mx-1">public.is_admin_user()</code>
                sem consultar a propria tabela
                <code className="mx-1">users</code>
                e reinstala as policies seguras.
              </div>

              <pre className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl text-[10px] font-mono text-neutral-450 h-44 overflow-auto select-all leading-snug">
                {SUPABASE_FIX_USERS_RLS_SQL}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Realtime + Seq Code (Migração)</span>
                <button
                  type="button"
                  onClick={handleCopyRealtimeSQL}
                  className="flex items-center gap-1.5 px-3 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-805 text-[11px] text-orange-400 rounded-lg font-bold transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{realtimeSqlCopied ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-blue-800/60 bg-blue-950/20 p-4 text-xs text-blue-200">
                Execute este SQL para habilitar <strong>atualizações em tempo real</strong> de pedidos e fazer o <strong>seq_code ser gerado pelo banco</strong> (sem risco de colisão). Rode uma única vez após o setup inicial.
              </div>

              <pre className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl text-[10px] font-mono text-neutral-450 h-44 overflow-auto select-all leading-snug">
                {SUPABASE_REALTIME_SQL}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Script de Admin Unico</span>
                <button
                  id="copy-admin-sql-code-btn"
                  onClick={handleCopyAdminSQL}
                  className="flex items-center gap-1.5 px-3 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-805 text-[11px] text-orange-400 rounded-lg font-bold transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{adminSqlCopied ? 'Copiado!' : 'Copiar SQL Admin'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 text-xs text-amber-200">
                Execute este SQL depois do setup para garantir que somente <strong>{ADMIN_EMAILS.join(', ')}</strong> tenham acesso ao painel admin.
              </div>

              <pre className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl text-[10px] font-mono text-neutral-450 h-36 overflow-auto select-all leading-snug">
                {SUPABASE_PROMOTE_ADMIN_SQL}
              </pre>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
