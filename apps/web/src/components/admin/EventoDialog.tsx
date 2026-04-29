'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { AdminEvent } from '@/lib/api';

interface Props {
  /** Modo: criar novo ou editar existente. */
  mode: 'create' | 'edit';
  /** Quando mode='edit', o evento atual. */
  evento?: AdminEvent;
  /** Server Action que recebe FormData. */
  onSubmit: (form: FormData) => Promise<void>;
  /** Trigger custom (default: botão "Novo evento" para create, lápis para edit). */
  triggerLabel?: string;
}

function toLocalInput(iso: string): string {
  // datetime-local quer YYYY-MM-DDTHH:mm
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventoDialog({ mode, evento, onSubmit, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(form: FormData) {
    startTransition(async () => {
      await onSubmit(form);
      setOpen(false);
      router.refresh();
    });
  }

  const titulo = mode === 'create' ? 'Novo evento' : 'Editar evento';

  return (
    <>
      {mode === 'create' ? (
        <Button onClick={() => setOpen(true)} size="md">
          <Plus className="h-4 w-4" />
          {triggerLabel ?? 'Novo evento'}
        </Button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form action={submit} className="flex flex-col gap-4">
              <Input
                name="nome"
                label="Nome do evento"
                required
                defaultValue={evento?.nome ?? ''}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="inicio"
                  label="Início"
                  type="datetime-local"
                  required
                  defaultValue={evento?.inicio ? toLocalInput(evento.inicio) : ''}
                />
                <Input
                  name="fim"
                  label="Fim"
                  type="datetime-local"
                  required
                  defaultValue={evento?.fim ? toLocalInput(evento.fim) : ''}
                />
              </div>
              <Input
                name="local"
                label="Local"
                placeholder="Opcional"
                defaultValue={evento?.local ?? ''}
              />
              <Input
                name="retencaoDias"
                label="Retenção (dias)"
                type="number"
                min={1}
                max={365}
                defaultValue={evento?.retencaoDias ?? 10}
                hint="Após esse prazo, fotos e embeddings são apagados (LGPD)."
              />
              <div className="mt-2 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" loading={pending}>
                  {mode === 'create' ? 'Criar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
