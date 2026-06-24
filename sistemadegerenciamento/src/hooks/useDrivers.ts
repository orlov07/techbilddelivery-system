import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Motoboy } from '../types';

export function useDrivers() {
  const [drivers, setDrivers] = useState<Motoboy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const { data, error: err } = await supabase.from('motoboys').select('*');
    if (err) setError('Erro ao carregar entregadores');
    else setDrivers((data as Motoboy[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const save = async (d: Motoboy) => {
    const payload = { ...d };
    if (!payload.id) delete (payload as Partial<Motoboy>).id;
    const { error: err } = await supabase.from('motoboys').upsert(payload);
    if (err) throw new Error(err.message);
    await refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover entregador?')) return;
    await supabase.from('motoboys').delete().eq('id', id);
    await refresh();
  };

  return { drivers, loading, error, refresh, save, remove };
}
