import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { useDateRange } from '../contexts/DateRangeContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import { filterOrdersByRange, getDateRangeLabel, resolveDateRange } from '../lib/dateRange';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabase';

type OrderItemRow = {
  order_id: string;
  product_name: string;
  quantity: number;
  total: number;
};

const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fcd34d', '#86efac'];
const PAYMENT_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#eab308', '#a855f7'];

const paymentLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function Reports() {
  const { orders, loading } = useRealtimeOrders();
  const { range } = useDateRange();
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadOrderItems = async () => {
      setItemsLoading(true);
      const { data, error } = await supabase.from('order_items').select('order_id, product_name, quantity, total');

      if (!active) return;

      if (error) {
        console.error('Erro ao carregar itens dos pedidos', error);
        setOrderItems([]);
      } else {
        setOrderItems((data as OrderItemRow[]) ?? []);
      }

      setItemsLoading(false);
    };

    void loadOrderItems();

    return () => {
      active = false;
    };
  }, []);

  const filteredOrders = useMemo(() => filterOrdersByRange(orders, range), [orders, range]);
  const deliveredOrders = useMemo(
    () => filteredOrders.filter((order) => order.status === 'entregue'),
    [filteredOrders],
  );

  const filteredOrderIds = useMemo(
    () => new Set(filteredOrders.map((order) => order.id)),
    [filteredOrders],
  );

  const filteredItems = useMemo(
    () => orderItems.filter((item) => filteredOrderIds.has(item.order_id)),
    [filteredOrderIds, orderItems],
  );

  const chartData = useMemo(() => {
    const { start, end } = resolveDateRange(range);
    const revenueMap: Record<string, number> = {};
    const ordersMap: Record<string, number> = {};

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = new Date(cursor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      revenueMap[key] = 0;
      ordersMap[key] = 0;
    }

    filteredOrders.forEach((order) => {
      const key = new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!(key in revenueMap)) return;

      ordersMap[key] = (ordersMap[key] || 0) + 1;
      if (order.status === 'entregue') {
        revenueMap[key] = (revenueMap[key] || 0) + order.total;
      }
    });

    return Object.entries(revenueMap).map(([date, revenue]) => ({
      date,
      revenue: Number(revenue.toFixed(2)),
      pedidos: ordersMap[date] || 0,
    }));
  }, [filteredOrders, range]);

  const revenueLineData =
    chartData.length === 1
      ? [
          { ...chartData[0], date: 'Anterior', revenue: 0, pedidos: 0 },
          chartData[0],
          { ...chartData[0], date: 'Seguinte', revenue: 0, pedidos: 0 },
        ]
      : chartData;

  const ordersByType = useMemo(
    () => [
      { name: 'Delivery', value: filteredOrders.filter((order) => order.type === 'delivery').length },
      { name: 'Retirada', value: filteredOrders.filter((order) => order.type === 'retirada').length },
      { name: 'Mesa', value: filteredOrders.filter((order) => order.type === 'mesa').length },
    ].filter((entry) => entry.value > 0),
    [filteredOrders],
  );

  const paymentData = useMemo(() => {
    const grouped = deliveredOrders.reduce<Record<string, number>>((accumulator, order) => {
      const key = paymentLabel(order.payment_method);
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [deliveredOrders]);

  const topProducts = useMemo(() => {
    const grouped = filteredItems.reduce<Record<string, { quantity: number; total: number }>>((accumulator, item) => {
      const current = accumulator[item.product_name] || { quantity: 0, total: 0 };
      current.quantity += item.quantity;
      current.total += item.total;
      accumulator[item.product_name] = current;
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .map(([name, totals]) => ({ name, ...totals }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredItems]);

  const topCustomers = useMemo(() => {
    const grouped = deliveredOrders.reduce<Record<string, { orders: number; total: number }>>((accumulator, order) => {
      const key = order.customer_name || 'Cliente sem nome';
      const current = accumulator[key] || { orders: 0, total: 0 };
      current.orders += 1;
      current.total += order.total;
      accumulator[key] = current;
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .map(([name, totals]) => ({ name, ...totals }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [deliveredOrders]);

  const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
  const totalOrders = filteredOrders.length;
  const ticketAverage = deliveredOrders.length ? totalRevenue / deliveredOrders.length : 0;
  const rangeLabel = getDateRangeLabel(range);

  const tooltipStyle = {
    background: '#161618',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 12,
  };

  if (loading || itemsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div>
          <h2 className="font-['Syne'] text-xl font-extrabold text-white">Relatorios</h2>
          <p className="mt-0.5 text-sm text-neutral-500">Analise comercial e operacional</p>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#161618] px-4 py-2 text-xs font-medium text-neutral-300">
          {rangeLabel}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Pedidos', value: String(totalOrders) },
          { label: 'Faturamento', value: `R$ ${totalRevenue.toFixed(2).replace('.', ',')}` },
          { label: 'Entregues', value: String(deliveredOrders.length) },
          { label: 'Ticket medio', value: `R$ ${ticketAverage.toFixed(2).replace('.', ',')}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-4">
            <p className="mb-1 text-xs text-neutral-500">{label}</p>
            <p className="font-['Syne'] text-xl font-extrabold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
        <p className="mb-4 text-sm font-semibold text-white">Faturamento por Dia</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={revenueLineData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, _name, item) => {
                if (item?.payload?.date === 'Anterior' || item?.payload?.date === 'Seguinte') {
                  return ['R$ 0,00', 'Faturamento'];
                }
                return [`R$ ${value.toFixed(2)}`, 'Faturamento'];
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#f97316"
              strokeWidth={3}
              dot={{ r: 3, fill: '#f97316', stroke: '#161618', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Pedidos por Dia</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} />
              <YAxis tick={{ fill: '#555', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pedidos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Pedidos por Tipo</p>
          {ordersByType.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-600">Sem dados no periodo</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={ordersByType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
                  {ordersByType.map((_entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#888' }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Pagamentos Concluidos</p>
          {paymentData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-neutral-600">Sem pagamentos no periodo</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78}>
                  {paymentData.map((_entry, index) => (
                    <Cell key={index} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#888' }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Produtos Mais Vendidos</p>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-neutral-600">Sem itens no periodo</div>
            ) : (
              topProducts.map((product, index) => (
                <div key={product.name} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111214] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {index + 1}. {product.name}
                      </p>
                      <p className="text-xs text-neutral-500">{product.quantity} unidade(s)</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-400">R$ {product.total.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Top Clientes por Faturamento</p>
          <div className="space-y-3">
            {topCustomers.length === 0 ? (
              <div className="text-sm text-neutral-600">Sem clientes no periodo</div>
            ) : (
              topCustomers.map((customer, index) => (
                <div key={customer.name} className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111214] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {index + 1}. {customer.name}
                    </p>
                    <p className="text-xs text-neutral-500">{customer.orders} pedido(s) entregue(s)</p>
                  </div>
                  <span className="text-sm font-semibold text-orange-400">R$ {customer.total.toFixed(2).replace('.', ',')}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-5">
          <p className="mb-4 text-sm font-semibold text-white">Resumo Rapido</p>
          <div className="space-y-3 text-sm">
            {[
              ['Pedidos cancelados', String(filteredOrders.filter((order) => order.status === 'cancelado').length)],
              ['Pedidos recusados', String(filteredOrders.filter((order) => order.status === 'recusado').length)],
              ['Pedidos delivery', String(filteredOrders.filter((order) => order.type === 'delivery').length)],
              ['Pedidos retirada', String(filteredOrders.filter((order) => order.type === 'retirada').length)],
              ['Pedidos mesa', String(filteredOrders.filter((order) => order.type === 'mesa').length)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111214] px-4 py-3">
                <span className="text-neutral-400">{label}</span>
                <strong className="font-['Syne'] text-lg text-white">{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
