'use client';

import { CheckCircle2 } from 'lucide-react';

interface Props {
  nome: string;
  sobrenome: string;
  protocolo: string;
}

export function JaCadastrado({ nome, sobrenome, protocolo }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-success-500/30 bg-success-500/10 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-success-500 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Você já está cadastrado <span aria-hidden>✅</span>
            </h2>
            <p className="text-sm text-slate-600">
              Olá, <strong>{nome} {sobrenome}</strong>! Seu cadastro facial está completo.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm leading-relaxed text-slate-700">
          No dia do evento, basta se dirigir à entrada e seguir as instruções no totem de check-in.
        </p>
        <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Protocolo</p>
        <p className="mt-1 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">
          {protocolo}
        </p>
      </div>
    </div>
  );
}
