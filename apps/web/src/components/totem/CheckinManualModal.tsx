'use client';

import { useEffect, useState } from 'react';
import { Search, UserCheck, X } from 'lucide-react';
import { totemApi, type TotemAttendeeSearch, type CheckinResponse } from '@/lib/api';

interface Props {
  open: boolean;
  token: string;
  onClose: () => void;
  onConfirmed: (res: CheckinResponse) => void;
}

export function CheckinManualModal({ open, token, onClose, onConfirmed }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<TotemAttendeeSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Busca debounced
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await totemApi.searchAttendees(token, q);
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, token]);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setQ('');
      setItems([]);
    }
  }, [open]);

  if (!open) return null;

  async function confirmar(id: string) {
    setConfirmingId(id);
    try {
      const res = await totemApi.checkinManual(token, id);
      onConfirmed(res);
      onClose();
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Check-in manual</h2>
            <p className="text-sm text-slate-500">Busque pelo nome, CPF (3 últimos) ou protocolo.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="border-b border-slate-200 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar participante…"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-400">Buscando…</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              {q ? 'Nenhum participante encontrado.' : 'Digite pra buscar (ou veja os mais recentes).'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((p) => {
                const jaCheckin = p.status === 'CHECKED_IN';
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => confirmar(p.id)}
                      disabled={confirmingId === p.id}
                      className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold text-slate-900">
                          {p.nome} {p.sobrenome}
                        </p>
                        <p className="text-xs text-slate-500">
                          …{p.cpfLast3} · {p.municipio}
                          {p.cargo ? ` · ${p.cargo}` : ''}
                        </p>
                      </div>
                      {jaCheckin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-3 py-1 text-xs font-medium text-success-700">
                          <UserCheck className="h-3 w-3" /> já checado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                          <UserCheck className="h-3 w-3" /> identificar
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
