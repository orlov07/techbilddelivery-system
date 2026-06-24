import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { Skeleton } from './components/ui/Skeleton';
import { useAdminAuth } from './hooks/useAdminAuth';
import { useRealtimeOrders } from './hooks/useRealtimeOrders';
import { signOut } from './lib/supabase';
import { AdminLogin } from './pages/AdminLogin';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Orders = lazy(() => import('./pages/Orders').then((m) => ({ default: m.Orders })));
const LiveDelivery = lazy(() => import('./pages/LiveDelivery').then((m) => ({ default: m.LiveDelivery })));
const Menu = lazy(() => import('./pages/Menu').then((m) => ({ default: m.Menu })));
const Drivers = lazy(() => import('./pages/Drivers').then((m) => ({ default: m.Drivers })));
const Customers = lazy(() => import('./pages/Customers').then((m) => ({ default: m.Customers })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

const PageLoader = () => (
  <div className="space-y-4 p-1">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-36" />
    <Skeleton className="h-72" />
  </div>
);

function AppShell() {
  const auth = useAdminAuth();
  const { orders } = useRealtimeOrders();
  const pendingCount = orders.filter((order) => order.status === 'pendente').length;

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07080B]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#ff6a00] border-t-transparent" />
          <p className="text-sm text-neutral-500">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!auth.user || !auth.isAdmin) return <AdminLogin auth={auth} />;

  const handleLogout = async () => {
    await signOut();
    auth.reload();
  };

  return (
    <Routes>
      <Route path="/" element={<AdminLayout user={auth.user} onLogout={handleLogout} pendingCount={pendingCount} />}>
        <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
        <Route path="pedidos" element={<Suspense fallback={<PageLoader />}><Orders /></Suspense>} />
        <Route path="entregas" element={<Suspense fallback={<PageLoader />}><LiveDelivery /></Suspense>} />
        <Route path="cardapio" element={<Suspense fallback={<PageLoader />}><Menu /></Suspense>} />
        <Route path="entregadores" element={<Suspense fallback={<PageLoader />}><Drivers /></Suspense>} />
        <Route path="clientes" element={<Suspense fallback={<PageLoader />}><Customers /></Suspense>} />
        <Route path="relatorios" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
        <Route path="configuracoes" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
