import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const { data, error: err } = await supabase.from('products').select('*').order('name');
    if (err) setError('Erro ao carregar produtos');
    else setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const save = async (product: Product) => {
    const payload = { ...product, id: product.id || undefined };
    if (!payload.id) delete (payload as Partial<Product>).id;
    const { error: err } = await supabase.from('products').upsert(payload);
    if (err) throw new Error(err.message);
    await refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir produto permanentemente?')) return;
    await supabase.from('products').delete().eq('id', id);
    await refresh();
  };

  return { products, loading, error, refresh, save, remove };
}
