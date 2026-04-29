'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';

interface Props {
  eventos: { id: string; nome: string }[];
}

export function ParticipantesFiltros({ eventos }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function applyParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`/admin/participantes?${next.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-600">Buscar</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            defaultValue={sp.get('q') ?? ''}
            placeholder="Nome, e-mail, protocolo, últimos 3 do CPF…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyParam('q', (e.target as HTMLInputElement).value);
            }}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Evento</label>
        <select
          defaultValue={sp.get('eventId') ?? ''}
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
        <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
        <select
          defaultValue={sp.get('status') ?? ''}
          onChange={(e) => applyParam('status', e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Todos</option>
          <option value="PENDING_PHOTOS">Aguardando fotos</option>
          <option value="PRE_REGISTERED">Pré-cadastrado</option>
          <option value="CHECKED_IN">Check-in feito</option>
        </select>
      </div>
      {pending && <span className="text-xs text-slate-400">filtrando…</span>}
    </div>
  );
}
