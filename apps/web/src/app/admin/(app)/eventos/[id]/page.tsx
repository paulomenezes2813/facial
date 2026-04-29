import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Hourglass,
  Link2,
  MapPin,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { adminApi, ApiError, type AttendeeStatus } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';
import { CopiarLink } from '@/components/admin/CopiarLink';
import { ExcluirParticipante } from '@/components/admin/ExcluirParticipante';
import { TotensCard } from '@/components/admin/TotensCard';
import { HistoricoCheckinsEvento } from '@/components/admin/HistoricoCheckinsEvento';

export default async function EventoDetalhe({ params }: { params: { id: string } }) {
  const token = requireAdminToken();
  let evento;
  try {
    evento = await adminApi.events.byId(token, params.id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const participantes = await adminApi.attendees.listByEvent(token, params.id);
  const totens = await adminApi.totens.listByEvent(token, params.id);
  const dias = await adminApi.checkins.days(token, params.id);

  const linkPublico = `/credenciamento/${evento.id}`;
  // Em produção, prefixar com NEXT_PUBLIC_BASE_URL.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const fullUrl = baseUrl ? `${baseUrl}${linkPublico}` : linkPublico;

  async function excluirAttendee(id: string) {
    'use server';
    const t = requireAdminToken();
    await adminApi.attendees.remove(t, id);
    revalidatePath(`/admin/eventos/${params.id}`);
  }

  async function criarTotem(form: FormData) {
    'use server';
    const t = requireAdminToken();
    await adminApi.totens.create(t, params.id, String(form.get('nome')));
    revalidatePath(`/admin/eventos/${params.id}`);
  }

  async function removerTotem(id: string) {
    'use server';
    const t = requireAdminToken();
    await adminApi.totens.remove(t, id);
    revalidatePath(`/admin/eventos/${params.id}`);
  }

  async function renomearTotem(id: string, nome: string) {
    'use server';
    const t = requireAdminToken();
    await adminApi.totens.update(t, id, { nome });
    revalidatePath(`/admin/eventos/${params.id}`);
  }

  const stats = participantes.reduce(
    (acc, p) => {
      acc.total++;
      if (p.status === 'CHECKED_IN') acc.checkin++;
      else if (p.status === 'PRE_REGISTERED') acc.pre++;
      else acc.pendente++;
      return acc;
    },
    { total: 0, pre: 0, checkin: 0, pendente: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin/eventos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{evento.nome}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatPeriod(evento.inicio, evento.fim)}
            </span>
            {evento.local && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {evento.local}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <ShieldAlert className="h-4 w-4" />
              Retenção: {evento.retencaoDias} dias
            </span>
          </div>
        </div>
      </header>

      {/* Link público */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Link2 className="h-3 w-3" /> Link de credenciamento (compartilhe com os participantes)
            </p>
            <p className="mt-1 truncate font-mono text-sm text-slate-800">{fullUrl}</p>
          </div>
          <CopiarLink url={fullUrl} />
        </div>
      </section>

      {/* Métricas */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Total" value={stats.total} />
        <Stat icon={<Hourglass className="h-4 w-4" />} label="Aguardando fotos" value={stats.pendente} variant="amber" />
        <Stat icon={<Clock className="h-4 w-4" />} label="Pré-cadastrados" value={stats.pre} variant="blue" />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Check-in feito" value={stats.checkin} variant="green" />
      </section>

      {/* Totens */}
      <div className="mb-6">
        <TotensCard
          totens={totens}
          onCreate={criarTotem}
          onRemove={removerTotem}
          onRename={renomearTotem}
        />
      </div>

      {/* Histórico de check-ins */}
      <div className="mb-6">
        <HistoricoCheckinsEvento
          token={token}
          eventId={params.id}
          dias={dias}
          totens={totens.map((t) => ({ id: t.id, nome: t.nome }))}
        />
      </div>

      {/* Tabela de participantes */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">Participantes</h2>
        </div>
        {participantes.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Ninguém se cadastrou ainda. Compartilhe o link acima.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Cidade</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Check-in</th>
                <th className="px-5 py-3 text-left">Cadastrado</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participantes.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">
                      {p.nome} {p.sobrenome}
                    </div>
                    <div className="text-xs text-slate-500">
                      …{p.cpfLast3} · {p.email}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.municipio}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {p.checkInEm
                      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
                          new Date(p.checkInEm),
                        )
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
                      new Date(p.criadoEm),
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <ExcluirParticipante
                      attendeeId={p.id}
                      nome={`${p.nome} ${p.sobrenome}`}
                      onDelete={excluirAttendee}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

type StatVariant = 'default' | 'amber' | 'blue' | 'green';
function Stat({
  icon,
  label,
  value,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant?: StatVariant;
}) {
  const colors: Record<StatVariant, string> = {
    default: 'text-slate-700',
    amber: 'text-amber-600',
    blue: 'text-brand-600',
    green: 'text-success-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${colors[variant]}`}>
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
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

function formatPeriod(inicio: string, fim: string): string {
  const d1 = new Date(inicio);
  const d2 = new Date(fim);
  const sameDay = d1.toDateString() === d2.toDateString();
  const fmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return sameDay
    ? `${fmt.format(d1)} – ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(d2)}`
    : `${fmt.format(d1)} → ${fmt.format(d2)}`;
}
