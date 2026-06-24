import { Bell, CalendarDays, Check, ChevronDown, LogOut, PanelLeft, Search, Settings, ShoppingBag, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDateRange } from '../../contexts/DateRangeContext';
import { getDateRangeLabel, getDefaultCustomRange, type DatePreset } from '../../lib/dateRange';
import type { AppUser } from '../../types';
import { pushToast } from '../ui/Toast';

interface Props {
  user: AppUser | null;
  pendingCount: number;
  onMenuClick: () => void;
  onLogout: () => void;
}

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Sincronizado com app' },
  '/pedidos': { title: 'Pedidos', subtitle: 'Gestao em tempo real' },
  '/entregas': { title: 'Entregas ao Vivo', subtitle: 'Operacao logistica' },
  '/cardapio': { title: 'Cardapio', subtitle: 'Produtos e categorias' },
  '/entregadores': { title: 'Entregadores', subtitle: 'Equipe de entrega' },
  '/clientes': { title: 'Clientes', subtitle: 'Base de usuarios' },
  '/relatorios': { title: 'Relatorios', subtitle: 'Indicadores do negocio' },
  '/configuracoes': { title: 'Configuracoes', subtitle: 'Dados e operacao da loja' },
};

export function Topbar({ user, pendingCount, onMenuClick, onLogout }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { range, setRange } = useDateRange();
  const displayName = user?.nome?.trim() || 'Administrador';
  const current = TITLES[location.pathname] ?? TITLES['/'];
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const defaults = getDefaultCustomRange();
  const [customStart, setCustomStart] = useState(range.startDate || defaults.startDate);
  const [customEnd, setCustomEnd] = useState(range.endDate || defaults.endDate);
  const pendingLabel = pendingCount > 0 ? `${pendingCount} pedido(s) aguardando atendimento.` : 'Nenhum pedido pendente no momento.';
  const quickDateText = useMemo(() => new Date().toLocaleString('pt-BR'), []);
  const currentRangeLabel = useMemo(() => getDateRangeLabel(range), [range]);

  const closeAll = () => {
    setCalendarOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  const applyPreset = (preset: DatePreset) => {
    setRange({ preset, startDate: customStart, endDate: customEnd });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050b14]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[80px] w-full max-w-[1600px] min-w-0 items-center gap-4 px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-neutral-400 transition hover:text-white lg:hidden"
          >
            <PanelLeft size={18} />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-black tracking-[-0.04em] text-white">{current.title}</h1>
            <span className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[#ff6a00]/20 bg-[#ff6a00]/10 px-3 py-1 text-[12px] font-medium text-[#ffb27a]">
              <Sparkles size={13} className="shrink-0" />
              <span className="truncate">{current.subtitle}</span>
            </span>
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          <div className="hidden min-w-0 max-w-[414px] flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 xl:flex">
            <Search size={16} className="shrink-0 text-[#9ca3af]" />
            <span className="truncate text-sm text-[#9ca3af]">Buscar no painel...</span>
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-[#111c2b] px-2 py-1 text-[11px] text-[#9ca3af]">
              <span>Ctrl</span>
              <span>K</span>
            </div>
          </div>

          <div className="relative hidden xl:block">
            <button
              onClick={() => {
                setCalendarOpen((value) => !value);
                setNotificationsOpen(false);
                setProfileOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white"
            >
              <CalendarDays size={16} className="text-[#a7b2c8]" />
              <span className="whitespace-nowrap">{currentRangeLabel}</span>
              <ChevronDown size={14} className="text-[#a7b2c8]" />
            </button>

            {calendarOpen ? (
              <div className="absolute right-0 top-[calc(100%+12px)] w-80 rounded-2xl border border-white/10 bg-[#0c1625] p-4 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7f8aa3]">Periodo do painel</p>
                <p className="mt-3 text-sm text-white">{quickDateText}</p>

                <div className="mt-4 space-y-2">
                  {[
                    { key: 'today', label: 'Hoje' },
                    { key: 'yesterday', label: 'Ontem' },
                    { key: 'last7', label: 'Ultimos 7 dias' },
                    { key: 'last30', label: 'Ultimos 30 dias' },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => {
                        applyPreset(option.key as DatePreset);
                        closeAll();
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                        range.preset === option.key
                          ? 'border-[#ff6a00]/35 bg-[#ff6a00]/12 text-white'
                          : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
                      }`}
                    >
                      <span>{option.label}</span>
                      {range.preset === option.key ? <Check size={15} className="text-[#ff8a3d]" /> : null}
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f8aa3]">Intervalo personalizado</p>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="rounded-xl border border-white/10 bg-[#0a1320] px-3 py-2 text-sm text-white outline-none"
                    />
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="rounded-xl border border-white/10 bg-[#0a1320] px-3 py-2 text-sm text-white outline-none"
                    />
                    <button
                      onClick={() => {
                        setRange({ preset: 'custom', startDate: customStart, endDate: customEnd });
                        closeAll();
                      }}
                      className="rounded-xl bg-[#ff6a00] px-3 py-2 text-sm font-semibold text-white"
                    >
                      Aplicar intervalo
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => {
                      navigate('/');
                      pushToast('Painel atualizado');
                      closeAll();
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    Voltar ao dashboard
                  </button>
                  <button
                    onClick={() => {
                      navigate('/relatorios');
                      closeAll();
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    Abrir relatorios
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen((value) => !value);
                setCalendarOpen(false);
                setProfileOpen(false);
              }}
              className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[#9ca3af] transition hover:text-white"
            >
              <Bell size={18} />
              {pendingCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6a00] px-1 text-[10px] font-bold text-white">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 top-[calc(100%+12px)] w-80 rounded-2xl border border-white/10 bg-[#0c1625] p-4 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7f8aa3]">Notificacoes</p>
                <p className="mt-3 text-sm text-white">{pendingLabel}</p>
                <button
                  onClick={() => {
                    navigate('/pedidos');
                    closeAll();
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#ff6a00] px-4 py-2 text-sm font-semibold text-white"
                >
                  <ShoppingBag size={15} />
                  Abrir pedidos
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen((value) => !value);
                setCalendarOpen(false);
                setNotificationsOpen(false);
              }}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-white/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#ff5a00] to-[#ff7a1a] text-base font-extrabold text-white shadow-[0_0_30px_rgba(255,106,0,0.35)]">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold leading-none text-white">{displayName}</p>
                <p className="mt-1 truncate text-xs text-[#9ca3af]">Painel administrativo</p>
              </div>
              <ChevronDown size={16} className="hidden text-[#9ca3af] sm:block" />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 top-[calc(100%+12px)] w-72 rounded-2xl border border-white/10 bg-[#0c1625] p-4 shadow-2xl">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="mt-1 truncate text-xs text-[#8fa0bb]">{user?.email || 'Administrador local'}</p>

                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => {
                      navigate('/configuracoes');
                      closeAll();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    <Settings size={15} />
                    Configuracoes
                  </button>
                  <button
                    onClick={() => {
                      void onLogout();
                      closeAll();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/20"
                  >
                    <LogOut size={15} />
                    Sair do sistema
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
