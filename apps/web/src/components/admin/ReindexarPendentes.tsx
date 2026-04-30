'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Resultado {
  total: number;
  ok: number;
  falhas: number;
  erros: { attendeeId: string; nome: string; erro: string }[];
}

interface Props {
  /** Server Action: chama enrollPendentes na API com o token. */
  onRun: () => Promise<Resultado>;
  /** Quantos pendentes existem antes de clicar (renderizado fora). */
  totalPendentes?: number;
}

export function ReindexarPendentes({ onRun, totalPendentes }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function executar() {
    setResultado(null);
    startTransition(async () => {
      const r = await onRun();
      setResultado(r);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {totalPendentes ?? 0} participante(s) pendente(s) de indexação
            </p>
            <p className="text-xs text-slate-600">
              Foto salva, mas não foi enviada ao motor de reconhecimento (provavelmente o serviço estava
              fora). Clique para re-indexar todos.
            </p>
          </div>
        </div>
        <Button onClick={executar} loading={pending} disabled={(totalPendentes ?? 0) === 0}>
          <RefreshCw className="h-4 w-4" />
          Re-indexar todos
        </Button>
      </div>

      {resultado && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="font-semibold text-slate-900">
            {resultado.ok > 0 ? (
              <span className="inline-flex items-center gap-1 text-success-700">
                <CheckCircle2 className="h-4 w-4" /> {resultado.ok} re-indexado(s) com sucesso
              </span>
            ) : (
              <span className="text-slate-600">Nenhum re-indexado</span>
            )}
            {resultado.falhas > 0 && (
              <span className="ml-3 inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> {resultado.falhas} falha(s)
              </span>
            )}
          </p>
          {resultado.erros.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-600">
              {resultado.erros.map((e) => (
                <li key={e.attendeeId} className="border-l-2 border-amber-300 pl-2">
                  <strong>{e.nome}</strong>: {e.erro}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
