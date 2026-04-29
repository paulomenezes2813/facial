import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hourglass,
  LayoutDashboard,
  MapPin,
  Tv,
  UserCheck,
  Users,
} from 'lucide-react';
import { adminApi, type AdminAttendeeListItem, type AdminEvent, type AdminTotemRich } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';
import { StatCard } from '@/components/admin/dashboard/StatCard';
import { BarChart } from '@/components/admin/dashboard/BarChart';
import { Donut } from '@/components/admin/dashboard/Donut';

export default async function DashboardPage() {
  const token = requireAdminToken();
  const [eventos, participantes, totens] = await Promise.all([
    adminApi.events.list(token),
    adminApi.attendees.list(token, {}),
    adminApi.totens.listAll(token),
  ]);

  const stats = computeStats(eventos, participantes, totens);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <LayoutDashboard className="h-6 w-6 text-slate-600" />
          Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Visão geral do sistema · atualizado em{' '}
          {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}
        </p>
      </header>

      {/* KPIs principais */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Eventos"
          value={stats.eventosTotal}
          hint={`${stats.eventosAtivos} em curso · ${stats.eventosFuturos} futuros`}
          icon={<CalendarDays className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard
          label="Participantes"
          value={stats.participantesTotal}
          hint={`${stats.preCadastrados} pré-cadastrados`}
          icon={<Users className="h-4 w-4" />}
          tone="neutral"
        />
        <StatCard
          label="Check-ins hoje"
          value={stats.checkinsHoje}
          hint={stats.checkinsHoje > 0 ? `${stats.ultimoCheckinTexto}` : 'Nenhum hoje'}
          icon={<UserCheck className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Totens ativos"
          value={stats.totensTotal}
          hint={`${stats.totensSincronizados} sincronizados`}
          icon={<Tv className="h-4 w-4" />}
          tone="amber"
        />
      </section>

      {/* Linha 2: cadastros 7 dias + funil */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Activity className="h-4 w-4 text-slate-500" />
            Cadastros nos últimos 7 dias
          </h2>
          <BarChart data={stats.cadastros7d} />
          <p className="mt-2 text-xs text-slate-500">
            Total: <strong>{stats.cadastros7d.reduce((a, b) => a + b.value, 0)}</strong> nos últimos 7 dias.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-slate-500" />
            Taxa de check-in
          </h2>
          <div className="flex justify-center">
            <Donut percent={stats.taxaCheckin} label={`${stats.checkinsTotal} de ${stats.preCadastrados + stats.checkinsTotal}`} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Considera todos os participantes que concluíram o pré-cadastro (incluindo já checados).
          </p>
        </div>
      </section>

      {/* Linha 3: próximos eventos + status dos participantes */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Próximos eventos */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Calendar className="h-4 w-4 text-slate-500" />
              Próximos eventos
            </h2>
            <Link
              href="/admin/eventos"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <ul className="divide-y divide-slate-100">
            {stats.proximos.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-slate-400">Sem eventos futuros.</li>
            )}
            {stats.proximos.map((e) => (
              <li key={e.id} className="px-5 py-3 hover:bg-slate-50">
                <Link href={`/admin/eventos/${e.id}`} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{e.nome}</span>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {e._count?.attendees ?? 0} pré
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatPeriod(e.inicio, e.fim)}
                    </span>
                    {e.local && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {e.local}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Status dos participantes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Hourglass className="h-4 w-4 text-slate-500" />
            Status dos participantes
          </h2>
          <ul className="space-y-3">
            <StatusBar
              label="Aguardando fotos"
              value={stats.statusBreakdown.PENDING_PHOTOS}
              total={stats.participantesTotal}
              color="bg-amber-400"
            />
            <StatusBar
              label="Pré-cadastrados"
              value={stats.statusBreakdown.PRE_REGISTERED}
              total={stats.participantesTotal}
              color="bg-brand-500"
            />
            <StatusBar
              label="Check-in feito"
              value={stats.statusBreakdown.CHECKED_IN}
              total={stats.participantesTotal}
              color="bg-success-500"
            />
          </ul>
        </div>
      </section>

      {/* Linha 4: ranking de eventos */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-bold text-slate-900">Eventos por engajamento</h2>
          <p className="text-xs text-slate-500">% de pré-cadastrados que fizeram check-in.</p>
        </header>
        {stats.ranking.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Sem participantes para calcular.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Evento</th>
                <th className="px-5 py-3 text-right">Pré-cadastros</th>
                <th className="px-5 py-3 text-right">Check-ins</th>
                <th className="px-5 py-3 text-right">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.ranking.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/eventos/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {r.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700">{r.preCadastros}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{r.checkins}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-xs text-slate-700">{Math.round(r.taxa)}%</span>
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

function StatusBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <li>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-700">{label}</span>
        <span className="font-mono text-slate-500">
          {value} <span className="text-slate-400">({Math.round(pct)}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Cálculo das métricas (server side)
// ---------------------------------------------------------------------------
function computeStats(
  eventos: AdminEvent[],
  participantes: AdminAttendeeListItem[],
  totens: AdminTotemRich[],
) {
  const agora = Date.now();
  const eventosAtivos = eventos.filter(
    (e) => new Date(e.inicio).getTime() <= agora && agora <= new Date(e.fim).getTime(),
  ).length;
  const eventosFuturos = eventos.filter((e) => new Date(e.inicio).getTime() > agora).length;
  const proximos = [...eventos]
    .filter((e) => new Date(e.fim).getTime() >= agora)
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
    .slice(0, 5);

  const statusBreakdown = participantes.reduce(
    (acc, p) => {
      acc[p.status as keyof typeof acc] = (acc[p.status as keyof typeof acc] ?? 0) + 1;
      return acc;
    },
    { PENDING_PHOTOS: 0, PRE_REGISTERED: 0, CHECKED_IN: 0, DELETED: 0 } as Record<string, number>,
  );

  // Cadastros nos últimos 7 dias (incluindo hoje)
  const cadastros7d: { label: string; value: number }[] = [];
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const count = participantes.filter((p) => {
      const t = new Date(p.criadoEm).getTime();
      return t >= d.getTime() && t < next.getTime();
    }).length;
    cadastros7d.push({ label: dias[d.getDay()], value: count });
  }

  // Check-ins hoje
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const checkinsHojeArr = participantes.filter(
    (p) => p.checkInEm && new Date(p.checkInEm).getTime() >= inicioHoje.getTime(),
  );
  const ultimoCheckin = checkinsHojeArr
    .map((p) => new Date(p.checkInEm!).getTime())
    .sort((a, b) => b - a)[0];
  const ultimoCheckinTexto = ultimoCheckin
    ? `último às ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(ultimoCheckin))}`
    : '';

  // Ranking de eventos (taxa de check-in)
  const porEvento = new Map<string, { id: string; nome: string; preCadastros: number; checkins: number }>();
  for (const e of eventos) {
    porEvento.set(e.id, { id: e.id, nome: e.nome, preCadastros: 0, checkins: 0 });
  }
  for (const p of participantes) {
    const r = porEvento.get(p.eventId);
    if (!r) continue;
    if (p.status === 'PRE_REGISTERED' || p.status === 'CHECKED_IN') r.preCadastros++;
    if (p.status === 'CHECKED_IN') r.checkins++;
  }
  const ranking = [...porEvento.values()]
    .filter((r) => r.preCadastros > 0)
    .map((r) => ({ ...r, taxa: (r.checkins / r.preCadastros) * 100 }))
    .sort((a, b) => b.taxa - a.taxa)
    .slice(0, 8);

  const checkinsTotal = participantes.filter((p) => p.status === 'CHECKED_IN').length;
  const preCadastrados = statusBreakdown.PRE_REGISTERED ?? 0;
  const taxaCheckin =
    checkinsTotal + preCadastrados > 0 ? (checkinsTotal / (checkinsTotal + preCadastrados)) * 100 : 0;

  const totensSincronizados = totens.filter((t) => !!t.ultimoSync).length;

  return {
    eventosTotal: eventos.length,
    eventosAtivos,
    eventosFuturos,
    proximos,
    participantesTotal: participantes.length,
    statusBreakdown,
    preCadastrados,
    checkinsTotal,
    checkinsHoje: checkinsHojeArr.length,
    ultimoCheckinTexto,
    cadastros7d,
    taxaCheckin,
    ranking,
    totensTotal: totens.length,
    totensSincronizados,
  };
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
