import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, MessageCircle, Search, ShieldCheck, Star, UserPlus } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabase';
import type { AppUser, Order } from '../types';
import { pushToast } from '../components/ui/Toast';

type CustomerSegment = 'todos' | 'vip' | 'recorrente' | 'novo' | 'sem_pedido';

type CustomerMetrics = {
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

function toWhatsAppUrl(customer: AppUser) {
  const digits = (customer.telefone || '').replace(/\D/g, '');
  if (!digits) return null;

  const phone = digits.startsWith('55') ? digits : `55${digits}`;
  const text = encodeURIComponent(`Ola, ${customer.nome}! Estou entrando em contato pelo painel do TechBild Delivery.`);

  return `https://wa.me/${phone}?text=${text}`;
}

function classifyCustomer(metrics: CustomerMetrics | undefined): Exclude<CustomerSegment, 'todos'> {
  if (!metrics || metrics.ordersCount === 0) return 'sem_pedido';
  if (metrics.totalSpent >= 250 || metrics.ordersCount >= 6) return 'vip';
  if (metrics.ordersCount >= 3) return 'recorrente';
  return 'novo';
}

const segmentMeta: Record<Exclude<CustomerSegment, 'todos'>, { label: string; className: string; icon?: ReactNode }> = {
  vip: {
    label: 'VIP',
    className: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    icon: <Star size={12} />,
  },
  recorrente: {
    label: 'Recorrente',
    className: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    icon: <ShieldCheck size={12} />,
  },
  novo: {
    label: 'Novo',
    className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    icon: <UserPlus size={12} />,
  },
  sem_pedido: {
    label: 'Sem pedido',
    className: 'border-neutral-600/30 bg-neutral-600/15 text-neutral-400',
  },
};

export function Customers() {
  const [customers, setCustomers] = useState<AppUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<CustomerSegment>('todos');

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('*').order('criado_em', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
    ]).then(([usersResponse, ordersResponse]) => {
      setCustomers((usersResponse.data as AppUser[]) ?? []);
      setOrders((ordersResponse.data as Order[]) ?? []);
      setLoading(false);
    });
  }, []);

  const metricsByCustomer = useMemo(() => {
    const metrics = new Map<string, CustomerMetrics>();

    orders.forEach((order) => {
      if (!order.user_id) return;
      const current = metrics.get(order.user_id) ?? {
        ordersCount: 0,
        totalSpent: 0,
        lastOrderAt: null,
      };

      metrics.set(order.user_id, {
        ordersCount: current.ordersCount + 1,
        totalSpent: current.totalSpent + order.total,
        lastOrderAt:
          !current.lastOrderAt || new Date(order.created_at).getTime() > new Date(current.lastOrderAt).getTime()
            ? order.created_at
            : current.lastOrderAt,
      });
    });

    return metrics;
  }, [orders]);

  const filtered = customers.filter((customer) => {
    const query = search.toLowerCase();
    const metrics = metricsByCustomer.get(customer.id);
    const customerSegment = classifyCustomer(metrics);
    const matchesQuery =
      !query ||
      customer.nome.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      (customer.telefone ?? '').toLowerCase().includes(query);

    const matchesSegment = segment === 'todos' || customerSegment === segment;
    return matchesQuery && matchesSegment;
  });

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, customer) => {
        const metrics = metricsByCustomer.get(customer.id);
        const customerSegment = classifyCustomer(metrics);
        acc.totalCustomers += 1;
        acc.totalRevenue += metrics?.totalSpent ?? 0;
        if ((metrics?.ordersCount ?? 0) > 0) acc.activeCustomers += 1;
        if (customerSegment === 'vip') acc.vipCustomers += 1;
        return acc;
      },
      { totalCustomers: 0, activeCustomers: 0, vipCustomers: 0, totalRevenue: 0 },
    );
  }, [filtered, metricsByCustomer]);

  const handleWhatsApp = (customer: AppUser) => {
    const url = toWhatsAppUrl(customer);

    if (!url) {
      pushToast('Este cliente nao possui telefone cadastrado.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleExportCsv = () => {
    const rows = [
      ['cliente', 'email', 'telefone', 'tipo', 'segmento', 'pedidos', 'total_gasto', 'ultimo_pedido', 'membro_desde'],
      ...filtered.map((customer) => {
        const metrics = metricsByCustomer.get(customer.id);
        return [
          customer.nome,
          customer.email,
          customer.telefone ?? '',
          customer.tipo_usuario,
          classifyCustomer(metrics),
          String(metrics?.ordersCount ?? 0),
          (metrics?.totalSpent ?? 0).toFixed(2),
          metrics?.lastOrderAt ? new Date(metrics.lastOrderAt).toLocaleString('pt-BR') : '',
          new Date(customer.criado_em).toLocaleDateString('pt-BR'),
        ];
      }),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    anchor.download = `clientes-${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
  };

  if (loading) {
    return <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div>
        <h2 className="font-['Syne'] text-xl font-extrabold text-white">Clientes</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{filtered.length} usuarios na visualizacao atual</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-4 py-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Clientes filtrados</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.totalCustomers}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-4 py-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Clientes com pedido</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.activeCustomers}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-4 py-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Clientes VIP</p>
          <p className="mt-2 text-2xl font-bold text-[#f59e0b]">{summary.vipCustomers}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-4 py-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Faturamento da base</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">R$ {summary.totalRevenue.toFixed(2).replace('.', ',')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-3 py-2.5 lg:flex-1">
          <Search size={14} className="shrink-0 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou telefone..."
            className="w-full bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(['todos', 'vip', 'recorrente', 'novo', 'sem_pedido'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSegment(item)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                segment === item
                  ? 'border-[#f97316]/40 bg-[#f97316]/15 text-[#f97316]'
                  : 'border-[rgba(255,255,255,0.08)] bg-[#161618] text-neutral-400 hover:text-white'
              }`}
            >
              {item === 'todos' ? 'Todos' : segmentMeta[item].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161618] px-4 py-2.5 text-xs font-semibold text-neutral-200 transition hover:bg-[#1e1e21]"
        >
          <Download size={14} />
          Exportar CSV
        </button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.05)] text-[10px] uppercase tracking-wider text-neutral-600">
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="hidden px-5 py-3 text-left md:table-cell">Email</th>
                <th className="hidden px-5 py-3 text-left lg:table-cell">Telefone</th>
                <th className="px-5 py-3 text-left">Tipo</th>
                <th className="px-5 py-3 text-left">Segmento</th>
                <th className="px-5 py-3 text-right">Pedidos</th>
                <th className="px-5 py-3 text-right">Total gasto</th>
                <th className="px-5 py-3 text-left">Ultimo pedido</th>
                <th className="px-5 py-3 text-left">Membro desde</th>
                <th className="px-5 py-3 text-right">Contato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-neutral-600">
                    Nenhum cliente
                  </td>
                </tr>
              )}

              {filtered.map((customer) => {
                const metrics = metricsByCustomer.get(customer.id);
                const customerSegment = classifyCustomer(metrics);

                return (
                  <tr key={customer.id} className="border-b border-[rgba(255,255,255,0.04)] transition-colors hover:bg-[#1e1e21]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316]/15 font-['Syne'] text-xs font-bold text-[#f97316]">
                          {customer.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-neutral-200">{customer.nome}</span>
                          <button
                            type="button"
                            onClick={() => handleWhatsApp(customer)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#25d366] lg:hidden"
                          >
                            <MessageCircle size={12} />
                            Chamar no WhatsApp
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 text-neutral-400 md:table-cell">{customer.email}</td>
                    <td className="hidden px-5 py-3.5 text-neutral-400 lg:table-cell">{customer.telefone ?? '-'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${customer.tipo_usuario === 'admin' ? 'border-[#f97316]/30 bg-[#f97316]/15 text-[#f97316]' : 'border-neutral-600/30 bg-neutral-600/15 text-neutral-400'}`}>
                        {customer.tipo_usuario}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${segmentMeta[customerSegment].className}`}>
                        {segmentMeta[customerSegment].icon}
                        {segmentMeta[customerSegment].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-neutral-200">{metrics?.ordersCount ?? 0}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-300">R$ {(metrics?.totalSpent ?? 0).toFixed(2).replace('.', ',')}</td>
                    <td className="px-5 py-3.5 text-xs text-neutral-500">
                      {metrics?.lastOrderAt ? new Date(metrics.lastOrderAt).toLocaleString('pt-BR') : 'Sem pedidos'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-neutral-500">{new Date(customer.criado_em).toLocaleDateString('pt-BR')}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleWhatsApp(customer)}
                        className="hidden items-center gap-2 rounded-xl border border-[#25d366]/25 bg-[#25d366]/10 px-3 py-2 text-xs font-semibold text-[#25d366] transition hover:bg-[#25d366]/15 lg:inline-flex"
                      >
                        <MessageCircle size={14} />
                        WhatsApp
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
