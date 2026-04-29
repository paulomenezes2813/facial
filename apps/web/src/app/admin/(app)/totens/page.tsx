import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Tv } from 'lucide-react';
import { adminApi, type AdminTotemRich } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';
import { CopiarLink } from '@/components/admin/CopiarLink';
import { EditarTotemInline } from '@/components/admin/EditarTotemInline';
import { ExcluirTotem } from '@/components/admin/ExcluirTotem';
import { TotensFiltros } from '@/components/admin/TotensFiltros';
import { TotemDialog } from '@/components/admin/TotemDialog';

interface PageProps {
  searchParams: { q?: string; eventId?: string };
}

export default async function TotensPage({ searchParams }: PageProps) {
  const token = requireAdminToken();
  const [todos, eventos] = await Promise.all([
    adminApi.totens.listAll(token),
    adminApi.events.list(token),
  ]);
  const totens = filtrar(todos, searchParams);

  async function criar(eventoId: string, nome: string) {
    'use server';
    const t = requireAdminToken();
    await adminApi.totens.create(t, eventoId, nome);
    revalidatePath('/admin/totens');
  }

  async function renomear(id: string, nome: string) {
    'use server';
    const t = requireAdminToken();
    await adminApi.totens.update(t, id, { nome });
    revalidatePath('/admin/totens');
  }

  async function excluir(id: string) {
    'use server';
    const t = requireAdminToken();
    await adminApi.totens.remove(t, id);
    revalidatePath('/admin/totens');
  }

  const eventosLeves = eventos.map((e) => ({ id: e.id, nome: e.nome }));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Tv className="h-6 w-6 text-slate-600" />
            Totens
          </h1>
          <p className="text-sm text-slate-500">
            {totens.length} resultado(s) {todos.length !== totens.length && `· ${todos.length} cadastrado(s)`}
          </p>
        </div>
        <TotemDialog eventos={eventosLeves} onCreate={criar} />
      </header>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <TotensFiltros eventos={eventosLeves} />
      </div>

      {totens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {todos.length === 0
            ? 'Nenhum totem cadastrado. Clique em Novo totem para criar.'
            : 'Nenhum totem encontrado com os filtros atuais.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Evento</th>
                <th className="px-5 py-3 text-left">API key</th>
                <th className="px-5 py-3 text-left">Último sync</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {totens.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <EditarTotemInline totemId={t.id} nomeAtual={t.nome} onSave={renomear} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <Link href={`/admin/eventos/${t.evento.id}`} className="hover:text-brand-700">
                      {t.evento.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <code className="block max-w-[260px] truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                        {t.apiKey}
                      </code>
                      <CopiarLink url={t.apiKey} />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {t.ultimoSync
                      ? new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(t.ultimoSync))
                      : '—'}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <ExcluirTotem totemId={t.id} nome={t.nome} onDelete={excluir} />
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

function filtrar(totens: AdminTotemRich[], params: { q?: string; eventId?: string }) {
  const q = (params.q ?? '').trim().toLowerCase();
  return totens.filter((t) => {
    if (params.eventId && t.evento.id !== params.eventId) return false;
    if (q && !t.nome.toLowerCase().includes(q)) return false;
    return true;
  });
}
