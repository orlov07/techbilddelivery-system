import { useEffect, useState } from 'react';
import { Save, Store, TimerReset } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { pushToast } from '../components/ui/Toast';
import { useAppSettings } from '../hooks/useAppSettings';
import type { AppSettings } from '../types';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f8aa3]">{label}</span>
      {children}
    </label>
  );
}

export function Settings() {
  const { settings, loading, saving, error, refresh, save } = useAppSettings();
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await save({
        ...draft,
        delivery_fee: Number(draft.delivery_fee) || 0,
        cashback_percent: Number(draft.cashback_percent) || 0,
      });
      pushToast('Configuracoes salvas com sucesso');
    } catch (err) {
      pushToast('Erro ao salvar configuracoes');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-[520px] rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0d1726] to-[#08111d] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[#ff6a00]/12 text-[#ff8a3d]">
              <Store size={26} />
            </div>
            <h2 className="mt-4 text-[28px] font-black tracking-[-0.04em] text-white">Configuracoes da operacao</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#8fa0bb]">
              Ajuste os dados exibidos no delivery e os parametros operacionais usados pelo sistema.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void refresh()}>
              <TimerReset size={16} />
              Recarregar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#08111d] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Nome do estabelecimento">
            <input
              value={draft.establishment_name}
              onChange={(e) => updateField('establishment_name', e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Whatsapp">
            <input
              value={draft.whatsapp}
              onChange={(e) => updateField('whatsapp', e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Horario de funcionamento">
            <input
              value={draft.business_hours}
              onChange={(e) => updateField('business_hours', e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Tempo medio de entrega">
            <input
              value={draft.avg_delivery_time}
              onChange={(e) => updateField('avg_delivery_time', e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Taxa fixa de entrega">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.delivery_fee}
              onChange={(e) => updateField('delivery_fee', Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="PIX chave">
            <input
              value={draft.pix_key}
              onChange={(e) => updateField('pix_key', e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Logo URL">
            <input
              value={draft.logo_url}
              onChange={(e) => updateField('logo_url', e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Banner URL">
            <input
              value={draft.banner_url}
              onChange={(e) => updateField('banner_url', e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Titulo do banner">
            <input
              value={draft.banner_title ?? ''}
              onChange={(e) => updateField('banner_title', e.target.value)}
              placeholder={draft.establishment_name}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Subtitulo do banner">
            <input
              value={draft.banner_subtitle ?? ''}
              onChange={(e) => updateField('banner_subtitle', e.target.value)}
              placeholder="Confira nosso cardapio e peca agora!"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Cashback percentual">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={draft.cashback_percent ?? 0}
              onChange={(e) => updateField('cashback_percent', Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5">
          <Field label="Endereco">
            <textarea
              value={draft.address}
              onChange={(e) => updateField('address', e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>

          <Field label="Codigo PIX">
            <textarea
              value={draft.pix_code}
              onChange={(e) => updateField('pix_code', e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff6a00]/40"
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Loja aberta</p>
            <p className="mt-1 text-xs text-[#8fa0bb]">Controla o status operacional exibido no delivery.</p>
          </div>

          <button
            type="button"
            onClick={() => updateField('is_open', !draft.is_open)}
            className={`relative h-8 w-16 rounded-full transition ${draft.is_open ? 'bg-emerald-500/70' : 'bg-white/10'}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${draft.is_open ? 'left-9' : 'left-1'}`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
