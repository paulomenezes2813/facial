'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Clock, Filter, Tv, UserSearch } from 'lucide-react';
import { adminApi, type AdminCheckin } from '@/lib/api';

interface Props {
  token: string;
  eventId: string;
  /** Lista de dias com check-ins (vem do server). */
  dias: { dia: string; total: number }[];
  totens: { id: string; nome: string }[];
}

export function HistoricoCheckinsEvento({ token, eventId, dias, totens }: Props) {
  const padrao = dias.at(-1)?.dia ?? '';
  const [diaSel, setDiaSel] = useState(padrao);
  const [tipo, setTipo] = useState<'' | 'AUTO' | 'MANUAL'>('');
  const [totemId, setTotemId] = useState('');
  const [items, setItems] = useState<AdminCheckin[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.checkins
      .byEvent(token, eventId, {
        dia: diaSel || undefined,
        tipo: tipo || undefined,
        totemId: totemId || undefined,
      })
      .then((r) => {
        if (!cancelled) setItems(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, eventId, diaSel, tipo, totemId]);

  const totalDoDia = useMemo(
    () => dias.find((d) => d.dia === diaSel)?.total ?? 0,
    [dias, diaSel],
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-600" />
          <h2 className="font-bold text-slate-900">Histórico de check-ins</h2>
        </div>
        <span className="text-xs text-slate-500">
          {items.length} no filtro {totalDoDia ? `· ${totalDoDia} no dia` : ''}
        </span>
      </header>

      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <Clock className="h-3 w-3" /> Dia
          </label>
          <select
            value={diaSel}
            onChange={(e) => setDiaSel(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">Todos os dias</option>
            {dias.map((d) => (
              <option key={d.dia} value={d.dia}>
                {formatDia(d.dia)} ({d.total})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <Filter className="h-3 w-3" /> Tipo
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as any)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">Todos</option>
            <option value="AUTO">Automático (face)</option>
            <option value="MANUAL">Manual (busca)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <Tv className="h-3 w-3" /> Totem
          </label>
          <select
            value={totemId}
            onChange={(e) => setTotemId(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">Todos</option>
            {totens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        {loading && <span className="text-xs text-slate-400">carregando…</span>}
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Nenhum check-in no filtro selecionado.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-white text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left">Quando</th>
              <th className="px-5 py-3 text-left">Participante</th>
              <th className="px-5 py-3 text-left">Totem</th>
              <th className="px-5 py-3 text-left">Tipo</th>
              <th className="px-5 py-3 text-right">Similaridade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-700">
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  }).format(new Date(c.registradoEm))}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/participantes/${c.attendee.id}`}
                    className="font-medium text-slate-900 hover:text-brand-700"
                  >
                    {c.attendee.nome} {c.attendee.sobrenome}
                  </Link>
                  <div className="text-xs text-slate-500">
                    …{c.attendee.cpfLast3}
                    {c.attendee.cargo ? ` · ${c.attendee.cargo}` : ''}
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-600">{c.totem?.nome ?? '—'}</td>
                <td className="px-5 py-3">
                  <TipoBadge tipo={c.tipo} />
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs text-slate-600">
                  {c.similarity != null ? c.similarity.toFixed(3) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function TipoBadge({ tipo }: { tipo: 'AUTO' | 'MANUAL' }) {
  if (tipo === 'AUTO') {
    return (
      <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-xs font-medium text-success-700">
        Face
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      <UserSearch className="h-3 w-3" /> Manual
    </span>
  );
}

function formatDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}
