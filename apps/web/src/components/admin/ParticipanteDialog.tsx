'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShieldAlert, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { isValidCpf, maskCpf } from '@/lib/cpf';
import { dataParaIso, maskCelular, maskData } from '@/lib/masks';

interface Props {
  eventos: { id: string; nome: string }[];
  onCreate: (form: FormData) => Promise<{ id: string; protocolo: string } | void>;
}

interface FormState {
  eventoId: string;
  nome: string;
  sobrenome: string;
  cpf: string;
  dataNascimento: string;
  cargo: string;
  email: string;
  celular: string;
  municipio: string;
  consentimentoConfirmado: boolean;
}

const EMPTY: FormState = {
  eventoId: '',
  nome: '',
  sobrenome: '',
  cpf: '',
  dataNascimento: '',
  cargo: '',
  email: '',
  celular: '',
  municipio: '',
  consentimentoConfirmado: false,
};

export function ParticipanteDialog({ eventos, onCreate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ protocolo: string; link: string } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function reset() {
    setForm(EMPTY);
    setErro(null);
    setCriado(null);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 300);
  }

  function validate(): string | null {
    if (!form.eventoId) return 'Selecione o evento';
    if (!form.nome.trim() || !form.sobrenome.trim()) return 'Informe nome e sobrenome';
    if (!isValidCpf(form.cpf)) return 'CPF inválido';
    if (!dataParaIso(form.dataNascimento)) return 'Data de nascimento inválida (DD/MM/AAAA)';
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) return 'E-mail inválido';
    if (form.celular.replace(/\D/g, '').length < 10) return 'Celular inválido';
    if (!form.municipio.trim()) return 'Informe o município';
    if (!form.consentimentoConfirmado) return 'Confirme que o consentimento LGPD foi obtido offline';
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setErro(err);
      return;
    }
    setErro(null);

    const fd = new FormData();
    fd.set('eventoId', form.eventoId);
    fd.set('nome', form.nome);
    fd.set('sobrenome', form.sobrenome);
    fd.set('cpf', form.cpf);
    fd.set('dataNascimento', dataParaIso(form.dataNascimento)!);
    fd.set('cargo', form.cargo);
    fd.set('email', form.email);
    fd.set('celular', form.celular);
    fd.set('municipio', form.municipio);

    startTransition(async () => {
      try {
        const result = await onCreate(fd);
        if (result?.protocolo) {
          const url = new URL(window.location.href);
          const link = `${url.origin}/credenciamento/${form.eventoId}?protocolo=${result.protocolo}`;
          setCriado({ protocolo: result.protocolo, link });
        } else {
          close();
          router.refresh();
        }
      } catch (e: any) {
        setErro(e?.message ?? 'Falha ao criar participante.');
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="md">
        <Plus className="h-4 w-4" />
        Novo participante
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Novo participante</h2>
              <button
                onClick={close}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {criado ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-success-500/30 bg-success-500/5 p-4 text-sm text-slate-700">
                  <strong className="text-success-600">Cadastro criado.</strong>
                  <p className="mt-1">Compartilhe o link abaixo com o participante para que ele tire as 2 fotos do rosto.</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Protocolo</p>
                  <p className="mt-1 font-mono text-sm">{criado.protocolo}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Link de credenciamento</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs">{criado.link}</code>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(criado.link)}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      reset();
                      router.refresh();
                    }}
                  >
                    Cadastrar outro
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      close();
                      router.refresh();
                    }}
                  >
                    Concluir
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Evento</label>
                  <select
                    required
                    value={form.eventoId}
                    onChange={(e) => set('eventoId', e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">Selecione...</option>
                    {eventos.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} required />
                  <Input
                    label="Sobrenome"
                    value={form.sobrenome}
                    onChange={(e) => set('sobrenome', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="CPF"
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    value={form.cpf}
                    onChange={(e) => set('cpf', maskCpf(e.target.value))}
                    required
                  />
                  <Input
                    label="Data de nascimento"
                    placeholder="DD/MM/AAAA"
                    inputMode="numeric"
                    value={form.dataNascimento}
                    onChange={(e) => set('dataNascimento', maskData(e.target.value))}
                    required
                  />
                </div>

                <Input
                  label="Cargo"
                  placeholder="Opcional"
                  value={form.cargo}
                  onChange={(e) => set('cargo', e.target.value)}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="E-mail"
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    required
                  />
                  <Input
                    label="Celular"
                    placeholder="(88) 9XXXX-XXXX"
                    value={form.celular}
                    onChange={(e) => set('celular', maskCelular(e.target.value))}
                    required
                  />
                </div>

                <Input
                  label="Município"
                  value={form.municipio}
                  onChange={(e) => set('municipio', e.target.value.toUpperCase())}
                  required
                />

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
                    <ShieldAlert className="h-4 w-4" /> LGPD
                  </div>
                  <Checkbox
                    label="Confirmo que coletei o consentimento do participante de forma offline (formulário assinado, e-mail, etc) e me responsabilizo pela conformidade LGPD."
                    checked={form.consentimentoConfirmado}
                    onChange={(e) => set('consentimentoConfirmado', e.target.checked)}
                  />
                </div>

                {erro && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {erro}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={close}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" loading={pending}>
                    Criar participante
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
