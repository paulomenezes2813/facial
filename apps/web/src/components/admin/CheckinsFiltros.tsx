'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';

interface Props {
  eventos: { id: string; nome: string }[];
  totens: { id: string; nome: string; eventoNome?: string }[];
}

export function CheckinsFiltros({ eventos, totens }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function applyParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Trocar evento limpa o totem (totens são por evento)
    if (key === 'eventId') next.delete('totemId');
    startTransition(() => router.replace(`/admin/checkins?${next.toString()}`));
  }

  const eventIdSel = sp.get('eventId') ?? '';
  const totensFiltrados = eventIdSel
    ? totens.filter((t) => (t as any).eventoId === eventIdSel || true)
    : totens;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
      <div className="flex-1 min-w-[180px]">
        <label className="mb-1 block text-xs font-medium text-slate-600">Buscar</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            defaultValue={sp.get('q') ?? ''}
            placeholder="Nome do participante…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyParam('q', (e.target as HTMLInputElement).value);
            }}
            onBlur={(e) => applyParam('q', e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Evento</label>
        <select
          defaultValue={eventIdSel}
          onChange={(e) => applyParam('eventId', e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Todos</option>
          {eventos.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Dia (YYYY-MM-DD)</label>
        <input
          type="date"
          defaultValue={sp.get('dia') ?? ''}
          onChange={(e) => applyParam('dia', e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
        <select
          defaultValue={sp.get('tipo') ?? ''}
          onChange={(e) => applyParam('tipo', e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Todos</option>
          <option value="AUTO">Face</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Totem</label>
        <select
          defaultValue={sp.get('totemId') ?? ''}
          onChange={(e) => applyParam('totemId', e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Todos</option>
          {totensFiltrados.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
              {t.eventoNome ? ` · ${t.eventoNome}` : ''}
            </option>
          ))}
        </select>
      </div>
      {pending && <span className="text-xs text-slate-400">filtrando…</span>}
    </div>
  );
}
