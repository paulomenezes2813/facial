'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const senha = String(form.get('senha') ?? '');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErro(data?.error ?? 'Credenciais inválidas');
        return;
      }

      startTransition(() => {
        router.push('/admin/eventos');
        router.refresh();
      });
    } catch {
      setErro('Falha ao conectar com o servidor');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <Card className="w-full max-w-sm">
        <CardHeader
          icon={<LogIn className="h-5 w-5" />}
          title="Painel administrativo"
          subtitle="Acesse com suas credenciais."
        />
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            type="email"
            name="email"
            label="E-mail"
            autoComplete="email"
            required
            defaultValue=""
          />
          <Input
            type="password"
            name="senha"
            label="Senha"
            autoComplete="current-password"
            required
          />
          {erro && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          )}
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
