import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Bike,
  Clock3,
  DollarSign,
  Headset,
  ListTodo,
  MapPin,
  Package,
  PencilLine,
  SearchCheck,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Badge, orderStatusBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { useDateRange } from '../contexts/DateRangeContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useDrivers } from '../hooks/useDrivers';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import { filterOrdersByRange, getDateRangeLabel } from '../lib/dateRange';
import { pushToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import type { Order } from '../types';

function fmt(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? { text: '+100%', up: true } : { text: '--', up: null };
  const delta = ((cur - prev) / prev) * 100;
  return { text: `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`, up: delta >= 0 };
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1726] to-[#08111d] shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${className}`}>
      {children}
    </section>
  );
}

function PanelHeader({ title, badge, action }: { title: string; badge?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="truncate text-[15px] font-bold text-white">{title}</h3>
          {badge}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6a00] opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff6a00]" />
    </span>
  );
}

function EmptyRows({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-[250px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-[#4a5268]">{icon}</div>
      <p className="max-w-md text-sm text-[#70809b]">{text}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  trendText,
  trendUp,
  accentClass,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  caption: string;
  trendText?: string;
  trendUp?: boolean | null;
  accentClass: string;
}) {
  return (
    <Panel className="relative overflow-hidden p-6">
      <div className={`absolute inset-y-0 right-0 w-28 opacity-30 blur-3xl ${accentClass}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f9bd1]">{label}</p>
          <p className="mt-5 truncate text-[44px] font-black leading-none tracking-[-0.06em] text-white">{value}</p>
          <div className="mt-4 flex items-center gap-2 text-xs">
            {trendText && trendUp !== undefined && trendUp !== null ? (
              <>
                {trendUp ? <TrendingUp size={13} className="text-emerald-400" /> : <TrendingDown size={13} className="text-red-400" />}
                <span className={trendUp ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>{trendText}</span>
              </>
            ) : null}
            <span className="text-[#7f8aa3]">{caption}</span>
          </div>
        </div>
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-white ${accentClass}`}>
          <Icon size={22} />
        </div>
      </div>
    </Panel>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { range } = useDateRange();
  const { orders, loading: ordersLoading, error: ordersError, setToastCallback } = useRealtimeOrders();
  const filteredOrders = useMemo(() => filterOrdersByRange(orders, range), [orders, range]);
  const { drivers, loading: driversLoading } = useDrivers();
  const { stats } = useDashboardStats(orders, range);
  const rangeLabel = useMemo(() => getDateRangeLabel(range), [range]);

  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [customersLoading, setCustomersLoading] = useState(true);

  useEffect(() => {
    setToastCallback(pushToast);
  }, [setToastCallback]);

  useEffect(() => {
    let alive = true;

    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tipo_usuario', 'cliente')
      .then(({ count }) => {
        if (!alive) return;
        setCustomerCount(count ?? 0);
        setCustomersLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const realtimeFeed = useMemo(
    () =>
      filteredOrders
        .filter((order) => ['pendente', 'aceito', 'preparando', 'enviando'].includes(order.status))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 12),
    [filteredOrders],
  );

  const hourlyData = useMemo(() => {
    const map: Record<string, { hour: string; pedidos: number }> = {};

    filteredOrders
      .forEach((order) => {
        const hour = `${new Date(order.created_at).getHours().toString().padStart(2, '0')}h`;
        if (!map[hour]) map[hour] = { hour, pedidos: 0 };
        map[hour].pedidos += 1;
      });

    return Object.values(map).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [filteredOrders]);

  const todayOrders = filteredOrders;
  const deliveredToday = todayOrders.filter((order) => order.status === 'entregue').length;
  const canceledToday = todayOrders.filter((order) => order.status === 'cancelado').length;
  const deliveryRate = todayOrders.length ? Math.round((deliveredToday / todayOrders.length) * 100) : 0;
  const activeDrivers = drivers.filter((driver) => driver.is_active);
  const busyDrivers = new Set(filteredOrders.filter((order) => order.status === 'enviando').map((order) => order.motoboy_id)).size;

  const ordersTrend = pct(stats.ordersToday, stats.ordersYesterday);
  const revenueTrend = pct(stats.revenueToday, stats.revenueYesterday);
  const avgDisplay = stats.avgDeliveryMinutes == null ? '--' : `${Math.round(stats.avgDeliveryMinutes)}min`;

  if (ordersLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-[170px] rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <Skeleton className="min-h-[420px] rounded-2xl" />
            <Skeleton className="h-[190px] rounded-2xl" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-[250px] rounded-2xl" />
            <Skeleton className="h-[260px] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#8fa0bb]">Visao geral da operacao</p>
          <h2 className="mt-2 text-[30px] font-black tracking-[-0.04em] text-white">Controle em tempo real</h2>
          <p className="mt-2 text-sm text-[#70809b]">Periodo: {rangeLabel}</p>
        </div>

        <div className="flex min-w-0 flex-wrap gap-3">
          <button
            onClick={() => navigate('/cardapio')}
            className="rounded-xl bg-gradient-to-r from-[#ff5a00] to-[#ff7a1a] px-5 py-3 font-bold text-white shadow-[0_0_30px_rgba(255,106,0,0.35)] transition hover:brightness-110"
          >
            <span className="inline-flex items-center gap-2"><Package size={16} /> Novo Produto</span>
          </button>
          <button
            onClick={() => navigate('/relatorios')}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            <span className="inline-flex items-center gap-2"><SearchCheck size={16} /> Exportar Relatorio</span>
          </button>
          <button
            onClick={() => navigate('/cardapio')}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            <span className="inline-flex items-center gap-2"><PencilLine size={16} /> Editar Cardapio</span>
          </button>
          <a
            href="https://sysstemdelivery.web.app"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            <span className="inline-flex items-center gap-2"><Headset size={16} /> Suporte</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ShoppingBag}
          label="Pedidos no periodo"
          value={String(stats.ordersToday)}
          trendText={ordersTrend.text}
          trendUp={ordersTrend.up}
          caption="vs ontem"
          accentClass="bg-gradient-to-br from-[#ff5a00] to-[#ff7a1a]"
        />
        <StatCard
          icon={DollarSign}
          label="Faturamento no periodo"
          value={fmt(stats.revenueToday)}
          trendText={revenueTrend.text}
          trendUp={revenueTrend.up}
          caption="vs ontem"
          accentClass="bg-gradient-to-br from-emerald-500 to-teal-500"
        />
        <StatCard
          icon={Users}
          label="Clientes"
          value={customersLoading ? '...' : String(customerCount ?? 0)}
          caption="base cadastrada"
          accentClass="bg-gradient-to-br from-blue-500 to-indigo-500"
        />
        <StatCard
          icon={Clock3}
          label="Tempo Medio"
          value={avgDisplay}
          caption={stats.avgDeliveryMinutes == null ? 'aguardando entregas' : 'por entrega'}
          accentClass="bg-gradient-to-br from-fuchsia-500 to-violet-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <Panel className="min-h-[420px]">
            <PanelHeader
              title="Pedidos em Tempo Real"
              badge={
                realtimeFeed.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#70809b]">
                    <LiveDot />
                    {realtimeFeed.length} em andamento
                  </span>
                ) : (
                  <span className="text-xs text-[#70809b]">Monitoramento ativo</span>
                )
              }
              action={
                <button
                  onClick={() => navigate('/pedidos')}
                  className="text-[13px] font-semibold text-[#ff9b57] transition hover:text-white"
                >
                  Ver todos
                </button>
              }
            />

            {ordersError ? (
              <EmptyRows icon={<AlertCircle size={18} />} text="Erro ao carregar pedidos. Tente novamente." />
            ) : realtimeFeed.length === 0 ? (
              <EmptyRows icon={<ListTodo size={18} />} text="Nenhum pedido ativo no momento. Novos pedidos aparecem aqui automaticamente." />
            ) : (
              <div className="space-y-3 p-4">
                {realtimeFeed.map((order) => {
                  const { label, variant } = orderStatusBadge(order.status);

                  return (
                    <button
                      key={order.id}
                      onClick={() => navigate('/pedidos')}
                      className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-[#09111d] px-4 py-3 text-left transition hover:border-[#ff6a00]/35 hover:bg-[#0d1726]"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ff6a00]/12 text-[#ff8a3d]">
                        <ShoppingBag size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate font-mono text-[13px] font-bold text-[#ff8a3d]">{order.seq_code}</span>
                          <Badge label={label} variant={variant} />
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-[#d5dceb]">{order.customer_name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-white">{fmt(order.total)}</p>
                        <p className="mt-1 text-[11px] text-[#70809b]">
                          {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Resumo do Periodo" badge={<span className="text-xs text-[#70809b]">Atualizado em tempo real</span>} />
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Entregues', value: String(deliveredToday), caption: 'pedidos concluidos', tone: 'text-emerald-400' },
                {
                  label: 'Taxa de entrega',
                  value: `${deliveryRate}%`,
                  caption: 'pedidos no periodo',
                  tone: deliveryRate >= 80 ? 'text-emerald-400' : deliveryRate >= 50 ? 'text-yellow-400' : 'text-red-400',
                },
                { label: 'Cancelamentos', value: String(canceledToday), caption: 'pedidos cancelados', tone: canceledToday > 0 ? 'text-red-400' : 'text-[#9ca3af]' },
                { label: 'Entregadores', value: `${busyDrivers}/${activeDrivers.length}`, caption: 'em rota / ativos', tone: 'text-[#ffb27a]' },
              ].map((item) => (
                <div key={item.label} className="min-w-0 rounded-2xl border border-white/10 bg-[#09111d] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7f8aa3]">{item.label}</p>
                  <p className={`mt-3 truncate text-[28px] font-black leading-none tracking-[-0.04em] ${item.tone}`}>{item.value}</p>
                  <p className="mt-2 text-xs text-[#70809b]">{item.caption}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader title="Mapa de Entregas" badge={<span className="text-xs text-[#70809b]">Area operacional</span>} />
            <div className="flex min-h-[250px] items-center justify-center p-5">
              <div className="flex w-full min-w-0 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#09111d] px-6 py-10 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#ff6a00]/12 text-[#ff8a3d]">
                  <MapPin size={26} />
                </div>
                <p className="text-[15px] font-bold text-white">Mapa em tempo real</p>
                <p className="mt-3 max-w-xs text-sm text-[#70809b]">Nenhuma coordenada real disponivel para renderizacao neste momento.</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Entregadores"
              badge={<span className="text-xs text-[#70809b]">{busyDrivers} em rota</span>}
              action={
                <button
                  onClick={() => navigate('/entregadores')}
                  className="text-[13px] font-semibold text-[#ff9b57] transition hover:text-white"
                >
                  Gerenciar
                </button>
              }
            />
            <div className="p-4">
              {driversLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <Skeleton key={item} className="h-[68px] rounded-2xl" />
                  ))}
                </div>
              ) : activeDrivers.length === 0 ? (
                <EmptyRows icon={<Bike size={18} />} text="Nenhum entregador ativo." />
              ) : (
                <div className="space-y-3">
                  {activeDrivers.slice(0, 5).map((driver) => {
                    const busy = orders.some((order) => order.status === 'enviando' && order.motoboy_id === driver.id);

                    return (
                      <div key={driver.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-[#09111d] px-3 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff6a00]/12 text-[13px] font-bold text-[#ff8a3d]">
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{driver.name}</p>
                          <p className="truncate text-xs text-[#70809b]">{driver.phone}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${busy ? 'border-purple-500/25 bg-purple-500/10 text-purple-400' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'}`}>
                          {busy ? 'Em rota' : 'Livre'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Pedidos por Hora" badge={<span className="text-xs text-[#70809b]">{rangeLabel}</span>} />
            <div className="min-w-0 p-4">
              {hourlyData.length === 0 ? (
                <EmptyRows icon={<TrendingUp size={18} />} text="Sem pedidos no periodo selecionado." />
              ) : (
                <div className="h-[210px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData} margin={{ top: 6, right: 0, bottom: 0, left: -28 }}>
                      <XAxis dataKey="hour" tick={{ fill: '#70809b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#70809b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#09111d',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 14,
                          color: '#fff',
                          fontSize: 12,
                        }}
                        cursor={{ fill: 'rgba(255,106,0,0.08)' }}
                      />
                      <Bar dataKey="pedidos" radius={[8, 8, 0, 0]} maxBarSize={34}>
                        {hourlyData.map((_entry, index) => (
                          <Cell key={index} fill={index === hourlyData.length - 1 ? '#ff6a00' : '#233047'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
