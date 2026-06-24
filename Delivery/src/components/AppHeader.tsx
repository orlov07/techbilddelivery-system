import {
  Coins,
  CreditCard,
  HelpCircle,
  Headphones,
  LogOut,
  MapPin,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Star,
  User,
  UserCheck,
} from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import type { AppSettings, AppUser } from '../types';

export type DropdownMenuAction =
  | 'profile'
  | 'settings'
  | 'addresses'
  | 'orders'
  | 'payments'
  | 'cashback'
  | 'support'
  | 'faq'
  | 'rate';

interface MenuButtonProps {
  icon: ReactNode;
  label: string;
  badge?: string | number;
  onClick: () => void;
}

function MenuButton({ icon, label, badge, onClick }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minWidth: 0, minHeight: 0 }}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-[#f97316] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

interface AppHeaderProps {
  activeOrdersCount: number;
  activeTab: 'cliente' | 'admin' | 'motoboy';
  cartCount: number;
  cashbackBalance?: number;
  currentUser: AppUser | null;
  isAdminUser: boolean;
  isMotoboyUser: boolean;
  isLoggingInGoogle: boolean;
  loginError: string | null;
  loginStatus: 'idle' | 'loading' | 'success' | 'error';
  onCartClick: () => void;
  onLogin: () => void;
  onLogout: () => void | Promise<void>;
  onMenuAction: (action: DropdownMenuAction) => void;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: 'cliente' | 'admin' | 'motoboy') => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  settings: AppSettings | null;
}

export default function AppHeader({
  activeOrdersCount,
  activeTab,
  cartCount,
  cashbackBalance,
  currentUser,
  isAdminUser,
  isMotoboyUser,
  isLoggingInGoogle,
  loginError,
  loginStatus,
  onCartClick,
  onLogin,
  onLogout,
  onMenuAction,
  onSearchChange,
  onTabChange,
  searchInputRef,
  searchQuery,
  settings,
}: AppHeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const brandLogo = '/logo.png';

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isUserMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isUserMenuOpen]);

  const closeAnd = (action: () => void) => () => {
    setIsUserMenuOpen(false);
    action();
  };

  const tabs: Array<{ id: 'cliente' | 'admin' | 'motoboy'; label: string }> = [
    { id: 'cliente', label: 'Cardápio' },
    ...(isAdminUser ? [{ id: 'admin' as const, label: 'Admin' }] : []),
    ...(isMotoboyUser ? [{ id: 'motoboy' as const, label: 'Motoboy' }] : []),
  ];

  return (
    <header id="app-top-nav" className="sticky top-0 z-40 w-full max-w-full overflow-visible border-b border-[#2a2a2a] bg-[#111111]/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto w-full max-w-7xl px-3 md:px-8">
        {/*
         * Flex-wrap layout:
         *  Mobile  → Row 1: logo | tabs | user | cart   Row 2: search (full-width)
         *  Desktop → Single row: logo | brand | tabs | store-info | search | user | logout | cart
         *
         * The search bar has order:10 + w-full on mobile so it wraps to row 2.
         * On md+ it gets order:4 + flex-1 + w-auto, sitting inline in row 1.
         */}
        <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-2 py-2 md:flex-nowrap md:gap-x-2.5">

          {/* Logo + Brand — order 1 */}
          <div className="order-1 flex min-w-0 shrink items-center gap-2">
            <img
              src={brandLogo}
              alt="TechBild Delivery"
              className="h-8 w-8 shrink-0 rounded-lg border border-[#2f2f2f] bg-[#161616] object-contain p-0.5 md:h-9 md:w-9"
            />
            <div className="hidden min-w-0 md:block">
              <h1 className="truncate text-[13px] font-bold uppercase leading-tight tracking-wide text-white">
                {settings?.establishment_name || 'TechBild Delivery'}
              </h1>
              <p className="text-[10px] text-[#888888]">Delivery & Comanda Mesa</p>
            </div>
          </div>

          {/* Tab selector — order 2 */}
          <div className="order-2 flex max-w-full min-w-0 shrink items-center overflow-x-auto scrollbar-none rounded-[8px] bg-[#2a2a2a] p-[3px]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                style={{ minWidth: 0, minHeight: 0 }}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition md:px-3 md:py-1.5 ${
                  activeTab === tab.id
                    ? 'bg-[#e85c0d] text-white'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Store status — order 3, lg only */}
          {settings && (
            <div className="order-3 hidden items-center gap-3 lg:flex">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${settings.is_open ? 'animate-pulse bg-emerald-400' : 'bg-red-500'}`} />
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-300">
                  {settings.is_open ? 'Aberto' : 'Fechado'}
                </span>
              </div>
              <div className="flex items-center gap-3 border-l border-[#2a2a2a] pl-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-neutral-500">Tempo Estimado</p>
                  <p className="text-[11px] font-semibold text-white">{settings.avg_delivery_time || '--'}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-neutral-500">Taxa Fixa</p>
                  <p className="text-[11px] font-bold text-[#f97316]">
                    R$ {settings.delivery_fee.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/*
           * Search bar — order 4 on desktop (flex-1 inline), order 10 on mobile (full-width row 2).
           * Single input element so searchInputRef always points to this one.
           */}
          <div className="order-10 flex w-full min-w-0 max-w-full items-center gap-2 rounded-[10px] border border-[#333333] bg-[#2a2a2a] px-3 py-2 md:order-4 md:w-auto md:flex-1">
            <Search className="h-[14px] w-[14px] shrink-0 text-[#888888]" />
            <input
              ref={searchInputRef}
              id="top-search-input"
              type="text"
              placeholder="O que você deseja saborear"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent text-[13px] text-[#cccccc] outline-none placeholder:text-[#888888]"
            />
          </div>

          {/* User section — order 5 */}
          {currentUser ? (
            <div ref={userMenuRef} className="relative order-5 flex min-w-0 shrink items-center gap-1">
              {/* Profile button */}
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((v) => !v)}
                style={{ minHeight: 0 }}
                className="flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-neutral-300 transition hover:bg-[#2a2a2a] hover:text-white"
              >
                <User className="h-[16px] w-[16px] shrink-0" />
                <span className="hidden max-w-[80px] truncate text-[12px] sm:block">
                  {currentUser.nome.split(' ')[0]}
                </span>
              </button>

              {/* Rich dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f97316] text-base font-bold text-white">
                      {currentUser.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{currentUser.nome}</p>
                      <p className="truncate text-xs text-gray-500">{currentUser.email}</p>
                    </div>
                  </div>

                  {/* Conta */}
                  <div className="py-1">
                    <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Conta</p>
                    <MenuButton icon={<User className="h-4 w-4 text-[#f97316]" />} label="Meu perfil" onClick={closeAnd(() => onMenuAction('profile'))} />
                    <MenuButton icon={<Settings className="h-4 w-4 text-[#f97316]" />} label="Configurações" onClick={closeAnd(() => onMenuAction('settings'))} />
                    <MenuButton icon={<MapPin className="h-4 w-4 text-[#f97316]" />} label="Meus endereços" onClick={closeAnd(() => onMenuAction('addresses'))} />
                  </div>

                  {/* Pedidos e pagamentos */}
                  <div className="border-t border-gray-100 py-1">
                    <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pedidos e pagamentos</p>
                    <MenuButton icon={<Receipt className="h-4 w-4 text-[#f97316]" />} label="Meus pedidos" badge={activeOrdersCount > 0 ? activeOrdersCount : undefined} onClick={closeAnd(() => onMenuAction('orders'))} />
                    <MenuButton icon={<CreditCard className="h-4 w-4 text-[#f97316]" />} label="Formas de pagamento" onClick={closeAnd(() => onMenuAction('payments'))} />
                    <MenuButton
                      icon={<Coins className="h-4 w-4 text-[#f97316]" />}
                      label="Cashback / cupons"
                      badge={cashbackBalance ? `R$ ${cashbackBalance.toFixed(2).replace('.', ',')}` : undefined}
                      onClick={closeAnd(() => onMenuAction('cashback'))}
                    />
                  </div>

                  {/* Ajuda */}
                  <div className="border-t border-gray-100 py-1">
                    <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Ajuda</p>
                    <MenuButton icon={<Headphones className="h-4 w-4 text-[#f97316]" />} label="Suporte" onClick={closeAnd(() => onMenuAction('support'))} />
                    <MenuButton icon={<HelpCircle className="h-4 w-4 text-[#f97316]" />} label="Perguntas frequentes" onClick={closeAnd(() => onMenuAction('faq'))} />
                    <MenuButton icon={<Star className="h-4 w-4 text-[#f97316]" />} label="Avaliar o app" onClick={closeAnd(() => onMenuAction('rate'))} />
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-1">
                    <button
                      type="button"
                      onClick={() => { setIsUserMenuOpen(false); void onLogout(); }}
                      style={{ minWidth: 0, minHeight: 0 }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      Sair
                    </button>
                  </div>
                </div>
              )}

              {/* Direct logout — desktop only */}
              <button
                type="button"
                onClick={() => void onLogout()}
                title="Sair"
                style={{ minHeight: 0 }}
                className="hidden items-center justify-center rounded-[8px] p-1.5 text-neutral-500 transition hover:bg-[#2a2a2a] hover:text-red-400 sm:flex"
              >
                <LogOut className="h-[16px] w-[16px]" />
              </button>
            </div>
          ) : (
            <div className="order-5 flex min-w-0 shrink flex-col items-end gap-1">
              <button
                type="button"
                onClick={onLogin}
                disabled={loginStatus === 'loading' || isLoggingInGoogle}
                style={{ minHeight: 0 }}
                className="flex items-center gap-1.5 rounded-[8px] bg-[#2a2a2a] px-2 py-[7px] text-[12px] text-[#dddddd] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-70 md:px-3"
              >
                <UserCheck className="h-[15px] w-[15px]" />
                <span className="hidden sm:inline">Entrar com Google</span>
              </button>
              {loginError && <p className="text-[11px] font-medium text-red-300">{loginError}</p>}
            </div>
          )}

          {/* Cart button — order 6 */}
          <button
            id="top-cart-button"
            type="button"
            onClick={onCartClick}
            style={{ minHeight: 0 }}
            className="order-6 flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[#e85c0d] px-2.5 py-2 text-[13px] font-medium text-white transition hover:bg-[#d1510a] md:px-4"
          >
            <ShoppingCart className="h-[15px] w-[15px]" />
            <span className="hidden sm:inline">Meu Carrinho</span>
            {cartCount > 0 && (
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-[10px] font-medium text-[#e85c0d]">
                {cartCount}
              </span>
            )}
          </button>

        </div>
      </div>
    </header>
  );
}
