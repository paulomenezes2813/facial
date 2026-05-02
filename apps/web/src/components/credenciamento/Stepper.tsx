'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StepKey = 'cpf' | 'dados' | 'foto1' | 'foto2';

interface StepperProps {
  current: StepKey;
  completed: Set<StepKey>;
}

const STEPS: { key: StepKey; index: number; titulo: string; subtitulo: string }[] = [
  { key: 'cpf', index: 1, titulo: 'CPF', subtitulo: 'Identifique-se' },
  { key: 'dados', index: 2, titulo: 'Dados', subtitulo: 'Preencha seus dados' },
  { key: 'foto1', index: 3, titulo: 'Foto 1', subtitulo: 'Selfie de frente' },
  { key: 'foto2', index: 4, titulo: 'Foto 2', subtitulo: 'Obrigatória p/ concluir' },
];

export function Stepper({ current, completed }: StepperProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {STEPS.map((step) => {
        const isActive = step.key === current;
        const isDone = completed.has(step.key);
        return (
          <div
            key={step.key}
            className={cn(
              'rounded-2xl border px-3 py-3 transition-all duration-200 sm:px-4',
              isActive
                ? 'border-brand-500 bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : isDone
                  ? 'border-success-500/30 bg-success-500/5 text-slate-700'
                  : 'border-slate-200 bg-white text-slate-700 shadow-sm',
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn('text-sm font-bold sm:text-base', isActive ? 'text-white' : 'text-slate-900')}
              >
                {step.titulo}
              </span>
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                  isActive
                    ? 'bg-white/20 text-white'
                    : isDone
                      ? 'bg-success-500 text-white'
                      : 'bg-slate-100 text-slate-500',
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : `#${step.index}`}
              </span>
            </div>
            <p
              className={cn(
                'mt-1 text-xs leading-tight sm:text-sm',
                isActive ? 'text-white/85' : 'text-slate-500',
              )}
            >
              {step.subtitulo}
            </p>
          </div>
        );
      })}
    </div>
  );
}
