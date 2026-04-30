import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Pencil, Users } from 'lucide-react';
import { adminApi, type AttendeeStatus } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';
import { ParticipantesFiltros } from '@/components/admin/ParticipantesFiltros';
import { ExcluirParticipante } from '@/components/admin/ExcluirParticipante';
import { ParticipanteDialog } from '@/components/admin/ParticipanteDialog';
import { ReindexarPendentes } from '@/components/admin/ReindexarPendentes';
import { api } from '@/lib/api';

interface PageProps {
  searchParams: { q?: string; eventId?: string; status?: string };
}

export default async function ParticipantesPage({ searchParams }: PageProps) {
  const token = requireAdminToken();
  const [eventos, participantes] = await Promise.all([
    adminApi.events.list(token),
    adminApi.attendees.list(token, {
      eventId: searchParams.eventId,
      status: searchParams.status,
      q: searchParams.q,
    }),
  ]);

  // Lista de pendentes é "best-effort": se a API ainda não tem o endpoint
  // (ex: não foi reiniciada após adicionar a rota), a página não quebra —
  // apenas o card "Re-indexar todos" não aparece.
  let pendentes: Awaited<ReturnType<typeof adminApi.attendees.listPendentes>> = [];
  try {
    pendentes = await adminApi.attendees.listPendentes(token, searchParams.eventId);
  } catch (e) {
    // Silencioso por design — não polui o log do server em dev.
  }

  async function excluir(id: string) {
    'use server';
    const t = requireAdminToken();
    await adminApi.attendees.remove(t, id);
    revalidatePath('/admin/participantes');
  }

  async function reindexarTodos() {
    'use server';
    const t = requireAdminToken();
    const result = await adminApi.attendees.enrollPendentes(t, searchParams.eventId);
    revalidatePath('/admin/participantes');
    return result;
  }

  async function criar(form: FormData): Promise<{ id: string; protocolo: string }> {
    'use server';
    // O endpoint /attendees/register é público (não exige JWT) — passa pelo CORS normal.
    const result = await api.register({
      eventoId: String(form.get('eventoId')),
      nome: String(form.get('nome')),
      sobrenome: String(form.get('sobrenome')),
      cpf: String(form.get('cpf')),
      dataNascimento: String(form.get('dataNascimento')),
      cargo: (String(form.get('cargo') || '') || null) as string | null,
      email: String(form.get('email')),
      celular: String(form.get('celular')),
      municipio: String(form.get('municipio')),
      consentimentoLgpd: true,
    });
    revalidatePath('/admin/participantes');
    return result;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Users className="h-6 w-6 text-slate-600" />
            Participantes
          </h1>
          <p className="text-sm text-slate-500">{participantes.length} resultado(s).</p>
        </div>
        <ParticipanteDialog
          eventos={eventos.map((e) => ({ id: e.id, nome: e.nome }))}
          onCreate={criar}
        />
      </header>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <ParticipantesFiltros eventos={eventos.map((e) => ({ id: e.id, nome: e.nome }))} />
      </div>

      {pendentes.length > 0 && (
        <div className="mb-5">
          <ReindexarPendentes onRun={reindexarTodos} totalPendentes={pendentes.length} />
        </div>
      )}

      {participantes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nenhum participante encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Evento</th>
                <th className="px-5 py-3 text-left">Cidade</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Cadastrado</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participantes.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/participantes/${p.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {p.nome} {p.sobrenome}
                    </Link>
                    <div className="text-xs text-slate-500">
                      …{p.cpfLast3} · {p.email}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <Link
                      href={`/admin/eventos/${p.eventId}`}
                      className="hover:text-brand-700"
                    >
                      {p.evento?.nome ?? '—'}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.municipio}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(p.criadoEm))}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/participantes/${p.id}`}
                        className="rounded p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                        title="Abrir / editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <ExcluirParticipante
                        attendeeId={p.id}
                        nome={`${p.nome} ${p.sobrenome}`}
                        onDelete={excluir}
                      />
                    </div>
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

function StatusBadge({ status }: { status: AttendeeStatus }) {
  const map: Record<AttendeeStatus, { label: string; cls: string }> = {
    PENDING_PHOTOS: { label: 'Aguardando fotos', cls: 'bg-amber-50 text-amber-700' },
    PRE_REGISTERED: { label: 'Pré-cadastrado', cls: 'bg-brand-50 text-brand-700' },
    CHECKED_IN: { label: 'Check-in', cls: 'bg-success-500/10 text-success-600' },
    DELETED: { label: 'Excluído', cls: 'bg-slate-100 text-slate-500' },
  };
  const v = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}
