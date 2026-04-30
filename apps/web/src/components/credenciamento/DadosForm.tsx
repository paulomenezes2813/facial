'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  CalendarDays,
  Calendar,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  IdCard,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { isValidCpf, maskCpf } from '@/lib/cpf';
import { dataParaIso, maskCelular, maskData } from '@/lib/masks';

export const DadosFormSchema = z.object({
  eventoId: z.string().min(1, 'Selecione o evento'),
  nome: z.string().trim().min(1, 'Informe o nome').max(80),
  sobrenome: z.string().trim().min(1, 'Informe o sobrenome').max(120),
  cpf: z.string().refine(isValidCpf, 'CPF inválido'),
  dataNascimento: z
    .string()
    .refine((v) => dataParaIso(v) !== null, 'Data inválida (use DD/MM/AAAA)'),
  cargo: z.string().trim().max(100).optional(),
  email: z.string().email('E-mail inválido'),
  celular: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length >= 10, 'Celular inválido')
    .refine((v) => v.replace(/\D/g, '').length <= 11, 'Celular inválido'),
  municipio: z.string().trim().min(1, 'Informe o município'),
  consentimentoLgpd: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar o termo de consentimento' }),
  }),
});

export type DadosFormValues = z.infer<typeof DadosFormSchema>;

interface DadosFormProps {
  /** Lista de eventos disponíveis pra seleção. */
  eventos: { id: string; nome: string }[];
  defaultValues?: Partial<DadosFormValues>;
  /** Quando true, esconde o seletor de evento (caso já venha pré-selecionado por URL). */
  travarEvento?: boolean;
  onSubmit: (values: DadosFormValues) => Promise<void> | void;
}

export function DadosForm({ eventos, defaultValues, travarEvento, onSubmit }: DadosFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DadosFormValues>({
    resolver: zodResolver(DadosFormSchema),
    defaultValues,
    mode: 'onTouched',
  });

  const eventoSelecionado = watch('eventoId');
  const eventoNome = eventos.find((e) => e.id === eventoSelecionado)?.nome;

  const consentimento = watch('consentimentoLgpd');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* ── Layout de 2 colunas: formulário + dicas ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Coluna esquerda: formulário ── */}
        <div className="flex flex-col gap-5">
          {/* ── Seleção do evento ── */}
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
                  {...register('eventoId')}
                  className={
                    'h-12 w-full appearance-none rounded-xl border bg-white px-4 text-base text-slate-900 ' +
                    'focus:outline-none focus:ring-2 focus:ring-brand-500/40 ' +
                    (errors.eventoId
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
                      : 'border-slate-200 focus:border-brand-500')
                  }
                >
                  <option value="">— Selecione —</option>
                  {eventos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              )}
              {errors.eventoId && (
                <p className="mt-1.5 text-xs text-red-600">{errors.eventoId.message}</p>
              )}
              {eventos.length === 0 && !travarEvento && (
                <p className="mt-2 text-xs text-amber-700">
                  Nenhum evento disponível no momento. Volte mais tarde ou contate a organização.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={<User className="h-5 w-5" />}
              title="Seus dados"
              subtitle="Preencha para identificação no evento."
            />

            <div className="mt-5 flex flex-col gap-4">
              {/* Nome + Sobrenome lado a lado */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Nome"
                  autoComplete="given-name"
                  placeholder=""
                  error={errors.nome?.message}
                  {...register('nome')}
                />
                <Input
                  label="Sobrenome"
                  autoComplete="family-name"
                  error={errors.sobrenome?.message}
                  {...register('sobrenome')}
                />
              </div>

              {/* CPF + Data de nascimento lado a lado */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="CPF"
                  icon={<IdCard className="h-4 w-4" />}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  error={errors.cpf?.message}
                  {...register('cpf', {
                    onChange: (e) => {
                      e.target.value = maskCpf(e.target.value);
                    },
                  })}
                />
                <Input
                  label="Data de nascimento"
                  icon={<Calendar className="h-4 w-4" />}
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  error={errors.dataNascimento?.message}
                  {...register('dataNascimento', {
                    onChange: (e) => {
                      e.target.value = maskData(e.target.value);
                    },
                  })}
                />
              </div>

              {/* Cargo (full width) */}
              <Input
                label="Cargo"
                icon={<Briefcase className="h-4 w-4" />}
                placeholder="Opcional"
                error={errors.cargo?.message}
                {...register('cargo')}
              />

              {/* E-mail + Celular lado a lado */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="E-mail"
                  type="email"
                  icon={<Mail className="h-4 w-4" />}
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Celular"
                  icon={<Phone className="h-4 w-4" />}
                  inputMode="tel"
                  placeholder="(88) 9XXXX-XXXX"
                  error={errors.celular?.message}
                  {...register('celular', {
                    onChange: (e) => {
                      e.target.value = maskCelular(e.target.value);
                    },
                  })}
                />
              </div>

              {/* Município (full width) */}
              <Input
                label="Município"
                icon={<MapPin className="h-4 w-4" />}
                hint="Será salvo automaticamente em MAIÚSCULAS."
                error={errors.municipio?.message}
                {...register('municipio', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
            </div>
          </Card>

          {/* ── Consentimento LGPD ── */}
          <Card className="border-brand-100 bg-brand-50/30">
            <CardHeader
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Consentimento"
              subtitle=""
            />
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ao continuar, você autoriza o uso da sua imagem para{' '}
              <strong className="text-slate-800">cadastro facial e check-in no evento</strong>. Seus dados serão usados apenas para
              identificação no dia do evento e poderão ser removidos após a finalização.
            </p>
            <div className="mt-4">
              <Checkbox
                label="Eu li e concordo com o uso da imagem para fins de credenciamento no evento."
                checked={!!consentimento}
                error={errors.consentimentoLgpd?.message}
                onChange={(e) => setValue('consentimentoLgpd', e.target.checked as true, { shouldValidate: true })}
              />
            </div>
          </Card>

          {/* ── Footer: próximo passo + botão ── */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Próximo passo: Foto 1.</p>
            <Button type="submit" size="lg" loading={isSubmitting}>
              Continuar
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Coluna direita: dicas ── */}
        <div className="hidden lg:block">
          <DicasCard />
        </div>
      </div>

      {/* Dicas visível no mobile (abaixo do form) */}
      <div className="lg:hidden">
        <DicasCard />
      </div>
    </form>
  );
}

function DicasCard() {
  const dicas = [
    'Boa iluminação, de frente.',
    'Apenas você no enquadramento.',
    'Sem filtros, sem óculos escuros.',
    'Preencha CPF e data de nascimento corretamente.',
  ];

  return (
    <Card className="border-slate-200/80 bg-slate-50/80">
      <h3 className="text-lg font-bold text-slate-900">Dicas</h3>
      <p className="text-sm text-slate-500">Para cadastro perfeito.</p>
      <ul className="mt-4 space-y-3 text-sm text-slate-700">
        {dicas.map((d) => (
          <li key={d} className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-500" />
            <span>{d}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-400">Isso reduz falhas na entrada.</p>
    </Card>
  );
}
