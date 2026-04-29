'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';

interface Props {
  totemId: string;
  nomeAtual: string;
  onSave: (id: string, nome: string) => Promise<void>;
}

export function EditarTotemInline({ totemId, nomeAtual, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(nomeAtual);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function salvar() {
    if (!nome.trim() || nome === nomeAtual) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await onSave(totemId, nome.trim());
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-900">{nomeAtual}</span>
        <button
          onClick={() => setEditing(true)}
          className="rounded p-1 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
          title="Renomear"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') salvar();
          if (e.key === 'Escape') {
            setNome(nomeAtual);
            setEditing(false);
          }
        }}
        className="h-8 rounded-lg border border-brand-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        onClick={salvar}
        disabled={pending}
        className="rounded p-1 text-success-600 hover:bg-success-500/10 disabled:opacity-50"
        title="Salvar"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => {
          setNome(nomeAtual);
          setEditing(false);
        }}
        className="rounded p-1 text-slate-400 hover:bg-slate-100"
        title="Cancelar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
