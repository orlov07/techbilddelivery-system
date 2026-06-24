import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AppSettings } from '../types';

const EMPTY_SETTINGS: AppSettings = {
  establishment_name: 'TechBild Delivery',
  logo_url: '',
  banner_url: '',
  banner_title: '',
  banner_subtitle: '',
  business_hours: '',
  delivery_fee: 0,
  pix_key: '',
  pix_code: '',
  whatsapp: '',
  address: '',
  avg_delivery_time: '',
  is_open: false,
  cashback_percent: 2,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (err) {
      setError('Erro ao carregar configuracoes');
      setSettings(EMPTY_SETTINGS);
    } else {
      setError(null);
      setSettings((data as AppSettings) ?? EMPTY_SETTINGS);
    }

    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (next: AppSettings) => {
    setSaving(true);
    const payload = { id: 1, ...next };
    const { error: err } = await supabase.from('app_settings').upsert(payload);
    setSaving(false);

    if (err) {
      throw new Error(err.message);
    }

    setSettings(next);
    setError(null);
  };

  return { settings, loading, saving, error, refresh, save };
}
