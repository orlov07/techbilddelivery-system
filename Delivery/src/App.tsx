/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  UtensilsCrossed,
  UserCheck,
  X,
  Package,
  Receipt,
  CreditCard,
  Coins,
  HelpCircle,
  Star,
  Bell,
  BellOff,
  Copy,
  Check,
  Shield,
  MapPin,
  Volume2,
  VolumeX,
  RotateCcw,
  Headphones,
  Plus,
  Trash2,
  Zap,
  Banknote,
} from 'lucide-react';
import { normalizeEmail, supabase } from './supabaseClient';
import { Product, Category, Motoboy, Order, OrderItem, AppSettings } from './types';
import type { CartItem } from './contexts/CartContext';
import PageSkeleton from './components/PageSkeleton';
import BottomNav from './components/BottomNav';
import { useAsyncAction } from './hooks/useAsyncAction';
import AppHeader, { type DropdownMenuAction } from './components/AppHeader';
import ActionDialog from './components/ActionDialog';
import { pushNotification, requestNotificationPermission, notificationPermission } from './utils/notifications';
import { playNewOrderSound } from './utils/sound';
import { useAuth } from './contexts/AuthContext';
import { useCart } from './contexts/CartContext';
import { useStore } from './contexts/StoreContext';
import { useCEP } from './hooks/useCEP';
import { useModalA11y } from './hooks/useModalA11y';
import OrderTimeline from './components/OrderTimeline';
import { getSavedAddresses, removeSavedAddress, saveAddress } from './utils/savedAddresses';

const ORDER_STATUS: Record<Order['status'], { label: string; cls: string }> = {
  pendente:   { label: 'Pendente',    cls: 'bg-yellow-500/20 text-yellow-400' },
  aceito:     { label: 'Aceito',      cls: 'bg-blue-500/20 text-blue-400' },
  recusado:   { label: 'Recusado',    cls: 'bg-red-500/20 text-red-400' },
  preparando: { label: 'Preparando',  cls: 'bg-orange-500/20 text-orange-400' },
  enviando:   { label: 'Em entrega',  cls: 'bg-purple-500/20 text-purple-400' },
  entregue:   { label: 'Entregue',    cls: 'bg-green-500/20 text-green-400' },
  cancelado:  { label: 'Cancelado',   cls: 'bg-red-500/20 text-red-400' },
};

const FAQ_ITEMS = [
  { q: 'Como faço um pedido?',                     a: 'Navegue pelo cardápio, adicione os itens ao carrinho e clique em "Meu Carrinho" para finalizar informando seus dados de entrega.' },
  { q: 'Quais formas de pagamento são aceitas?',    a: 'Aceitamos PIX (automático), dinheiro (com troco), cartão de crédito via checkout online e cartão de débito na entrega.' },
  { q: 'Qual o tempo estimado de entrega?',         a: 'O tempo estimado aparece no cabeçalho do app. Pode variar conforme localização e volume de pedidos.' },
  { q: 'Posso retirar meu pedido no local?',        a: 'Sim! Selecione "Retirada no balcão" ao finalizar o pedido — sem taxa de entrega.' },
  { q: 'Como cancelo ou altero um pedido?',         a: 'Entre em contato pelo Suporte (WhatsApp) imediatamente após fazer o pedido. Pedidos em preparo não podem ser alterados.' },
  { q: 'Como acompanho o status do meu pedido?',   a: 'Acesse "Meus pedidos" no menu do seu perfil para ver o status em tempo real.' },
];

const PAYMENT_METHODS = [
  { key: 'pix',             label: 'PIX',               description: 'Pagamento instantâneo — aprovado automaticamente',  emoji: '⚡' },
  { key: 'dinheiro',        label: 'Dinheiro',           description: 'Espécie na entrega — informe o troco necessário',   emoji: '💵' },
  { key: 'cartao_credito',  label: 'Cartão de Crédito',  description: 'Checkout online seguro',                           emoji: '💳' },
  { key: 'cartao_debito',   label: 'Cartão de Débito',   description: 'Maquininha na entrega',                            emoji: '💳' },
];

const ClientMenu   = lazy(() => import('./components/ClientMenu'));
const Cart         = lazy(() => import('./components/Cart'));
const AdminPanel   = lazy(() => import('./components/AdminPanel'));
const MotoboyPanel = lazy(() => import('./components/MotoboyPanel'));

export default function App() {
  // ── Contexts ──────────────────────────────────────────────────────────────
  const auth     = useAuth();
  const cartCtx  = useCart();
  const store    = useStore();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activePersona, setActivePersona] = useState<'cliente' | 'admin' | 'motoboy'>('cliente');
  const [isCartOpen, setIsCartOpen]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName]           = useState('');
  const [profilePhone, setProfilePhone]         = useState('');
  const [profileAddress, setProfileAddress]     = useState('');
  const [savedAddresses, setSavedAddresses]     = useState<string[]>(() => getSavedAddresses());
  const [profileTab, setProfileTab]             = useState<'dados' | 'endereco' | 'preferencias'>('dados');

  const [defaultPayment, setDefaultPayment] = useState(() => localStorage.getItem('tb_default_payment') ?? '');
  const [notifOrders, setNotifOrders]       = useState(() => localStorage.getItem('tb_notif_orders') !== 'false');
  const [notifPromos, setNotifPromos]       = useState(() => localStorage.getItem('tb_notif_promos') !== 'false');
  const [soundMuted,  setSoundMuted]        = useState(() => localStorage.getItem('tb_sound_muted') === 'true');
  const [pixCopied, setPixCopied]           = useState(false);

  const [ordersModalOpen,   setOrdersModalOpen]   = useState(false);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [cashbackModalOpen, setCashbackModalOpen] = useState(false);
  const [faqModalOpen,      setFaqModalOpen]      = useState(false);
  const [rateModalOpen,     setRateModalOpen]     = useState(false);
  const [ratingValue,       setRatingValue]       = useState(0);
  const [ratingComment,     setRatingComment]     = useState('');
  const [couponCode,        setCouponCode]        = useState('');
  const [expandedOrderId,   setExpandedOrderId]   = useState<string | null>(null);
  const [reorderingId,      setReorderingId]      = useState<string | null>(null);
  const [cashbackBalance,   setCashbackBalance]   = useState(0);

  const [toastMessage,              setToastMessage]              = useState('');
  const [closedAlertOpen,           setClosedAlertOpen]           = useState(false);
  const [isLoggingInGoogle,         setIsLoggingInGoogle]         = useState(false);
  const [googleLoginSuccessMessage, setGoogleLoginSuccessMessage] = useState('');

  // CEP auto-fill for address tab
  const { cep, setCep, lookupCEP, formatAddress, isLoading: cepLoading, error: cepError, setError: setCepError } = useCEP();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const searchInputRef   = useRef<HTMLInputElement | null>(null);
  const loginAction      = useAsyncAction();
  const toastRef         = useRef<(msg: string) => void>(() => {});
  const isAdminUserRef   = useRef(false);
  const currentUserRef   = useRef(auth.currentUser);
  const notifOrdersRef   = useRef(notifOrders);
  // Track previous is_open to detect store closing
  const prevIsOpenRef    = useRef<boolean | undefined>(undefined);
  const soundMutedRef    = useRef(soundMuted);

  // ── Computed ──────────────────────────────────────────────────────────────
  const isAdminUser = auth.isAdminUser;
  const isMotoboyUser = useMemo(() => {
    if (!auth.currentUser?.email) return false;
    const currentEmail = normalizeEmail(auth.currentUser.email);
    return store.motoboys.some((motoboy) => motoboy.is_active && normalizeEmail(motoboy.email) === currentEmail);
  }, [auth.currentUser?.email, store.motoboys]);

  const activeOrdersCount = useMemo(() => {
    if (!auth.currentUser) return 0;
    const active: Order['status'][] = ['pendente', 'aceito', 'preparando', 'enviando'];
    return store.orders.filter((o) => o.user_id === auth.currentUser!.id && active.includes(o.status)).length;
  }, [store.orders, auth.currentUser]);

  const userOrders = useMemo(() => {
    if (!auth.currentUser) return [];
    return [...store.orders]
      .filter((o) => o.user_id === auth.currentUser!.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [store.orders, auth.currentUser]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const isAnyModalOpen =
    profileModalOpen || ordersModalOpen || paymentsModalOpen ||
    cashbackModalOpen || faqModalOpen || rateModalOpen || isCartOpen;

  // ── Modal accessibility ───────────────────────────────────────────────────
  const { dialogProps: profileDialogProps }   = useModalA11y(profileModalOpen,   () => setProfileModalOpen(false),   'modal-title-profile');
  const { dialogProps: ordersDialogProps }    = useModalA11y(ordersModalOpen,    () => setOrdersModalOpen(false),    'modal-title-orders');
  const { dialogProps: paymentsDialogProps }  = useModalA11y(paymentsModalOpen,  () => setPaymentsModalOpen(false),  'modal-title-payments');
  const { dialogProps: cashbackDialogProps }  = useModalA11y(cashbackModalOpen,  () => setCashbackModalOpen(false),  'modal-title-cashback');
  const { dialogProps: faqDialogProps }       = useModalA11y(faqModalOpen,       () => setFaqModalOpen(false),       'modal-title-faq');
  const { dialogProps: rateDialogProps }      = useModalA11y(rateModalOpen,      () => setRateModalOpen(false),      'modal-title-rate');

  // ── Toast ─────────────────────────────────────────────────────────────────
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // ── Ref sync ──────────────────────────────────────────────────────────────
  useEffect(() => { toastRef.current = triggerToast; });
  useEffect(() => { isAdminUserRef.current = isAdminUser; },        [isAdminUser]);
  useEffect(() => { currentUserRef.current = auth.currentUser; },   [auth.currentUser]);
  useEffect(() => { notifOrdersRef.current = notifOrders; },        [notifOrders]);
  useEffect(() => { soundMutedRef.current  = soundMuted;  },         [soundMuted]);
  useEffect(() => { prevIsOpenRef.current  = store.settings?.is_open; }, [store.settings?.is_open]);

  // ── Sync profile form when user loads ─────────────────────────────────────
  useEffect(() => {
    if (auth.currentUser) {
      setProfileName(auth.currentUser.nome);
      setProfilePhone(auth.currentUser.telefone || '');
      setProfileAddress(auth.currentUser.endereco || '');
    }
  }, [auth.currentUser]);

  // ── Lazy load orders + motoboys after auth resolves ───────────────────────
  useEffect(() => {
    if (auth.currentUser?.id) {
      store.loadAdminData();
      store.getCashbackBalance(auth.currentUser.id).then(setCashbackBalance).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.currentUser?.id]);

  // ── Body overflow ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isAnyModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isAnyModalOpen]);

  // ── Settings realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('app-settings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.1' },
        (payload) => {
          const next = payload.new as AppSettings | undefined;
          if (!next) return;
          if (prevIsOpenRef.current === true && !next.is_open) setClosedAlertOpen(true);
          prevIsOpenRef.current = next.is_open;
          store.setSettings(next);
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Orders realtime ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as Order;
        store.addOrder(newOrder);
        if (isAdminUserRef.current) {
          toastRef.current(`🔔 Novo pedido ${newOrder.seq_code ?? ''} recebido!`);
          if (!soundMutedRef.current) playNewOrderSound();
          if (notifOrdersRef.current) {
            pushNotification('🔔 Novo Pedido!', `${newOrder.seq_code ?? 'Pedido'} de ${newOrder.customer_name}`, `order-new-${newOrder.id}`);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const updated = payload.new as Order;
        store.patchOrder(updated);

        // Credit cashback when order is delivered
        if (updated.status === 'entregue' && updated.user_id) {
          const pct = (store.settings?.cashback_percent ?? 2) / 100;
          const cashbackAmount = Math.round(updated.subtotal * pct * 100) / 100;
          if (cashbackAmount > 0) {
            store.creditCashback(updated.user_id, updated.id, cashbackAmount).catch(console.error);
            // Refresh balance for the current user
            if (updated.user_id === currentUserRef.current?.id) {
              store.getCashbackBalance(updated.user_id).then(setCashbackBalance).catch(() => {});
            }
          }
        }

        if (!isAdminUserRef.current && notifOrdersRef.current && updated.user_id === currentUserRef.current?.id) {
          const statusMsg: Partial<Record<Order['status'], string>> = {
            aceito:     'Seu pedido foi aceito! ✅',
            preparando: 'Seu pedido está sendo preparado 👨‍🍳',
            enviando:   'Seu pedido saiu para entrega! 🛵',
            entregue:   'Pedido entregue! Bom apetite! 🎉',
            recusado:   'Seu pedido foi recusado.',
            cancelado:  'Seu pedido foi cancelado.',
          };
          const body = statusMsg[updated.status];
          if (body) pushNotification('TechBild Delivery', body, `order-${updated.id}`);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persona guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (activePersona === 'admin' && !isAdminUser) {
      setActivePersona('cliente');
      return;
    }
    if (activePersona === 'motoboy' && !isMotoboyUser) {
      setActivePersona('cliente');
    }
  }, [activePersona, isAdminUser, isMotoboyUser]);

  // ── Document title ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isCartOpen) { document.title = 'Finalizar Pedido - TechBild Delivery'; return; }
    document.title =
      activePersona === 'admin'   ? 'TechBild Delivery - Painel Admin' :
      activePersona === 'motoboy' ? 'TechBild Delivery - Entregas'     :
                                    'TechBild Delivery - Inicio';
  }, [activePersona, isCartOpen]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleManualGoogleLogin = () => {
    loginAction.execute(async () => {
      setIsLoggingInGoogle(true);
      setGoogleLoginSuccessMessage('');
      try {
        await auth.signIn();
      } finally {
        setIsLoggingInGoogle(false);
      }
    }).catch(() => {});
  };

  const handleFocusSearch = () => {
    setActivePersona('cliente');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const handleTabChange = (tab: 'cliente' | 'admin' | 'motoboy') => {
    if (tab === 'admin' && !isAdminUser) {
      setActivePersona('cliente');
      return;
    }
    if (tab === 'motoboy' && !isMotoboyUser) {
      setActivePersona('cliente');
      return;
    }
    setActivePersona(tab);
  };

  const handleLogout = async () => {
    await auth.signOut();
    triggerToast('Sessão encerrada!');
  };

  const handleMenuAction = (action: DropdownMenuAction) => {
    switch (action) {
      case 'profile':    setProfileTab('dados');        setProfileModalOpen(true); break;
      case 'settings':   setProfileTab('preferencias'); setProfileModalOpen(true); break;
      case 'addresses':  setProfileTab('endereco');     setProfileModalOpen(true); break;
      case 'orders':     setOrdersModalOpen(true);   break;
      case 'payments':   setPaymentsModalOpen(true); break;
      case 'cashback':   setCashbackModalOpen(true); break;
      case 'faq':        setFaqModalOpen(true);      break;
      case 'rate':       setRateModalOpen(true);     break;
      case 'support':
        if (store.settings?.whatsapp) {
          window.open(`https://wa.me/${store.settings.whatsapp.replace(/\D/g, '')}`, '_blank');
        } else {
          triggerToast('Número de suporte não configurado.');
        }
        break;
    }
  };

  const handleAddToCart = (product: Product, quantity: number, notes?: string) => {
    cartCtx.addToCart(product, quantity, notes);
    triggerToast(`"${product.name}" adicionado ao carrinho!`);
  };

  const reorderFromHistory = async (orderId: string) => {
    setReorderingId(orderId);
    try {
      const items: OrderItem[] = await store.getOrderItems(orderId);
      if (!items.length) { triggerToast('Não foi possível carregar os itens deste pedido.'); return; }
      let added = 0;
      let skipped = 0;
      for (const item of items) {
        const product = store.products.find((p) => p.id === item.product_id);
        if (!product || !product.is_active || product.stock_quantity <= 0) { skipped++; continue; }
        cartCtx.addToCart(product, item.quantity);
        added++;
      }
      if (added > 0) {
        const msg = skipped > 0
          ? `${added} item(ns) adicionado(s). ${skipped} indisponível(is) foi(ram) ignorado(s).`
          : `${added} item(ns) adicionado(s) ao carrinho!`;
        triggerToast(msg);
        setOrdersModalOpen(false);
        setIsCartOpen(true);
      } else {
        triggerToast('Todos os itens deste pedido estão indisponíveis no momento.');
      }
    } catch {
      triggerToast('Erro ao recuperar os itens do pedido.');
    } finally {
      setReorderingId(null);
    }
  };

  const handleSubmitOrder = async (payload: { order: any; items: any[] }): Promise<Order | null> => {
    if (!store.settings?.is_open) {
      throw new Error(`O estabelecimento esta fechado no momento (${store.settings?.business_hours || 'consulte o horario da loja'}).`);
    }
    return store.createOrder(payload.order, payload.items);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    if (profileTab === 'endereco' && profileAddress.trim()) {
      setSavedAddresses(saveAddress(profileAddress));
    }
    await auth.updateProfile(profileName, profilePhone, profileAddress);
    triggerToast('Seu perfil foi atualizado no banco!');
    setProfileModalOpen(false);
  };

  const handleSaveCurrentAddress = () => {
    if (!profileAddress.trim()) {
      triggerToast('Preencha um endereco antes de salvar.');
      return;
    }

    setSavedAddresses(saveAddress(profileAddress));
    triggerToast('Endereco salvo nos seus favoritos.');
  };

  const handleRemoveSavedAddress = (address: string) => {
    setSavedAddresses(removeSavedAddress(address));
    triggerToast('Endereco removido da lista.');
  };

  const handleSaveProduct     = async (prod: Product)    => { await store.saveProduct(prod);      triggerToast('Produto gravado com sucesso!'); };
  const handleDeleteProduct   = async (id: string)       => { await store.deleteProduct(id);      triggerToast('Produto excluído!'); };
  const handleSaveCategory    = async (cat: Category)    => { await store.saveCategory(cat);      triggerToast('Categoria salva!'); };
  const handleDeleteCategory  = async (id: string)       => { await store.deleteCategory(id);     triggerToast('Categoria excluída!'); };
  const handleSaveMotoboy     = async (moto: Motoboy)    => { await store.saveMotoboy(moto);      triggerToast('Cadastro de Motoboy salvo!'); };
  const handleDeleteMotoboy   = async (id: string)       => { await store.deleteMotoboy(id);      triggerToast('Cadastro de Motoboy removido!'); };
  const handleSaveSettings    = async (s: AppSettings)   => { await store.saveSettings(s);        triggerToast('Configurações armazenadas!'); };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    await store.updateOrderStatus(orderId, status);
    triggerToast(`Status do pedido alterado para "${status}"`);
  };

  const handleUpdateOrderPaymentStatus = async (orderId: string, status: Order['payment_status']) => {
    await store.updateOrderPaymentStatus(orderId, status);
    triggerToast(`Status do pagamento alterado para "${status}"`);
  };

  const handleAssignMotoboy = async (orderId: string, motoboyId: string | undefined) => {
    await store.assignMotoboy(orderId, motoboyId);
    triggerToast(motoboyId ? 'Motoboy escalado!' : 'Atribuição removida');
  };

  const bottomNavActiveItem: 'home' | 'search' | 'orders' | 'profile' =
    isCartOpen ? 'orders' : profileModalOpen || !!auth.currentUser ? 'profile' : searchQuery ? 'search' : 'home';

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div id="application-view-canvas" className="app-shell relative min-h-screen w-full max-w-full overflow-x-hidden bg-neutral-950 font-sans text-neutral-200 antialiased selection:bg-orange-600 selection:text-white">
      <ActionDialog
        open={closedAlertOpen}
        title="Estabelecimento fechado"
        message={`O estabelecimento acabou de ser marcado como fechado${store.settings?.business_hours ? ` (${store.settings.business_hours})` : ''}. O cardápio continua visível, mas novos pedidos foram bloqueados imediatamente.`}
        confirmLabel="Entendi"
        showCancel={false}
        tone="danger"
        onCancel={() => setClosedAlertOpen(false)}
        onConfirm={() => setClosedAlertOpen(false)}
      />

      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-80 w-80 rounded-full bg-orange-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />

      {isLoggingInGoogle && (
        <div id="google-login-overlay" className="fixed inset-0 z-50 flex flex-col items-center justify-center space-y-4 bg-black/95 text-center backdrop-blur-md">
          <UtensilsCrossed className="h-12 w-12 animate-spin text-orange-500" />
          <h2 className="text-xl font-bold tracking-tight text-white">Login com o Google</h2>
          <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
            Conectando a sua conta segura da Google para sincronização cadastral no Supabase. Aguarde...
          </p>
        </div>
      )}

      {toastMessage && (
        <div id="toast-notify" className="fixed bottom-24 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl animate-fade-in md:bottom-6">
          <div className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-orange-950 text-[11px] font-bold text-orange-400">i</div>
          <span className="text-xs font-semibold text-neutral-100">{toastMessage}</span>
        </div>
      )}

      {googleLoginSuccessMessage && (
        <div id="google-banner-notify" className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-emerald-900 bg-emerald-950/70 p-4 text-xs font-semibold text-emerald-200 shadow-md backdrop-blur-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{googleLoginSuccessMessage} Usuário <strong>{auth.currentUser?.nome}</strong> registrado no banco de clientes.</span>
          </div>
          <button onClick={() => setGoogleLoginSuccessMessage('')} className="rounded bg-emerald-900/30 px-2 text-base font-bold text-emerald-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {store.appMessage && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 md:px-8">
          <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
            {store.appMessage}
          </div>
        </div>
      )}

      {store.settings && !store.settings.is_open && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 md:px-8">
          <div className="rounded-2xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
            <strong className="text-red-100">Estabelecimento fechado.</strong> O cardápio permanece disponível, mas novos pedidos estão bloqueados neste instante.
          </div>
        </div>
      )}

      <AppHeader
        activeOrdersCount={activeOrdersCount}
        activeTab={activePersona}
        cartCount={cartCtx.cartItemsCount}
        currentUser={auth.currentUser}
        isAdminUser={isAdminUser}
        isMotoboyUser={isMotoboyUser}
        isLoggingInGoogle={isLoggingInGoogle}
        loginError={loginAction.error}
        loginStatus={loginAction.status}
        onCartClick={() => setIsCartOpen(true)}
        onLogin={handleManualGoogleLogin}
        onLogout={handleLogout}
        onMenuAction={handleMenuAction}
        onSearchChange={setSearchQuery}
        onTabChange={handleTabChange}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        settings={store.settings}
      />

      <main id="app-main-viewport" className="mx-auto mt-4 w-full max-w-7xl px-4 pb-24 md:px-8 md:pb-8">
        {store.settings && (
          <Suspense fallback={<PageSkeleton />}>
            <>
              {activePersona === 'cliente' && (
                <ClientMenu
                  products={store.products}
                  categories={store.categories.map((c) => c.name)}
                  settings={store.settings}
                  addToCart={handleAddToCart}
                  searchQuery={deferredSearchQuery}
                />
              )}

              {activePersona === 'admin' && isAdminUser && (
                <>
                <div className="mb-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundMuted;
                      setSoundMuted(next);
                      localStorage.setItem('tb_sound_muted', String(next));
                    }}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
                      soundMuted
                        ? 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-white'
                        : 'border-orange-800/50 bg-orange-950/30 text-orange-400 hover:bg-orange-950/50'
                    }`}
                    title={soundMuted ? 'Ativar alerta sonoro' : 'Silenciar alerta sonoro'}
                  >
                    {soundMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    {soundMuted ? 'Som silenciado' : 'Som ativo'}
                  </button>
                </div>
                <AdminPanel
                  products={store.products}
                  categories={store.categories}
                  motoboys={store.motoboys}
                  orders={store.orders}
                  orderItems={store.orderItems}
                  settings={store.settings}
                  isMockMode={!store.settings}
                  onRefreshData={store.loadAllData}
                  onSaveProduct={handleSaveProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onSaveCategory={handleSaveCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onSaveMotoboy={handleSaveMotoboy}
                  onDeleteMotoboy={handleDeleteMotoboy}
                  onSaveSettings={handleSaveSettings}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onUpdateOrderPaymentStatus={handleUpdateOrderPaymentStatus}
                  onAssignMotoboy={handleAssignMotoboy}
                  onResetDatabase={() => { throw new Error('Reset de banco local removido. Use o banco real.'); }}
                />
                </>
              )}

              {activePersona === 'motoboy' && isMotoboyUser && (
                <MotoboyPanel
                  currentUser={auth.currentUser}
                  orders={store.orders}
                  motoboys={store.motoboys}
                  settings={store.settings}
                  onAssignMotoboy={handleAssignMotoboy}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onUpdateOrderPaymentStatus={handleUpdateOrderPaymentStatus}
                  onRefreshData={store.loadAllData}
                />
              )}
            </>
          </Suspense>
        )}
      </main>

      {isCartOpen && store.settings && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-black/70" />}>
          <Cart
            cart={cartCtx.cart}
            settings={store.settings}
            user={auth.currentUser}
            removeFromCart={cartCtx.removeFromCart}
            updateCartQuantity={cartCtx.updateCartQuantity}
            clearCart={cartCtx.clearCart}
            onClose={() => setIsCartOpen(false)}
            onSubmitOrder={handleSubmitOrder}
            onCreateCreditCardCheckout={store.createCreditCardCheckout}
            onValidateCoupon={auth.currentUser ? store.validateCoupon : undefined}
            cashbackBalance={cashbackBalance}
            onRecordCouponUse={auth.currentUser
              ? (couponId, orderId) => store.recordCouponUse(couponId, auth.currentUser!.id, orderId)
              : undefined}
            onDebitCashback={auth.currentUser
              ? (orderId, amount) => store.debitCashback(auth.currentUser!.id, orderId, amount)
              : undefined}
          />
        </Suspense>
      )}

      {/* ── Perfil ── */}
      {profileModalOpen && auth.currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div {...profileDialogProps} className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">

            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                  {auth.currentUser.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p id="modal-title-profile" className="text-sm font-bold leading-tight text-white">{auth.currentUser.nome}</p>
                  <span className={`text-[10px] font-semibold uppercase ${
                    auth.currentUser.tipo_usuario === 'admin'   ? 'text-orange-400' :
                    auth.currentUser.tipo_usuario === 'motoboy' ? 'text-blue-400'   : 'text-neutral-400'
                  }`}>{auth.currentUser.tipo_usuario}</span>
                </div>
              </div>
              <button type="button" onClick={() => setProfileModalOpen(false)} className="text-neutral-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-neutral-800">
              {(['dados', 'endereco', 'preferencias'] as const).map((tab) => {
                const labels = { dados: 'Perfil', endereco: 'Endereço', preferencias: 'Preferências' };
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setProfileTab(tab)}
                    className={`flex-1 py-2.5 text-[11px] font-semibold transition ${
                      profileTab === tab
                        ? 'border-b-2 border-orange-500 text-orange-400'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSaveProfile} className="p-5">

              {/* ── Tab Perfil ── */}
              {profileTab === 'dados' && (
                <div className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-neutral-400">Nome Completo</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-white outline-none focus:border-orange-700"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-neutral-400">E-mail</label>
                    <input type="email" value={auth.currentUser.email} disabled
                      className="w-full cursor-not-allowed rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-neutral-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-neutral-400">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-white outline-none focus:border-orange-700"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                    <Shield className="h-4 w-4 shrink-0 text-neutral-500" />
                    <div>
                      <p className="text-[10px] text-neutral-400">Membro desde</p>
                      <p className="font-medium text-neutral-200">
                        {new Date(auth.currentUser.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab Endereço ── */}
              {profileTab === 'endereco' && (
                <div className="space-y-3.5 text-xs">
                  {/* CEP auto-fill */}
                  <div className="space-y-1">
                    <label className="text-neutral-400">CEP</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cep}
                        onChange={async (e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                          const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
                          setCep(formatted);
                          setCepError('');
                          if (digits.length === 8) {
                            const data = await lookupCEP(digits);
                            if (data) setProfileAddress(formatAddress(data));
                          }
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-white outline-none focus:border-orange-700"
                      />
                      {cepLoading && (
                        <div className="flex items-center pr-1">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                        </div>
                      )}
                    </div>
                    {cepError && <p className="text-[10px] text-red-400">{cepError}</p>}
                    {!cepError && cep.replace(/\D/g, '').length === 8 && !cepLoading && (
                      <p className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <MapPin className="h-3 w-3" /> Endereço preenchido automaticamente
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-neutral-400">Endereço completo</label>
                    <textarea
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      placeholder="Rua, número, complemento, bairro, cidade..."
                      className="h-28 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-white outline-none focus:border-orange-700"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveCurrentAddress}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-700/40 bg-orange-950/20 py-2.5 font-semibold text-orange-300 transition hover:border-orange-600/50 hover:bg-orange-950/30"
                  >
                    <Plus className="h-4 w-4" />
                    Salvar nos meus enderecos
                  </button>
                  {savedAddresses.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Enderecos salvos</p>
                        <span className="text-[10px] text-neutral-500">{savedAddresses.length}/5</span>
                      </div>
                      <div className="space-y-2">
                        {savedAddresses.map((savedAddress, index) => (
                          <div key={`${savedAddress}-${index}`} className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
                            <p className="text-[11px] leading-relaxed text-neutral-300">{savedAddress}</p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setProfileAddress(savedAddress)}
                                className="flex-1 rounded-lg bg-neutral-800 py-2 font-medium text-neutral-200 transition hover:bg-neutral-700"
                              >
                                Usar este endereco
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSavedAddress(savedAddress)}
                                className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 text-red-300 transition hover:bg-red-950/30"
                                aria-label="Remover endereco salvo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-[10px] leading-relaxed text-neutral-500">
                    📍 Este endereço será pré-preenchido automaticamente na próxima vez que você fizer um pedido de entrega.
                  </p>
                </div>
              )}

              {/* ── Tab Preferências ── */}
              {profileTab === 'preferencias' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <p className="mb-2 font-semibold text-neutral-300">Notificações</p>
                    <div className="space-y-2">
                      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3 hover:border-neutral-700">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-orange-400" />
                          <div>
                            <p className="font-medium text-white">Atualizações de pedido</p>
                            <p className="text-[10px] text-neutral-500">Status, confirmações, entregas</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifOrders}
                          onChange={async (e) => {
                            const enabled = e.target.checked;
                            if (enabled) {
                              const perm = notificationPermission();
                              if (perm === 'unsupported') { triggerToast('Notificações não são suportadas neste navegador.'); return; }
                              if (perm === 'denied')      { triggerToast('Permissão bloqueada. Habilite nas configurações do navegador.'); return; }
                              const granted = await requestNotificationPermission();
                              if (!granted) { triggerToast('Permissão de notificação não concedida.'); return; }
                            }
                            setNotifOrders(enabled);
                            localStorage.setItem('tb_notif_orders', String(enabled));
                            if (enabled) triggerToast('Notificações de pedidos ativadas!');
                          }}
                          className="h-4 w-4 accent-orange-500"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3 hover:border-neutral-700">
                        <div className="flex items-center gap-2">
                          <BellOff className="h-4 w-4 text-neutral-400" />
                          <div>
                            <p className="font-medium text-white">Promoções e novidades</p>
                            <p className="text-[10px] text-neutral-500">Ofertas especiais e cupons</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifPromos}
                          onChange={async (e) => {
                            const enabled = e.target.checked;
                            if (enabled) {
                              const perm = notificationPermission();
                              if (perm === 'unsupported' || perm === 'denied') { triggerToast('Permissão de notificação não concedida. Verifique as configurações do navegador.'); return; }
                              const granted = await requestNotificationPermission();
                              if (!granted) return;
                            }
                            setNotifPromos(enabled);
                            localStorage.setItem('tb_notif_promos', String(enabled));
                          }}
                          className="h-4 w-4 accent-orange-500"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 font-semibold text-neutral-300">Pagamento Padrão</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => {
                            setDefaultPayment(m.key);
                            localStorage.setItem('tb_default_payment', m.key);
                            triggerToast(`${m.label} definido como padrão`);
                          }}
                          className={`rounded-xl border p-3 text-left transition ${
                            defaultPayment === m.key
                              ? 'border-orange-600 bg-orange-950/30 text-orange-300'
                              : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                          }`}
                        >
                          <span className="text-xl">{m.emoji}</span>
                          <p className="mt-1 text-[11px] font-medium">{m.label}</p>
                          {defaultPayment === m.key && <p className="text-[9px] text-orange-400">✓ Padrão</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {store.settings?.whatsapp && (
                <button
                  type="button"
                  onClick={() => handleMenuAction('support')}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-green-700/40 bg-green-950/30 py-3 text-sm font-semibold text-green-300 transition hover:border-green-600/50 hover:bg-green-950/40"
                >
                  <Headphones className="h-4 w-4" />
                  Chamar no WhatsApp
                </button>
              )}

              {profileTab !== 'preferencias' ? (
                <div className="mt-4 flex gap-2 text-xs">
                  <button type="button" onClick={() => setProfileModalOpen(false)} className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 text-neutral-400 hover:bg-neutral-900">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 rounded-xl bg-orange-600 py-2.5 font-bold text-white hover:bg-orange-700">
                    Salvar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setProfileModalOpen(false)} className="mt-4 w-full rounded-xl bg-neutral-800 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700">
                  Fechar
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── Meus Pedidos ── */}
      {ordersModalOpen && auth.currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div {...ordersDialogProps} className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-orange-500" />
                <h3 id="modal-title-orders" className="text-sm font-bold uppercase tracking-widest text-white">Meus Pedidos</h3>
              </div>
              <button type="button" onClick={() => setOrdersModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {userOrders.length === 0 ? (
              <div className="py-10 text-center">
                <Package className="mx-auto mb-3 h-12 w-12 text-neutral-700" />
                <p className="text-sm text-neutral-400">Você ainda não realizou nenhum pedido.</p>
              </div>
            ) : (
              <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {userOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const isReordering = reorderingId === order.id;
                  return (
                    <div key={order.id} className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
                      {/* Header row — click to expand */}
                      <button
                        type="button"
                        className="flex w-full items-start justify-between p-4 text-left"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        <div>
                          <span className="text-xs font-bold text-white">{order.seq_code}</span>
                          <p className="mt-0.5 text-[10px] text-neutral-500">
                            {new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS[order.status].cls}`}>
                            {ORDER_STATUS[order.status].label}
                          </span>
                          <span className="text-[10px] text-neutral-600">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-2 text-[11px]">
                        <span className="capitalize text-neutral-400">{order.type}</span>
                        <span className="font-bold text-orange-400">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                      </div>

                      {/* Timeline — expanded view */}
                      {isExpanded && (
                        <div className="border-t border-neutral-800/60 px-4 pt-3 pb-2">
                          <OrderTimeline order={order} avgDeliveryTime={store.settings?.avg_delivery_time} />
                        </div>
                      )}

                      {/* Reorder button — always visible */}
                      <div className="border-t border-neutral-800/60 px-4 py-2">
                        <button
                          type="button"
                          disabled={isReordering}
                          onClick={() => reorderFromHistory(order.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600/10 py-1.5 text-[11px] font-semibold text-orange-400 hover:bg-orange-600/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isReordering
                            ? <><span className="inline-block h-3 w-3 animate-spin rounded-full border border-orange-400 border-t-transparent" /> Carregando...</>
                            : <><RotateCcw className="h-3 w-3" /> Pedir novamente</>
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button type="button" onClick={() => setOrdersModalOpen(false)} className="mt-4 w-full rounded-xl bg-neutral-800 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── Formas de Pagamento ── */}
      {paymentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div {...paymentsDialogProps} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-500" />
                <h3 id="modal-title-payments" className="text-sm font-bold uppercase tracking-widest text-white">Formas de Pagamento</h3>
              </div>
              <button type="button" onClick={() => setPaymentsModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-[10px] text-neutral-500">Clique em uma opção para defini-la como padrão nos seus pedidos.</p>

            <div className="mt-2 space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setDefaultPayment(m.key);
                    localStorage.setItem('tb_default_payment', m.key);
                    triggerToast(`${m.label} definido como padrão ✓`);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                    defaultPayment === m.key
                      ? 'border-orange-600/70 bg-orange-950/20'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      defaultPayment === m.key
                        ? 'border-orange-500/40 bg-orange-500/12 text-orange-300'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    {m.key === 'pix' ? (
                      <Zap className="h-4.5 w-4.5" />
                    ) : m.key === 'dinheiro' ? (
                      <Banknote className="h-4.5 w-4.5" />
                    ) : (
                      <CreditCard className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white">{m.label}</p>
                    <p className="text-[10px] text-neutral-500">{m.description}</p>
                  </div>
                  {defaultPayment === m.key ? (
                    <Check className="h-4 w-4 shrink-0 text-orange-400" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 rounded-full border border-neutral-700" />
                  )}
                </button>
              ))}
            </div>

            {store.settings?.pix_key && (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Chave PIX do estabelecimento</p>
                <p className="break-all font-mono text-xs text-orange-300">{store.settings.pix_key}</p>
                {store.settings.pix_code && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(store.settings!.pix_code).then(() => {
                        setPixCopied(true);
                        triggerToast('Código PIX copiado!');
                        setTimeout(() => setPixCopied(false), 3000);
                      });
                    }}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-800 py-2 text-[11px] font-medium text-neutral-300 hover:bg-neutral-700"
                  >
                    {pixCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {pixCopied ? 'Copiado!' : 'Copiar código PIX (copia e cola)'}
                  </button>
                )}
              </div>
            )}

            <button type="button" onClick={() => setPaymentsModalOpen(false)} className="mt-4 w-full rounded-xl bg-neutral-800 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── Cashback & Cupons ── */}
      {cashbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div {...cashbackDialogProps} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-orange-500" />
                <h3 id="modal-title-cashback" className="text-sm font-bold uppercase tracking-widest text-white">Cashback & Cupons</h3>
              </div>
              <button type="button" onClick={() => setCashbackModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-orange-900/30 bg-orange-950/20 p-4 text-center">
                <p className="text-3xl font-extrabold text-orange-400">
                  R$ {cashbackBalance.toFixed(2).replace('.', ',')}
                </p>
                <p className="mt-1 text-xs text-neutral-400">Saldo de cashback disponível</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-400">Tem um cupom de desconto?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Ex: TECHBILD10"
                    className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono text-white outline-none placeholder:text-neutral-600 focus:border-orange-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (couponCode.trim()) { triggerToast('Cupom inválido ou expirado.'); setCouponCode(''); }
                    }}
                    className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => setCashbackModalOpen(false)} className="mt-4 w-full rounded-xl bg-neutral-800 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── FAQ ── */}
      {faqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div {...faqDialogProps} className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-orange-500" />
                <h3 id="modal-title-faq" className="text-sm font-bold uppercase tracking-widest text-white">Perguntas Frequentes</h3>
              </div>
              <button type="button" onClick={() => setFaqModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {FAQ_ITEMS.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <p className="text-xs font-semibold text-orange-400">{item.q}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">{item.a}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setFaqModalOpen(false)} className="mt-4 w-full rounded-xl bg-neutral-800 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── Avaliar o App ── */}
      {rateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div {...rateDialogProps} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-orange-500" />
                <h3 id="modal-title-rate" className="text-sm font-bold uppercase tracking-widest text-white">Avaliar o App</h3>
              </div>
              <button type="button" onClick={() => setRateModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-center">
              <p className="text-sm text-neutral-300">O que você achou do TechBild Delivery?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setRatingValue(star)}>
                    <Star className={`h-9 w-9 transition-colors ${star <= ratingValue ? 'fill-orange-400 text-orange-400' : 'text-neutral-600 hover:text-orange-300'}`} />
                  </button>
                ))}
              </div>
              {ratingValue > 0 && (
                <p className="text-xs text-neutral-400">
                  {['', 'Muito ruim 😞', 'Ruim 😕', 'Regular 😐', 'Bom 😊', 'Excelente! 🤩'][ratingValue]}
                </p>
              )}
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Deixe um comentário (opcional)..."
                className="h-20 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-orange-700"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { setRateModalOpen(false); setRatingValue(0); setRatingComment(''); }}
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 text-xs font-medium text-neutral-400 hover:bg-neutral-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={ratingValue === 0}
                onClick={() => {
                  triggerToast('Obrigado pela sua avaliação! ⭐');
                  setRateModalOpen(false); setRatingValue(0); setRatingComment('');
                }}
                className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Enviar avaliação
              </button>
            </div>
          </div>
        </div>
      )}

      {activePersona === 'cliente' && store.settings && (
        <BottomNav
          activeItem={bottomNavActiveItem}
          activeOrdersCount={activeOrdersCount}
          onHome={() => { setActivePersona('cliente'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onSearch={handleFocusSearch}
          onOrders={() => setIsCartOpen(true)}
          onProfile={() => {
            if (auth.currentUser) { setProfileModalOpen(true); return; }
            handleManualGoogleLogin();
          }}
        />
      )}
    </div>
  );
}
