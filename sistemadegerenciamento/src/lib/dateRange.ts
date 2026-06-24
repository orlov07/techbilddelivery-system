import type { Order } from '../types';

export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

export interface DateRangeValue {
  preset: DatePreset;
  startDate?: string;
  endDate?: string;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveDateRange(range: DateRangeValue, now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (range.preset === 'today') return { start: todayStart, end: todayEnd };

  if (range.preset === 'yesterday') {
    const yesterday = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
  }

  if (range.preset === 'last7') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return { start, end: todayEnd };
  }

  if (range.preset === 'last30') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 29);
    return { start, end: todayEnd };
  }

  const start = range.startDate ? startOfDay(new Date(`${range.startDate}T00:00:00`)) : todayStart;
  const end = range.endDate ? endOfDay(new Date(`${range.endDate}T00:00:00`)) : todayEnd;

  return start <= end ? { start, end } : { start: endOfDay(end), end: startOfDay(start) };
}

export function filterOrdersByRange(orders: Order[], range: DateRangeValue) {
  const { start, end } = resolveDateRange(range);
  return orders.filter((order) => {
    const createdAt = new Date(order.created_at);
    return createdAt >= start && createdAt <= end;
  });
}

export function getPreviousRange(range: DateRangeValue, now = new Date()) {
  const { start, end } = resolveDateRange(range, now);
  const span = end.getTime() - start.getTime() + 1;
  return {
    start: new Date(start.getTime() - span),
    end: new Date(end.getTime() - span),
  };
}

export function getDateRangeLabel(range: DateRangeValue, now = new Date()) {
  const fmtLong = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
  const fmtShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

  if (range.preset === 'today') return `Hoje, ${fmtLong.format(now)}`;
  if (range.preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return `Ontem, ${fmtLong.format(yesterday)}`;
  }
  if (range.preset === 'last7') return 'Ultimos 7 dias';
  if (range.preset === 'last30') return 'Ultimos 30 dias';

  const { start, end } = resolveDateRange(range, now);
  return `${fmtShort.format(start)} - ${fmtShort.format(end)}`;
}

export function getDefaultCustomRange(now = new Date()) {
  return {
    startDate: toInputDate(now),
    endDate: toInputDate(now),
  };
}
