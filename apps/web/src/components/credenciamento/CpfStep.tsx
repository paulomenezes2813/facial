'use client';

import { useState } from 'react';
import { ArrowRight, CalendarDays, IdCard, Search } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isValidCpf, maskCpf } from '@/lib/cpf';
import { humanizeApiError } from '@/lib/api-errors';
import { api, type CheckResponse } from '@/lib/api';

interface Props {
  eventos: { id: string; nome: string }[];
  /** Pré-seleciona um evento (vindo da URL). */
  eventoIdInicial?: string;
  /** Trava o seletor (deep-link). */
  travarEvento?: boolean;
  /** Resultado do lookup: o orquestrador decide pra onde ir. */
  onResolved: (input: { eventoId: string; cpf: string; resultado: CheckResponse }) => void;
}

export function CpfStep({ eventos, eventoIdInicial, travarEvento, onResolved }: Props) {
  const [eventoId, setEventoId] = useState(eventoIdInicial ?? '');
  const [cpf, setCpf] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const eventoNome = eventos.find((e) => e.id === eventoId)?.nome;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!eventoId) return setErro('Selecione o evento.');
    if (!isValidCpf(cpf)) return setErro('CPF inválido.');

    setPending(true);
    try {
      const resultado = await api.check(eventoId, cpf);
      onResolved({ eventoId, cpf, resultado });
    } catch (err) {
      setErro(humanizeApiError(err, 'Não foi possível consultar o CPF. Tente novamente.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Card>
        <CardHeader
          icon={<CalendarDays className="h-5 w-5" />}
          title="Evento"
          subtitle={
            travarEvento
              ? 'Você está se cadastrando no evento abaixo.'
              : 'Selecione o evento em que vai participar.'
          }
        />
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Selecione o evento
          </label>
          {travarEvento && eventoNome ? (
            <div className="flex h-12 w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-800">
              {eventoNome}
            </div>
          ) : (
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="">— Selecione —</option>
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          )}
          {eventos.length === 0 && !travarEvento && (
            <p className="mt-2 text-xs text-amber-700">
              Nenhum evento disponível no momento. Tente mais tarde.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<IdCard className="h-5 w-5" />}
          title="Identificação"
          subtitle="Digite seu CPF para iniciarmos seu credenciamento."
        />
        <div className="mt-4">
          <Input
            label="CPF"
            placeholder="000.000.000-00"
            inputMode="numeric"
            autoComplete="off"
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            autoFocus
            required
          />
        </div>
      </Card>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {erro}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button type="submit" size="lg" loading={pending}>
          <Search className="h-4 w-4" />
          Continuar
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
