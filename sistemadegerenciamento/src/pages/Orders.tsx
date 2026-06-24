import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Download, MessageCircle, MapPin, Wallet } from 'lucide-react';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import { useDrivers } from '../hooks/useDrivers';
import { Badge, orderStatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { pushToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import type { Order } from '../types';

const STATUSES = ['todos', 'pendente', 'aceito', 'preparando', 'enviando', 'entregue', 'cancelado', 'recusado'] as const;
const PAYMENT_FILTERS = ['todos', 'aguardando_pagamento', 'pendente', 'pago'] as const;

const currency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

const paymentLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getWhatsAppUrl = (order: Order) => {
  const digits = order.customer_phone.replace(/\D/g, '');
  if (!digits) return '';

  const text = encodeURIComponent(
    `Ola, ${order.customer_name}. Atualizacao do pedido ${order.seq_code} na TechBild Delivery.`,
  );

  return `https://wa.me/${digits}?text=${text}`;
};

export function Orders() {
  const { orders, loading, setToastCallback } = useRealtimeOrders();
  const { drivers } = useDrivers();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [paymentFilter, setPaymentFilter] = useState<string>('todos');
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setToastCallback(pushToast);
  }, [setToastCallback]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'todos' || order.status === statusFilter;
      const matchesPayment = paymentFilter === 'todos' || order.payment_status === paymentFilter;
      const matchesSearch =
        !query ||
        order.customer_name.toLowerCase().includes(query) ||
        order.seq_code.toLowerCase().includes(query) ||
        order.customer_phone.includes(query) ||
        paymentLabel(order.payment_method).toLowerCase().includes(query) ||
        (order.address || '').toLowerCase().includes(query);

      return matchesStatus && matchesPayment && matchesSearch;
    });
  }, [orders, paymentFilter, search, statusFilter]);

  const stats = useMemo(() => {
    const delivered = filtered.filter((order) => order.status === 'entregue');
    const awaitingPayment = filtered.filter((order) => order.payment_status === 'aguardando_pagamento');
    const inProgress = filtered.filter((order) =>
      ['pendente', 'aceito', 'preparando', 'enviando'].includes(order.status),
    );

    return {
      total: filtered.length,
      inProgress: inProgress.length,
      delivered: delivered.length,
      awaitingPayment: awaitingPayment.length,
      revenue: delivered.reduce((sum, order) => sum + order.total, 0),
    };
  }, [filtered]);

  const handleStatus = async (id: string, status: Order['status']) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      pushToast(`Status atualizado: ${status}`);
      setSelected((prev) => (prev ? { ...prev, status } : null));
    } catch (error) {
      pushToast('Erro ao atualizar status');
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignDriver = async (orderId: string, motoboyId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ motoboy_id: motoboyId || null, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      pushToast('Erro ao atribuir entregador');
      console.error(error);
      return;
    }

    pushToast('Entregador atribuido');
    setSelected((prev) => (prev ? { ...prev, motoboy_id: motoboyId || undefined } : null));
  };

  const exportCSV = () => {
    const rows = [[
      'Codigo',
      'Cliente',
      'Telefone',
      'Tipo',
      'Status',
      'Pagamento',
      'Status pagamento',
      'Endereco',
      'Total',
      'Data',
    ]];

    filtered.forEach((order) => {
      rows.push([
        order.seq_code,
        order.customer_name,
        order.customer_phone,
        order.type,
        order.status,
        order.payment_method,
        order.payment_status,
        order.address || '',
        order.total.toFixed(2),
        new Date(order.created_at).toLocaleString('pt-BR'),
      ]);
    });

    const csv = rows.map((row) => row.map((value) => `"${value}"`).join(',')).join('\n');
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    anchor.download = `pedidos-${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
  };

  if (loading) {
    return <div className="space-y-3">{[0, 1, 2, 3, 4, 5].map((index) => <Skeleton key={index} className="h-14" />)}</div>;
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div>
          <h2 className="font-['Syne'] text-xl font-extrabold text-white">Pedidos</h2>
          <p className="mt-0.5 text-sm text-neutral-500">{filtered.length} resultado(s)</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCSV}>
          <Download size={13} />
          Exportar CSV
        </Button>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          { label: 'Pedidos filtrados', value: String(stats.total) },
          { label: 'Em andamento', value: String(stats.inProgress) },
          { label: 'Entregues', value: String(stats.delivered) },
          { label: 'Aguardando pagamento', value: String(stats.awaitingPayment) },
          { label: 'Faturamento', value: currency(stats.revenue) },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-4">
            <p className="mb-1 text-xs text-neutral-500">{item.label}</p>
            <p className="font-['Syne'] text-xl font-extrabold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-wrap gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-3 py-2.5 sm:min-w-[220px]">
          <Search size={14} className="shrink-0 text-neutral-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente, codigo, endereco..."
            className="w-full bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-3 py-2.5">
          <Filter size={14} className="text-neutral-500" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="cursor-pointer bg-transparent text-sm text-neutral-200 outline-none"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status} className="bg-[#161618]">
                {status === 'todos' ? 'Todos os status' : status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-3 py-2.5">
          <Wallet size={14} className="text-neutral-500" />
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="cursor-pointer bg-transparent text-sm text-neutral-200 outline-none"
          >
            {PAYMENT_FILTERS.map((status) => (
              <option key={status} value={status} className="bg-[#161618]">
                {status === 'todos' ? 'Todos os pagamentos' : paymentLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.05)] text-[10px] uppercase tracking-wider text-neutral-600">
                <th className="px-5 py-3 text-left">Codigo</th>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left hidden md:table-cell">Tipo</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left hidden lg:table-cell">Pagamento</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-left hidden xl:table-cell">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-neutral-600">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              )}

              {filtered.map((order) => {
                const { label, variant } = orderStatusBadge(order.status);

                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelected(order)}
                    className="cursor-pointer border-b border-[rgba(255,255,255,0.04)] transition-colors hover:bg-[#1e1e21]"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#f97316]">{order.seq_code}</td>
                    <td className="px-5 py-3.5 text-neutral-200">
                      <p className="font-medium">{order.customer_name}</p>
                      <p className="text-xs text-neutral-500">{order.customer_phone}</p>
                    </td>
                    <td className="hidden px-5 py-3.5 text-xs capitalize text-neutral-400 md:table-cell">{order.type}</td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <Badge label={label} variant={variant} />
                        <p className="text-[10px] uppercase tracking-wide text-neutral-500">{paymentLabel(order.payment_status)}</p>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 text-xs text-neutral-400 lg:table-cell">{paymentLabel(order.payment_method)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-white">{currency(order.total)}</td>
                    <td className="hidden px-5 py-3.5 text-xs text-neutral-500 xl:table-cell">
                      {new Date(order.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-[rgba(255,255,255,0.07)] bg-[#161618] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xl font-bold text-[#f97316]">{selected.seq_code}</p>
                <p className="mt-0.5 text-sm text-neutral-400">
                  {selected.customer_name} · {selected.customer_phone}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded p-1 text-neutral-500 hover:text-white">
                x
              </button>
            </div>

            <div className="space-y-2 text-sm">
              {[
                ['Tipo', selected.type],
                ['Pagamento', paymentLabel(selected.payment_method)],
                ['Status pagamento', paymentLabel(selected.payment_status)],
                ['Subtotal', currency(selected.subtotal)],
                ['Taxa entrega', currency(selected.delivery_fee)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-[rgba(255,255,255,0.05)] py-2">
                  <span className="text-neutral-500">{label}</span>
                  <span className="text-right text-neutral-200">{value}</span>
                </div>
              ))}

              <div className="flex justify-between py-2 text-base font-bold">
                <span className="text-neutral-300">Total</span>
                <span className="text-[#f97316]">{currency(selected.total)}</span>
              </div>

              {selected.address && (
                <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <MapPin className="h-3.5 w-3.5" />
                    Endereco
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-300">{selected.address}</p>
                </div>
              )}

              {selected.notes && (
                <p className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] p-3 text-xs italic text-neutral-400">
                  {selected.notes}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={`tel:${selected.customer_phone}`}
                className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] px-4 py-3 text-center text-sm font-medium text-neutral-200 transition hover:border-[#f97316]/40"
              >
                Ligar para cliente
              </a>
              {getWhatsAppUrl(selected) && (
                <a
                  href={getWhatsAppUrl(selected)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#25d366]/30 bg-[#25d366]/10 px-4 py-3 text-sm font-semibold text-[#25d366] transition hover:bg-[#25d366]/20"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Atribuir entregador</p>
              <select
                value={selected.motoboy_id ?? ''}
                onChange={(event) => handleAssignDriver(selected.id, event.target.value)}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] p-2.5 text-sm text-neutral-200 outline-none focus:border-[#f97316]"
              >
                <option value="">Sem entregador</option>
                {drivers
                  .filter((driver) => driver.is_active)
                  .map((driver) => (
                    <option key={driver.id} value={driver.id} className="bg-[#161618]">
                      {driver.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Alterar Status</p>
              <div className="flex flex-wrap gap-2">
                {(['aceito', 'preparando', 'enviando', 'entregue', 'recusado', 'cancelado'] as Order['status'][]).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={['recusado', 'cancelado'].includes(status) ? 'danger' : 'secondary'}
                    disabled={updating || selected.status === status}
                    onClick={() => handleStatus(selected.id, status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
