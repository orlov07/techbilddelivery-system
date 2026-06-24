import { MapPin } from 'lucide-react';
import { Badge, orderStatusBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { useDrivers } from '../hooks/useDrivers';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

export function LiveDelivery() {
  const { drivers, loading: driversLoading } = useDrivers();
  const { orders, loading: ordersLoading } = useRealtimeOrders();
  const activeOrders = orders.filter((order) => order.status === 'enviando');
  const loading = driversLoading || ordersLoading;

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div>
        <h2 className="font-['Syne'] text-xl font-extrabold text-white">Entregas ao Vivo</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{activeOrders.length} entrega(s) em andamento</p>
      </div>

      <div className="flex min-h-56 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618]">
        <div className="p-8 text-center text-neutral-600">
          <MapPin size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-neutral-500">Mapa em tempo real</p>
          <p className="mt-1 text-xs text-neutral-600">Nenhuma coordenada real disponível para renderização.</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Entregas Ativas</p>
          {activeOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-600">Nenhuma entrega em andamento</p>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order) => {
                const driver = drivers.find((item) => item.id === order.motoboy_id);
                const { label, variant } = orderStatusBadge(order.status);
                return (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#0e0e0f] p-3">
                    <div>
                      <p className="text-xs font-bold text-[#f97316]">{order.seq_code}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{order.customer_name}</p>
                      {driver ? <p className="mt-0.5 text-[10px] text-neutral-600">Entregador: {driver.name}</p> : null}
                    </div>
                    <Badge label={label} variant={variant} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Entregadores</p>
          {drivers.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-600">Nenhum entregador cadastrado</p>
          ) : (
            <div className="space-y-3">
              {drivers.map((driver) => {
                const hasActiveOrder = activeOrders.some((order) => order.motoboy_id === driver.id);
                return (
                  <div key={driver.id} className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#0e0e0f] px-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f97316]/15 font-['Syne'] text-xs font-bold text-[#f97316]">
                      {driver.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-200">{driver.name}</p>
                      <p className="text-xs text-neutral-500">{driver.phone}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${!driver.is_active ? 'border-neutral-600/30 bg-neutral-600/15 text-neutral-500' : hasActiveOrder ? 'border-purple-500/30 bg-purple-500/15 text-purple-400' : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'}`}>
                      {!driver.is_active ? 'Offline' : hasActiveOrder ? 'Em rota' : 'Disponível'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
