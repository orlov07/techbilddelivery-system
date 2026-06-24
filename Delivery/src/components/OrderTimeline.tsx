import { Check, Clock, X as XIcon } from 'lucide-react';
import type { Order } from '../types';

interface Step {
  status: Order['status'];
  label: string;
  icon: string;
}

const STEPS: Step[] = [
  { status: 'pendente',   label: 'Pedido recebido',      icon: '📋' },
  { status: 'aceito',     label: 'Aceito pela cozinha',  icon: '✅' },
  { status: 'preparando', label: 'Em preparo',           icon: '👨‍🍳' },
  { status: 'enviando',   label: 'Saiu para entrega',    icon: '🛵' },
  { status: 'entregue',   label: 'Entregue',             icon: '🎉' },
];

const STATUS_ORDER: Partial<Record<Order['status'], number>> = {
  pendente: 0, aceito: 1, preparando: 2, enviando: 3, entregue: 4,
};

interface Props {
  order: Order;
  avgDeliveryTime?: string;
}

export default function OrderTimeline({ order, avgDeliveryTime }: Props) {
  const isCancelled = order.status === 'cancelado' || order.status === 'recusado';
  const currentIdx  = STATUS_ORDER[order.status] ?? -1;

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3">
        <XIcon className="h-4 w-4 shrink-0 text-red-400" />
        <div>
          <p className="text-xs font-semibold text-red-300 capitalize">{order.status}</p>
          <p className="text-[10px] text-red-400/70">Este pedido foi {order.status}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-1">
      {STEPS.map((step, idx) => {
        const done    = currentIdx > idx;
        const active  = currentIdx === idx;
        const pending = currentIdx < idx;

        return (
          <div key={step.status} className="flex items-start gap-3">
            {/* Connector column */}
            <div className="flex flex-col items-center">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors ${
                done   ? 'bg-green-600 text-white' :
                active ? 'bg-orange-500 text-white animate-pulse' :
                         'bg-neutral-800 text-neutral-600'
              }`}>
                {done ? <Check className="h-3.5 w-3.5" /> : step.icon}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`mt-0.5 w-0.5 flex-1 rounded-full transition-colors ${done ? 'bg-green-700' : 'bg-neutral-800'}`} style={{ minHeight: '16px' }} />
              )}
            </div>

            {/* Label */}
            <div className="pb-2 pt-0.5">
              <p className={`text-[11px] font-semibold leading-tight ${
                done   ? 'text-green-400' :
                active ? 'text-orange-300' :
                         'text-neutral-600'
              }`}>
                {step.label}
              </p>
              {active && avgDeliveryTime && (step.status === 'enviando' || step.status === 'preparando') && (
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
                  <Clock className="h-2.5 w-2.5" /> Tempo estimado: {avgDeliveryTime}
                </p>
              )}
              {active && !pending && step.status === 'pendente' && (
                <p className="mt-0.5 text-[10px] text-neutral-500">Aguardando confirmação...</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
