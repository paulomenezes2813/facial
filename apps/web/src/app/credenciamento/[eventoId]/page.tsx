'use client';

import { useState } from 'react';
import { ShieldCheck, Camera as CameraIcon, QrCode } from 'lucide-react';
import { Stepper, type StepKey } from '@/components/credenciamento/Stepper';
import { DadosForm, type DadosFormValues } from '@/components/credenciamento/DadosForm';
import { FaceCamera } from '@/components/credenciamento/FaceCamera';
import { Sucesso } from '@/components/credenciamento/Sucesso';
import { Card, CardHeader } from '@/components/ui/card';
import { dataParaIso } from '@/lib/masks';
import { api, ApiError } from '@/lib/api';

interface PageProps {
  params: { eventoId: string };
}

export default function CredenciamentoPage({ params }: PageProps) {
  const [step, setStep] = useState<StepKey>('dados');
  const [completed, setCompleted] = useState<Set<StepKey>>(new Set());
  const [attendeeId, setAttendeeId] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<DadosFormValues>>({});

  function markCompleted(k: StepKey) {
    setCompleted((s) => {
      const next = new Set(s);
      next.add(k);
      return next;
    });
  }

  async function submeterDados(values: DadosFormValues) {
    setErro(null);
    setDraft(values);
    try {
      const iso = dataParaIso(values.dataNascimento)!;
      const res = await api.register({
        eventoId: params.eventoId,
        nome: values.nome,
        sobrenome: values.sobrenome,
        cpf: values.cpf,
        dataNascimento: iso,
        cargo: values.cargo || null,
        email: values.email,
        celular: values.celular,
        municipio: values.municipio,
        consentimentoLgpd: true,
      });
      setAttendeeId(res.id);
      setProtocolo(res.protocolo);
      markCompleted('dados');
      setStep('foto1');
    } catch (e) {
      setErro(formatError(e, 'Não foi possível enviar seus dados.'));
    }
  }

  async function enviarFoto1(base64: string) {
    if (!attendeeId) return;
    setErro(null);
    try {
      await api.uploadPhoto(attendeeId, 1, base64);
      markCompleted('foto1');
      setStep('foto2');
    } catch (e) {
      setErro(formatError(e, 'Falha ao enviar a foto. Tente capturar novamente.'));
      throw e;
    }
  }

  async function enviarFoto2(base64: string) {
    if (!attendeeId) return;
    setErro(null);
    try {
      await api.uploadPhoto(attendeeId, 2, base64);
      markCompleted('foto2');
      setStep('done' as StepKey);
    } catch (e) {
      setErro(formatError(e, 'Falha ao enviar a foto.'));
      throw e;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-100">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <header className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-brand-100 text-brand-600 shadow-sm">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
              Credenciamento
            </h1>
            <p className="text-sm text-slate-500 sm:text-base">
              Cadastro facial para identificação e check-in no evento.
            </p>
          </div>
        </header>

        {/* ── Banner gradiente ── */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-teal-500 p-5 text-white shadow-lg sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/75">
                  Cadastro rápido
                </p>
                <p className="text-xl font-bold leading-tight sm:text-2xl">
                  Tira 2 fotos e finaliza
                </p>
              </div>
            </div>
            <p className="text-sm text-white/85 sm:max-w-xs sm:text-right">
              Use boa iluminação e fique sozinho(a) no enquadramento.
            </p>
          </div>
        </div>

        {/* ── Stepper ── */}
        <div className="mb-6">
          <Stepper current={step === ('done' as StepKey) ? 'foto2' : step} completed={completed} />
        </div>

        {/* ── Erro global ── */}
        {erro && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {erro}
          </div>
        )}

        {/* ── Conteúdo principal (2 colunas no desktop) ── */}
        {step === 'dados' && (
          <DadosForm defaultValues={draft} onSubmit={submeterDados} />
        )}

        {step === 'foto1' && (
          <Card>
            <CardHeader title="Centralize seu rosto e toque no botão para capturar" />
            <div className="mt-4">
              <FaceCamera
                titulo="Foto 1 — Selfie de frente"
                dicas={[
                  'Boa iluminação (de frente)',
                  'Sem filtros, boné ou óculos escuros',
                  'Apenas você no enquadramento',
                ]}
                onCapture={enviarFoto1}
              />
            </div>
          </Card>
        )}

        {step === 'foto2' && (
          <Card>
            <CardHeader title="Foto 2 — Leve ângulo" />
            <p className="mt-1 text-sm text-slate-500">
              Vire o rosto levemente para o lado para uma segunda referência.
            </p>
            <div className="mt-4">
              <FaceCamera
                titulo="Capture com leve ângulo"
                dicas={['Vire ~15° para um dos lados', 'Mantenha o rosto dentro do oval']}
                onCapture={enviarFoto2}
              />
            </div>
          </Card>
        )}

        {step === ('done' as StepKey) && protocolo && <Sucesso protocolo={protocolo} />}
      </main>
    </div>
  );
}

function formatError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const detail = (e.detail as { message?: string; reason?: string } | string | undefined) ?? null;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && 'message' in detail && detail.message) {
      return detail.message;
    }
  }
  return fallback;
}
