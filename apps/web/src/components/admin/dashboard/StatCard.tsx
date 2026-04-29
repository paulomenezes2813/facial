import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'brand' | 'success' | 'amber' | 'rose';

interface Props {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
  tone?: Tone;
}

const toneMap: Record<Tone, { bg: string; text: string }> = {
  neutral: { bg: 'bg-slate-100', text: 'text-slate-600' },
  brand: { bg: 'bg-brand-50', text: 'text-brand-600' },
  success: { bg: 'bg-success-500/10', text: 'text-success-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600' },
};

export function StatCard({ label, value, hint, icon, tone = 'neutral' }: Props) {
  const t = toneMap[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', t.bg, t.text)}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
