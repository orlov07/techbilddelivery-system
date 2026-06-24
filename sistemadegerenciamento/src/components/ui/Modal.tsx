import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; }

export function Modal({ open, onClose, title, children, wide }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] shadow-2xl max-h-[90vh] overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] px-5 py-4 sticky top-0 bg-[#161618]">
          <h3 className="font-semibold text-white text-sm">{title}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition p-1 rounded"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
