'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export function ExcluirParticipante({
  attendeeId,
  nome,
  onDelete,
}: {
  attendeeId: string;
  nome: string;
  onDelete: (id: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handle() {
    if (!window.confirm(`Excluir ${nome}? Esta ação apaga foto e dados biométricos (irreversível).`)) return;
    startTransition(async () => {
      await onDelete(attendeeId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      title="Excluir (LGPD)"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
