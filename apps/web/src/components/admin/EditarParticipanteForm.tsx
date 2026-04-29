'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Mail, MapPin, Phone, Save, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { maskCelular } from '@/lib/masks';
import type { AdminAttendeeDetail } from '@/lib/api';

interface Props {
  attendee: AdminAttendeeDetail;
  onSave: (data: Record<string, string | null>) => Promise<void>;
}

export function EditarParticipanteForm({ attendee, onSave }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);

  const [form, setForm] = useState({
    nome: attendee.nome,
    sobrenome: attendee.sobrenome,
    cargo: attendee.cargo ?? '',
    email: attendee.email,
    celular: attendee.celular,
    municipio: attendee.municipio,
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(false);
    startTransition(async () => {
      await onSave({
        nome: form.nome,
        sobrenome: form.sobrenome,
        cargo: form.cargo || null,
        email: form.email,
        celular: form.celular,
        municipio: form.municipio,
      });
      setOk(true);
      router.refresh();
      setTimeout(() => setOk(false), 2500);
    });
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader
          icon={<User className="h-5 w-5" />}
          title="Editar dados"
          subtitle="Campos imutáveis (CPF, data, evento) ficam abaixo somente leitura."
        />

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} required />
          <Input
            label="Sobrenome"
            value={form.sobrenome}
            onChange={(e) => set('sobrenome', e.target.value)}
            required
          />
          <Input
            label="E-mail"
            type="email"
            icon={<Mail className="h-4 w-4" />}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
          <Input
            label="Celular"
            icon={<Phone className="h-4 w-4" />}
            value={form.celular}
            onChange={(e) => set('celular', maskCelular(e.target.value))}
          />
          <Input
            label="Cargo"
            icon={<Briefcase className="h-4 w-4" />}
            value={form.cargo}
            onChange={(e) => set('cargo', e.target.value)}
          />
          <Input
            label="Município"
            icon={<MapPin className="h-4 w-4" />}
            value={form.municipio}
            onChange={(e) => set('municipio', e.target.value.toUpperCase())}
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          {ok && <span className="text-sm text-success-600">Salvo ✓</span>}
          <Button type="submit" loading={pending}>
            <Save className="h-4 w-4" /> Salvar alterações
          </Button>
        </div>
      </Card>
    </form>
  );
}
