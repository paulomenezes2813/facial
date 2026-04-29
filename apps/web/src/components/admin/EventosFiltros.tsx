'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';

export function EventosFiltros() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function applyParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`/admin/eventos?${next.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-600">Buscar</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            defaultValue={sp.get('q') ?? ''}
            placeholder="Nome do evento ou local…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyParam('q', (e.target as HTMLInputElement).value);
            }}
            onBlur={(e) => applyParam('q', e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Período</label>
        <select
          defaultValue={sp.get('periodo') ?? ''}
          onChange={(e) => applyParam('periodo', e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Todos</option>
          <option value="ativos">Em andamento</option>
          <option value="futuros">Futuros</option>
          <option value="encerrados">Encerrados</option>
        </select>
      </div>
      {pending && <span className="text-xs text-slate-400">filtrando…</span>}
    </div>
  );
}
