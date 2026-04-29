import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Hash,
  IdCard,
  Image as ImageIcon,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { adminApi, ApiError, type AttendeeStatus } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';
import { EditarParticipanteForm } from '@/components/admin/EditarParticipanteForm';
import { HistoricoCheckinsParticipante } from '@/components/admin/HistoricoCheckinsParticipante';

interface PageProps {
  params: { id: string };
}

export default async function ParticipanteDetalhe({ params }: PageProps) {
  const token = requireAdminToken();
  let attendee;
  try {
    attendee = await adminApi.attendees.byId(token, params.id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  async function salvar(data: Record<string, string | null>) {
    'use server';
    const t = requireAdminToken();
    await adminApi.attendees.update(t, params.id, data as any);
    revalidatePath(`/admin/participantes/${params.id}`);
  }

  async function excluir() {
    'use server';
    const t = requireAdminToken();
    await adminApi.attendees.remove(t, params.id);
    redirect('/admin/participantes');
  }

  const tem = (ord: number) => attendee.fotos.some((f) => f.ordem === ord);
  const fotosUrl = (ord: 1 | 2) => `/api/admin/photo/${attendee.id}/${ord}`;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/participantes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {attendee.nome} {attendee.sobrenome}
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Hash className="h-4 w-4" />
              {attendee.protocolo}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <Link href={`/admin/eventos/${attendee.evento.id}`} className="hover:text-brand-700">
                {attendee.evento.nome}
              </Link>
            </span>
            <StatusBadge status={attendee.status} />
          </div>
        </div>
        <form action={excluir}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <EditarParticipanteForm attendee={attendee} onSave={salvar} />

          {/* Imutáveis / metadados */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <IdCard className="h-4 w-4 text-slate-500" />
              Identificação imutável
            </h3>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Field k="CPF (últimos 3)" v={`••••••••${attendee.cpfLast3}`} />
              <Field
                k="Data de nascimento"
                v={new Intl.DateTimeFormat('pt-BR').format(new Date(attendee.dataNascimento))}
              />
              <Field
                k="Cadastrado em"
                v={new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(attendee.criadoEm))}
              />
              <Field k="Embedding" v={attendee.embeddingId ? '✓ indexado no Qdrant' : '— sem embedding'} />
            </dl>
          </section>

          {/* Histórico de check-ins */}
          <HistoricoCheckinsParticipante attendeeId={attendee.id} />

          {/* LGPD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-slate-500" /> LGPD
            </h3>
            <p className="text-sm text-slate-600">
              Consentimento {attendee.consentimentoLgpd ? <strong>aceito</strong> : <strong>não aceito</strong>}
              {attendee.consentimentoEm && (
                <>
                  {' '}em{' '}
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(attendee.consentimentoEm))}
                </>
              )}
              .
            </p>
            {attendee.checkInEm && (
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600">
                <Clock className="h-4 w-4" /> Check-in em{' '}
                {new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(attendee.checkInEm))}
              </p>
            )}
          </section>
        </div>

        {/* Fotos */}
        <aside className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <ImageIcon className="h-4 w-4 text-slate-500" /> Fotos cadastradas
          </h3>

          <FotoCard
            label="Foto 1 — frente"
            disponivel={tem(1)}
            url={fotosUrl(1)}
          />
          <FotoCard
            label="Foto 2 — leve ângulo"
            disponivel={tem(2)}
            url={fotosUrl(2)}
          />

          <p className="text-xs text-slate-400">
            As fotos são servidas com autenticação via cookie e expiram do storage após o prazo de
            retenção do evento.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="mt-0.5 text-slate-800">{v}</dd>
    </div>
  );
}

function FotoCard({ label, disponivel, url }: { label: string; disponivel: boolean; url: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-[3/4] bg-slate-100">
        {disponivel ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Não enviada
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-slate-600">{label}</div>
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
