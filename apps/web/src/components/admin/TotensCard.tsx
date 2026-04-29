'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Plus, Trash2, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AdminTotem } from '@/lib/api';
import { EditarTotemInline } from './EditarTotemInline';

interface Props {
  totens: AdminTotem[];
  onCreate: (form: FormData) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  /** Opcional — quando passado, habilita renomear inline. */
  onRename?: (id: string, nome: string) => Promise<void>;
}

export function TotensCard({ totens, onCreate, onRemove, onRename }: Props) {
  const [adicionando, setAdicionando] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [copiado, setCopiado] = useState<string | null>(null);

  function copiar(apiKey: string) {
    navigator.clipboard.writeText(apiKey);
    setCopiado(apiKey);
    setTimeout(() => setCopiado(null), 1500);
  }

  function submitCreate(form: FormData) {
    startTransition(async () => {
      await onCreate(form);
      setAdicionando(false);
      router.refresh();
    });
  }

  function remover(id: string, nome: string) {
    if (!window.confirm(`Remover o totem "${nome}"?`)) return;
    startTransition(async () => {
      await onRemove(id);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-slate-600" />
          <h2 className="font-bold text-slate-900">Totens</h2>
        </div>
        {!adicionando && (
          <Button size="sm" onClick={() => setAdicionando(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo totem
          </Button>
        )}
      </header>

      {adicionando && (
        <form action={submitCreate} className="flex gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <Input name="nome" placeholder="Ex: Entrada principal" required className="flex-1" />
          <Button type="submit" loading={pending} size="md">
            Criar
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={() => setAdicionando(false)}>
            Cancelar
          </Button>
        </form>
      )}

      {totens.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Nenhum totem ainda. Crie um para parear o equipamento de check-in.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {totens.map((t) => (
            <li key={t.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {onRename ? (
                    <EditarTotemInline totemId={t.id} nomeAtual={t.nome} onSave={onRename} />
                  ) : (
                    <p className="font-medium text-slate-900">{t.nome}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    Último sync:{' '}
                    {t.ultimoSync
                      ? new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(t.ultimoSync))
                      : '—'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="block max-w-md truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                      {t.apiKey}
                    </code>
                    <button
                      onClick={() => copiar(t.apiKey)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {copiado === t.apiKey ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiado === t.apiKey ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Cole essa chave em <code>/totem/setup</code> para parear o totem.
                  </p>
                </div>
                <button
                  onClick={() => remover(t.id, t.nome)}
                  disabled={pending}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Excluir totem"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
