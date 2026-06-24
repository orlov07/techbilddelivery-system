import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bike,
  ChevronDown,
  ExternalLink,
  Grip,
  LogOut,
  MapPin,
  Settings,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type { AppUser } from '../../types';
import { signOut } from '../../lib/supabase';
import logo from '../img/logo.png';

const NAV = [
  {
    label: 'Principal',
    items: [
      { to: '/', label: 'Dashboard', icon: Grip, end: true },
      { to: '/pedidos', label: 'Pedidos', icon: ShoppingBag },
      { to: '/entregas', label: 'Entregas ao Vivo', icon: MapPin },
      { to: '/cardapio', label: 'Cardapio', icon: UtensilsCrossed },
    ],
  },
  {
    label: 'Gestao',
    items: [
      { to: '/entregadores', label: 'Entregadores', icon: Bike },
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/relatorios', label: 'Relatorios', icon: BarChart3 },
    ],
  },
];

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  user: AppUser | null;
  pendingCount: number;
}

function SidebarContent({ user, pendingCount, onClose, onLogout }: Omit<Props, 'mobileOpen'>) {
  const navigate = useNavigate();
  const displayName = user?.nome?.trim() || 'Administrador';

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  return (
    <>
      <div className="flex items-center justify-end px-5 pt-4 lg:hidden">
        <button
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#9ca3af] transition hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 px-5 py-6">
        <div className="flex h-full flex-col">
          <div className="space-y-9">
            <div className="flex items-center gap-3 px-3">
              <img
                src={logo}
                alt="TechBild"
                className="h-14 w-14 rounded-2xl border border-white/10 bg-white/5 object-cover p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-[-0.03em] text-white">TechBild</p>
                <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-[#7f8aa3]">
                  Sistema de Gerenciamento
                </p>
              </div>
            </div>

            {NAV.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f8aa3]">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.items.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex h-11 min-w-0 items-center gap-3 rounded-xl px-4 text-[15px] font-semibold transition hover:bg-white/[0.04] hover:text-white ${
                          isActive
                            ? 'border border-[#ff6a00]/35 bg-[#ff6a00]/15 text-[#ff6a00] shadow-[0_0_24px_rgba(255,106,0,0.12)]'
                            : 'border border-transparent text-slate-300'
                        }`
                      }
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className="truncate">{label}</span>
                      {label === 'Pedidos' && pendingCount > 0 ? (
                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6a00] px-1.5 text-[10px] font-bold leading-none text-white">
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      ) : null}
                      {label === 'Entregas ao Vivo' ? (
                        <span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#00d26a] shadow-[0_0_12px_rgba(0,210,106,0.65)]" />
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-9">
            <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f8aa3]">Sistema</p>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  navigate('/configuracoes');
                  onClose();
                }}
                className="flex h-11 w-full min-w-0 items-center gap-3 rounded-xl px-4 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
              >
                <Settings size={18} className="shrink-0" />
                <span className="truncate">Configuracoes</span>
              </button>
              <a
                href="https://sysstemdelivery.web.app"
                target="_blank"
                rel="noreferrer"
                className="flex h-11 min-w-0 items-center gap-3 rounded-xl px-4 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
              >
                <ExternalLink size={18} className="shrink-0" />
                <span className="truncate">Ver App ao Vivo</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-5">
        <button
          type="button"
          onClick={() => {
            navigate('/configuracoes');
            onClose();
          }}
          className="w-full rounded-[28px] border border-white/10 bg-gradient-to-br from-[#121d2d] to-[#0c1625] px-4 py-4 text-left shadow-[0_20px_60px_rgba(0,0,0,0.32)] transition hover:border-white/20"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#ff5a00] to-[#ff7a1a] text-lg font-bold text-white shadow-[0_0_30px_rgba(255,106,0,0.35)]">
              {displayName.charAt(0).toUpperCase()}
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#121d2d] bg-[#00e59b]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-white">{displayName}</p>
              <p className="mt-1 text-sm text-[#8f9bb3]">Gerente Geral</p>
            </div>
            <ChevronDown size={16} className="shrink-0 text-[#7f8aa3]" />
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="mt-4 flex h-11 w-full items-center gap-3 rounded-xl px-4 text-[15px] font-semibold text-slate-300 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={18} className="shrink-0" />
          <span>Sair do sistema</span>
        </button>
      </div>
    </>
  );
}

export function Sidebar({ mobileOpen, onClose, onLogout, user, pendingCount }: Props) {
  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[285px] flex-col border-r border-white/10 bg-[#07111f] lg:flex">
        <SidebarContent user={user} pendingCount={pendingCount} onClose={onClose} onLogout={onLogout} />
      </aside>

      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#02060d]/80 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        onClick={(e) => e.stopPropagation()}
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[285px] max-w-[calc(100vw-24px)] flex-col overflow-y-auto overscroll-contain border-r border-white/10 bg-[#07111f] shadow-[0_20px_80px_rgba(0,0,0,0.45)] transition-transform duration-200 [webkit-overflow-scrolling:touch] lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent user={user} pendingCount={pendingCount} onClose={onClose} onLogout={onLogout} />
      </aside>
    </>
  );
}
