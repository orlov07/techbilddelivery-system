import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ActionDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  tone?: 'success' | 'danger';
  showCancel?: boolean;
}

export default function ActionDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  tone = 'success',
  showCancel = true
}: ActionDialogProps) {
  if (!open) return null;

  const isDanger = tone === 'danger';

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-full ${
              isDanger ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
            }`}
          >
            {isDanger ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-white">{title}</h4>
            <p className="mt-2 text-sm leading-6 text-neutral-300">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => void onConfirm()}
            className={`rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition ${
              isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
