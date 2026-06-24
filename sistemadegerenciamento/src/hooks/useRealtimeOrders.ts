import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types';

export function useRealtimeOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toastCbRef = useRef<(msg: string) => void>(() => {});
  const channelNameRef = useRef(`admin-orders-live-${Math.random().toString(36).slice(2)}`);

  const setToastCallback = (cb: (msg: string) => void) => {
    toastCbRef.current = cb;
  };

  useEffect(() => {
    let mounted = true;

    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!mounted) return;

        if (err) {
          setError('Erro ao carregar pedidos');
        } else {
          setOrders((data as Order[]) ?? []);
          setError(null);
        }

        setLoading(false);
      });

    const channel = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as Order;
        setOrders((prev) => {
          if (prev.some((order) => order.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
        toastCbRef.current(`Novo pedido ${newOrder.seq_code}!`);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const updated = payload.new as Order;
        setOrders((prev) => prev.map((order) => (order.id === updated.id ? { ...order, ...updated } : order)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
        const deleted = payload.old as Order;
        setOrders((prev) => prev.filter((order) => order.id !== deleted.id));
      })
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { orders, loading, error, setToastCallback };
}
