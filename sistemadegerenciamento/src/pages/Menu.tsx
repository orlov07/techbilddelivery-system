import { useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { pushToast } from '../components/ui/Toast';
import type { Product } from '../types';

const EMPTY: Product = { id: '', name: '', description: '', price: 0, promo_price: undefined, category: '', image_url: '', is_active: true, stock_quantity: 99, is_promo: false };

export function Menu() {
  const { products, loading, save, remove } = useProducts();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Product>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState('');

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const filtered = catFilter ? products.filter((p) => p.category === catFilter) : products;

  const openEdit = (p: Product) => { setForm(p); setModal(true); };
  const openNew  = () => { setForm(EMPTY); setModal(true); };

  const handleSave = async () => {
    setSaving(true);
    try { await save(form); pushToast('Produto salvo!'); setModal(false); }
    catch (e) { pushToast('Erro ao salvar produto'); console.error(e); }
    finally { setSaving(false); }
  };

  const handleToggle = async (p: Product) => {
    try { await save({ ...p, is_active: !p.is_active }); pushToast(p.is_active ? 'Produto desativado' : 'Produto ativado'); }
    catch { pushToast('Erro ao atualizar produto'); }
  };

  if (loading) return <div className="space-y-3">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div>
          <h2 className="font-['Syne'] text-xl font-extrabold text-white">Cardápio</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{products.length} produtos</p>
        </div>
        <Button onClick={openNew}><Plus size={14} /> Novo Produto</Button>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCatFilter('')} className={`rounded-full px-3 py-1 text-xs font-medium border transition ${!catFilter ? 'bg-[#f97316] text-white border-[#f97316]' : 'border-[rgba(255,255,255,0.1)] text-neutral-400 hover:text-white'}`}>Todos</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCatFilter(c === catFilter ? '' : c)} className={`rounded-full px-3 py-1 text-xs font-medium border transition ${catFilter === c ? 'bg-[#f97316] text-white border-[#f97316]' : 'border-[rgba(255,255,255,0.1)] text-neutral-400 hover:text-white'}`}>{c}</button>
          ))}
        </div>
      )}

      <div className="min-w-0 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] overflow-hidden">
        <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.05)] text-[10px] uppercase tracking-wider text-neutral-600">
              <th className="px-5 py-3 text-left">Produto</th>
              <th className="px-5 py-3 text-left hidden md:table-cell">Categoria</th>
              <th className="px-5 py-3 text-right">Preço</th>
              <th className="px-5 py-3 text-center">Estoque</th>
              <th className="px-5 py-3 text-center">Ativo</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-neutral-600">Nenhum produto</td></tr>}
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[#1e1e21] transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover bg-[#2a2a2e]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="h-10 w-10 rounded-lg bg-[#2a2a2e]" />}
                    <div>
                      <p className="font-medium text-neutral-200">{p.name}</p>
                      {p.is_promo && <span className="text-[10px] text-[#f97316]">Promoção</span>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-neutral-400 text-xs hidden md:table-cell">{p.category}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-white">R$ {p.price.toFixed(2).replace('.', ',')}</td>
                <td className="px-5 py-3.5 text-center text-neutral-400">{p.stock_quantity}</td>
                <td className="px-5 py-3.5 text-center">
                  <button onClick={() => handleToggle(p)} className={`transition ${p.is_active ? 'text-emerald-400' : 'text-neutral-600'}`}>
                    {p.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil size={13} /></Button>
                    <Button size="sm" variant="danger" onClick={() => remove(p.id)}><Trash2 size={13} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-3">
          {(['name', 'description', 'category', 'image_url'] as (keyof Product)[]).map((field) => (
            <div key={String(field)}>
              <label className="text-xs text-neutral-500 capitalize mb-1 block">{String(field).replace('_', ' ')}</label>
              <input
                value={(form[field] as string) ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] p-2.5 text-sm text-white outline-none focus:border-[#f97316] transition"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">Preço (R$)</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} className="w-full rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] p-2.5 text-sm text-white outline-none focus:border-[#f97316]" />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">Estoque</label>
              <input type="number" value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: Number(e.target.value) }))} className="w-full rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0e0e0f] p-2.5 text-sm text-white outline-none focus:border-[#f97316]" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="accent-[#f97316]" />
            <span className="text-sm text-neutral-300">Produto ativo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_promo} onChange={(e) => setForm((f) => ({ ...f, is_promo: e.target.checked }))} className="accent-[#f97316]" />
            <span className="text-sm text-neutral-300">Promoção</span>
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
