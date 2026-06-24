import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ToastMsg { id: number; text: string; }

let _push: (msg: string) => void = () => {};
export const pushToast = (msg: string) => _push(msg);

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    _push = (text: string) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, text }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#1e1e21] px-4 py-3 shadow-2xl text-sm text-white max-w-xs">
          <span className="flex-1">{t.text}</span>
          <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-neutral-500 hover:text-white"><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}
