import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import type { AppUser } from '../../types';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface Props {
  user: AppUser | null;
  pendingCount: number;
  onLogout: () => void;
}

export function AdminLayout({ user, pendingCount, onLogout }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto bg-[#050b14] text-white [webkit-overflow-scrolling:touch]">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={onLogout}
        user={user}
        pendingCount={pendingCount}
      />

      <main className="min-h-screen overflow-x-hidden overflow-y-visible bg-[#050b14] text-white lg:pl-[285px]">
        <Topbar user={user} pendingCount={pendingCount} onMenuClick={() => setMobileOpen(true)} onLogout={onLogout} />
        <div className="mx-auto w-full max-w-[1600px] min-w-0 px-5 py-5 lg:px-7">
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
        <footer className="px-5 pb-6 pt-2 text-center text-xs text-[#6f7b90] lg:px-7">
          TechBild Admin Panel
        </footer>
      </main>
    </div>
  );
}
