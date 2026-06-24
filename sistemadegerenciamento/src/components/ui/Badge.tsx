export type BadgeVariant = 'orange' | 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'gray';

interface Props { label: string; variant: BadgeVariant; }

const MAP: Record<BadgeVariant, string> = {
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  green:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  red:    'bg-red-500/15 text-red-400 border-red-500/30',
  blue:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  gray:   'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
};

export function Badge({ label, variant }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${MAP[variant]}`}>
      {label}
    </span>
  );
}

export function orderStatusBadge(status: string): { label: string; variant: BadgeVariant } {
  const m: Record<string, { label: string; variant: BadgeVariant }> = {
    pendente:   { label: 'Aguardando', variant: 'yellow' },
    aceito:     { label: 'Aceito',     variant: 'blue' },
    recusado:   { label: 'Recusado',   variant: 'red' },
    preparando: { label: 'Preparando', variant: 'orange' },
    enviando:   { label: 'Em rota',    variant: 'purple' },
    entregue:   { label: 'Entregue',   variant: 'green' },
    cancelado:  { label: 'Cancelado',  variant: 'red' },
  };
  return m[status] ?? { label: status, variant: 'gray' };
}
