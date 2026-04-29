'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

interface Props {
  eventoId: string;
  nome: string;
  totalParticipantes: number;
  onDelete: (id: string) => Promise<void>;
}

export function ExcluirEvento({ eventoId, nome, totalParticipantes, onDelete }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const aviso =
      totalParticipantes > 0
        ? `Excluir "${nome}"? Isso apaga ${totalParticipantes} participante(s) e todos os dados biométricos. Irreversível.`
        : `Excluir o evento "${nome}"?`;
    if (!window.confirm(aviso)) return;
    startTransition(async () => {
      await onDelete(eventoId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      title="Excluir evento"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
