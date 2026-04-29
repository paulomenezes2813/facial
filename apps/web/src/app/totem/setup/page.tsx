'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/card';
import { totemApi, ApiError } from '@/lib/api';
import { loadTotemSession, saveTotemSession } from '@/lib/totem-storage';

export default function TotemSetup() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loadTotemSession()) {
      router.replace('/totem');
    }
  }, [router]);

  async function parear(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setPending(true);
    try {
      const session = await totemApi.session(apiKey.trim());
      saveTotemSession(session);
      router.replace('/totem');
    } catch (err) {
      setErro(
        err instanceof ApiError && err.status === 401
          ? 'Chave inválida. Confira no painel administrativo.'
          : 'Não foi possível parear o totem.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-6 text-white">
      <Card className="w-full max-w-md text-slate-900">
        <CardHeader
          icon={<Tv className="h-5 w-5" />}
          title="Pareamento do totem"
          subtitle="Cole a apiKey gerada no painel para vincular este totem ao evento."
        />
        <form onSubmit={parear} className="mt-6 flex flex-col gap-4">
          <Input
            label="API Key do totem"
            icon={<KeyRound className="h-4 w-4" />}
            placeholder="tk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoFocus
            required
          />
          {erro && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          )}
          <Button type="submit" size="lg" loading={pending}>
            Parear
          </Button>
        </form>
      </Card>
    </main>
  );
}
