import { useMemo } from 'react';
import { getPreviousRange, resolveDateRange, type DateRangeValue } from '../lib/dateRange';
import type { Order, DashboardStats } from '../types';

export function useDashboardStats(orders: Order[], range: DateRangeValue) {
  return useMemo(() => {
    const currentRange = resolveDateRange(range);
    const previousRange = getPreviousRange(range);

    const todayOrders = orders.filter((order) => {
      const createdAt = new Date(order.created_at);
      return createdAt >= currentRange.start && createdAt <= currentRange.end;
    });

    const yesterdayOrders = orders.filter((order) => {
      const createdAt = new Date(order.created_at);
      return createdAt >= previousRange.start && createdAt <= previousRange.end;
    });

    const countableRevenue = (list: Order[]) =>
      list
        .filter((order) => order.status !== 'cancelado' && order.status !== 'recusado')
        .reduce((total, order) => total + order.total, 0);

    const deliveredOrders = orders.filter(
      (order) => order.status === 'entregue' && order.updated_at && new Date(order.updated_at).getTime() > new Date(order.created_at).getTime(),
    );

    const avgDeliveryMinutes = deliveredOrders.length
      ? deliveredOrders.reduce((sum, order) => {
          const createdAt = new Date(order.created_at).getTime();
          const deliveredAt = new Date(order.updated_at as string).getTime();
          return sum + Math.max(0, deliveredAt - createdAt) / 60000;
        }, 0) / deliveredOrders.length
      : null;

    const stats: DashboardStats = {
      ordersToday: todayOrders.length,
      revenueToday: countableRevenue(todayOrders),
      avgDeliveryMinutes,
      ordersYesterday: yesterdayOrders.length,
      revenueYesterday: countableRevenue(yesterdayOrders),
    };

    return { stats };
  }, [orders, range]);
}
