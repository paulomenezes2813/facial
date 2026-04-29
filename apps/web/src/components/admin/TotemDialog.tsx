'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  eventos: { id: string; nome: string }[];
  /** Quando passado, fixa o evento e esconde o seletor (uso dentro do detalhe do evento). */
  eventoFixoId?: string;
  onCreate: (eventoId: string, nome: string) => Promise<void>;
}

export function TotemDialog({ eventos, eventoFixoId, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [eventoId, setEventoId] = useState(eventoFixoId ?? '');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setTimeout(() => {
      setNome('');
      setErro(null);
      if (!eventoFixoId) setEventoId('');
    }, 200);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventoId) {
      setErro('Selecione o evento');
      return;
    }
    if (!nome.trim()) {
      setErro('Informe o nome do totem');
      return;
    }
    setErro(null);
    startTransition(async () => {
      try {
        await onCreate(eventoId, nome.trim());
        close();
        router.refresh();
      } catch (e: any) {
        setErro(e?.message ?? 'Falha ao criar totem.');
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="md">
        <Plus className="h-4 w-4" />
        Novo totem
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Novo totem</h2>
              <button
                onClick={close}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              {!eventoFixoId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Evento</label>
                  <select
                    required
                    value={eventoId}
                    onChange={(e) => setEventoId(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">Selecione...</option>
                    {eventos.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.nome}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    O totem fica vinculado ao evento e só identifica seus participantes.
                  </p>
                </div>
              )}

              <Input
                label="Nome do totem"
                placeholder="Ex: Entrada principal"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoFocus={!!eventoFixoId}
              />

              {erro && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erro}
                </p>
              )}

              <div className="mt-2 flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={close}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" loading={pending}>
                  Criar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
