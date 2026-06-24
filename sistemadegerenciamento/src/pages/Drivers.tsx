import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { pushToast } from '../components/ui/Toast';
import { useDrivers } from '../hooks/useDrivers';
import type { Motoboy } from '../types';

const EMPTY: Motoboy = { id: '', name: '', phone: '', email: '', license_plate: '', is_active: true, commission_rate: 5 };

export function Drivers() {
  const { drivers, loading, save, remove } = useDrivers();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Motoboy>(EMPTY);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(form);
      pushToast('Entregador salvo!');
      setModal(false);
    } catch {
      pushToast('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>;

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div>
          <h2 className="font-['Syne'] text-xl font-extrabold text-white">Entregadores</h2>
          <p className="mt-0.5 text-sm text-neutral-500">{drivers.length} cadastrados</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setModal(true); }}><Plus size={14} /> Novo</Button>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.length === 0 && <p className="col-span-full py-10 text-center text-sm text-neutral-600">Nenhum entregador cadastrado</p>}
        {drivers.map((driver) => (
          <div key={driver.id} className="flex flex-col gap-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f97316]/15 font-['Syne'] font-extrabold text-[#f97316]">
                  {driver.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-white">{driver.name}</p>
                  <p className="text-xs text-neutral-500">{driver.phone}</p>
                </div>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${driver.is_active ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400' : 'border-neutral-600/30 bg-neutral-600/20 text-neutral-500'}`}>
                {driver.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="space-y-1 text-xs text-neutral-500">
              <p>{driver.email}</p>
              <p>Placa: <span className="font-mono text-neutral-300">{driver.license_plate}</span></p>
              <p>Comissão: <span className="text-neutral-300">{driver.commission_rate}%</span></p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1 justify-center" onClick={() => { setForm(driver); setModal(true); }}><Pencil size={12} /> Editar</Button>
              <Button size="sm" variant="danger" onClick={() => remove(driver.id)}><Trash2 size={12} /></Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Entregador' : 'Novo Entregador'}>
        <div className="space-y-3">
          {(['name', 'phone', 'email', 'license_plate'] as (keyof Motoboy)[]).map((field) => (
            <div key={String(field)}>
              <label className="mb-1 block text-xs capitalize text-neutral-500">{String(field).replace('_', ' ')}</label>
              <input value={(form[field] as string) ?? ''} onChange={(e) => setForm((current) => ({ ...current, [field]: e.target.value }))} className="w-full rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] p-2.5 text-sm text-white outline-none focus:border-[#f97316]" />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Comissão (%)</label>
            <input type="number" value={form.commission_rate} onChange={(e) => setForm((current) => ({ ...current, commission_rate: Number(e.target.value) }))} className="w-full rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] p-2.5 text-sm text-white outline-none focus:border-[#f97316]" />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))} className="accent-[#f97316]" />
            <span className="text-sm text-neutral-300">Ativo</span>
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setModal(false)}>Cancelar</Button>
            <Button className="flex-1 justify-center" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
