'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export function ExcluirTotem({
  totemId,
  nome,
  onDelete,
}: {
  totemId: string;
  nome: string;
  onDelete: (id: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handle() {
    if (!window.confirm(`Excluir totem "${nome}"? A apiKey atual será invalidada.`)) return;
    startTransition(async () => {
      await onDelete(totemId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      title="Excluir totem"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
