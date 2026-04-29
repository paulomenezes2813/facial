import { Activity, Tv } from 'lucide-react';
import { adminApi, type AdminCheckinWithoutAttendee } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';

interface Props {
  attendeeId: string;
}

export async function HistoricoCheckinsParticipante({ attendeeId }: Props) {
  const token = requireAdminToken();
  const items: AdminCheckinWithoutAttendee[] = await adminApi.checkins.byAttendee(token, attendeeId);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <Activity className="h-4 w-4 text-slate-500" />
        Histórico de passagens ({items.length})
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma passagem registrada.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800">
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  }).format(new Date(c.registradoEm))}
                </p>
                <p className="text-xs text-slate-500">
                  {c.tipo === 'AUTO' ? 'Reconhecimento facial' : 'Identificação manual'}
                  {c.totem ? ` · ${c.totem.nome}` : ''}
                  {c.similarity != null ? ` · score ${c.similarity.toFixed(3)}` : ''}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.tipo === 'AUTO' ? 'bg-success-500/10 text-success-700' : 'bg-amber-100 text-amber-700'}`}
              >
                {c.tipo === 'AUTO' ? 'Face' : 'Manual'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
