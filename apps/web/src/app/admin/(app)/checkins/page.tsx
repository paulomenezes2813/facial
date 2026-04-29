import Link from 'next/link';
import { Activity, UserSearch } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';
import { CheckinsFiltros } from '@/components/admin/CheckinsFiltros';

interface PageProps {
  searchParams: {
    eventId?: string;
    dia?: string;
    tipo?: 'AUTO' | 'MANUAL';
    totemId?: string;
    q?: string;
  };
}

export default async function CheckinsPage({ searchParams }: PageProps) {
  const token = requireAdminToken();
  const [checkins, eventos, totens] = await Promise.all([
    adminApi.checkins.list(token, searchParams),
    adminApi.events.list(token),
    adminApi.totens.listAll(token),
  ]);

  const totensSel = searchParams.eventId
    ? totens.filter((t) => t.evento.id === searchParams.eventId)
    : totens;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Activity className="h-6 w-6 text-slate-600" />
          Check-ins
        </h1>
        <p className="text-sm text-slate-500">
          {checkins.length} resultado(s){checkins.length === 500 && ' (limite)'}.
        </p>
      </header>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <CheckinsFiltros
          eventos={eventos.map((e) => ({ id: e.id, nome: e.nome }))}
          totens={totensSel.map((t) => ({ id: t.id, nome: t.nome, eventoNome: t.evento.nome }))}
        />
      </div>

      {checkins.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nenhum check-in encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Quando</th>
                <th className="px-5 py-3 text-left">Participante</th>
                <th className="px-5 py-3 text-left">Evento</th>
                <th className="px-5 py-3 text-left">Totem</th>
                <th className="px-5 py-3 text-left">Tipo</th>
                <th className="px-5 py-3 text-right">Similar.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checkins.map((c) => (
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
                  <td className="px-5 py-3 text-slate-600">
                    <Link href={`/admin/eventos/${c.evento.id}`} className="hover:text-brand-700">
                      {c.evento.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.totem?.nome ?? '—'}</td>
                  <td className="px-5 py-3">
                    {c.tipo === 'AUTO' ? (
                      <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-xs font-medium text-success-700">
                        Face
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <UserSearch className="h-3 w-3" /> Manual
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-slate-600">
                    {c.similarity != null ? c.similarity.toFixed(3) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
