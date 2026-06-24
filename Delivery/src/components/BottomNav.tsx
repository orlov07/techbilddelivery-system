import { Home, Search, Receipt, User } from 'lucide-react';

interface BottomNavProps {
  onHome: () => void;
  onSearch: () => void;
  onOrders: () => void;
  onProfile: () => void;
  activeItem: 'home' | 'search' | 'orders' | 'profile';
  activeOrdersCount?: number;
}

export default function BottomNav({
  onHome, onSearch, onOrders, onProfile, activeItem, activeOrdersCount = 0,
}: BottomNavProps) {
  return (
    <nav
      role="navigation"
      aria-label="Navegação principal"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 w-full max-w-full overflow-x-hidden border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-around px-2">

        <button type="button" onClick={onHome} aria-label="Início"
          className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition ${activeItem === 'home' ? 'text-orange-400' : 'text-neutral-500 hover:text-neutral-200'}`}>
          <Home className="h-4.5 w-4.5" />
          <span>Início</span>
        </button>

        <button type="button" onClick={onSearch} aria-label="Buscar"
          className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition ${activeItem === 'search' ? 'text-orange-400' : 'text-neutral-500 hover:text-neutral-200'}`}>
          <Search className="h-4.5 w-4.5" />
          <span>Buscar</span>
        </button>

        <button type="button" onClick={onOrders} aria-label={`Pedidos${activeOrdersCount > 0 ? `, ${activeOrdersCount} em andamento` : ''}`}
          className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition ${activeItem === 'orders' ? 'text-orange-400' : 'text-neutral-500 hover:text-neutral-200'}`}>
          <div className="relative">
            <Receipt className="h-4.5 w-4.5" />
            {activeOrdersCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white leading-none animate-pulse">
                {activeOrdersCount > 9 ? '9+' : activeOrdersCount}
              </span>
            )}
          </div>
          <span>Pedidos</span>
        </button>

        <button type="button" onClick={onProfile} aria-label="Perfil"
          className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition ${activeItem === 'profile' ? 'text-orange-400' : 'text-neutral-500 hover:text-neutral-200'}`}>
          <User className="h-4.5 w-4.5" />
          <span>Perfil</span>
        </button>

      </div>
    </nav>
  );
}
