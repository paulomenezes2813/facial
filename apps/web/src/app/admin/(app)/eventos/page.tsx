import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Calendar, CalendarDays, MapPin, Users } from 'lucide-react';
import { adminApi, type AdminEvent } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';
import { EventoDialog } from '@/components/admin/EventoDialog';
import { ExcluirEvento } from '@/components/admin/ExcluirEvento';
import { EventosFiltros } from '@/components/admin/EventosFiltros';

interface PageProps {
  searchParams: { q?: string; periodo?: string };
}

export default async function EventosPage({ searchParams }: PageProps) {
  const token = requireAdminToken();
  const todos = await adminApi.events.list(token);
  const eventos = filtrar(todos, searchParams);

  async function criarEvento(form: FormData) {
    'use server';
    const t = requireAdminToken();
    await adminApi.events.create(t, {
      nome: String(form.get('nome')),
      inicio: new Date(String(form.get('inicio'))).toISOString(),
      fim: new Date(String(form.get('fim'))).toISOString(),
      local: (String(form.get('local') || '') || undefined) as string | undefined,
      retencaoDias: Number(form.get('retencaoDias') || 10),
    });
    revalidatePath('/admin/eventos');
  }

  async function editarEvento(id: string, form: FormData) {
    'use server';
    const t = requireAdminToken();
    await adminApi.events.update(t, id, {
      nome: String(form.get('nome')),
      inicio: new Date(String(form.get('inicio'))).toISOString(),
      fim: new Date(String(form.get('fim'))).toISOString(),
      local: String(form.get('local') || '') || null,
      retencaoDias: Number(form.get('retencaoDias') || 10),
    });
    revalidatePath('/admin/eventos');
  }

  async function excluirEvento(id: string) {
    'use server';
    const t = requireAdminToken();
    await adminApi.events.remove(t, id);
    revalidatePath('/admin/eventos');
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <CalendarDays className="h-6 w-6 text-slate-600" />
            Eventos
          </h1>
          <p className="text-sm text-slate-500">
            {eventos.length} resultado(s) {todos.length !== eventos.length && `· ${todos.length} cadastrado(s)`}
          </p>
        </div>
        <EventoDialog mode="create" onSubmit={criarEvento} />
      </header>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <EventosFiltros />
      </div>

      {eventos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {todos.length === 0
            ? 'Nenhum evento ainda. Clique em Novo evento para começar.'
            : 'Nenhum evento encontrado com os filtros atuais.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Evento</th>
                <th className="px-5 py-3 text-left">Período</th>
                <th className="px-5 py-3 text-left">Local</th>
                <th className="px-5 py-3 text-right">Cadastros</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventos.map((e) => {
                const editar = editarEvento.bind(null, e.id);
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/eventos/${e.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {e.nome}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatPeriod(e.inicio, e.fim)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {e.local ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {e.local}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        <Users className="h-3 w-3" />
                        {e._count?.attendees ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EventoDialog mode="edit" evento={e} onSubmit={editar} />
                        <ExcluirEvento
                          eventoId={e.id}
                          nome={e.nome}
                          totalParticipantes={e._count?.attendees ?? 0}
                          onDelete={excluirEvento}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function filtrar(eventos: AdminEvent[], params: { q?: string; periodo?: string }): AdminEvent[] {
  const agora = Date.now();
  const q = (params.q ?? '').trim().toLowerCase();
  return eventos.filter((e) => {
    if (q) {
      const bag = `${e.nome} ${e.local ?? ''}`.toLowerCase();
      if (!bag.includes(q)) return false;
    }
    if (params.periodo) {
      const inicio = new Date(e.inicio).getTime();
      const fim = new Date(e.fim).getTime();
      if (params.periodo === 'ativos' && !(inicio <= agora && agora <= fim)) return false;
      if (params.periodo === 'futuros' && !(inicio > agora)) return false;
      if (params.periodo === 'encerrados' && !(fim < agora)) return false;
    }
    return true;
  });
}

function formatPeriod(inicio: string, fim: string): string {
  const d1 = new Date(inicio);
  const d2 = new Date(fim);
  const sameDay = d1.toDateString() === d2.toDateString();
  const fmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return sameDay
    ? `${fmt.format(d1)} – ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(d2)}`
    : `${fmt.format(d1)} → ${fmt.format(d2)}`;
}
