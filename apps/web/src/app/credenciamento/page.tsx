import { CredenciamentoFlow } from '@/components/credenciamento/CredenciamentoFlow';

type EventListItem = { id: string; nome: string };

export default async function CredenciamentoIndex() {
  // Lista pública de eventos pra mostrar no select da primeira etapa.
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  let eventos: EventListItem[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/events`, { cache: 'no-store' });
    if (res.ok) {
      const data: any[] = await res.json();
      eventos = data.map((e) => ({ id: e.id, nome: e.nome }));
    }
  } catch {
    /* fallback silencioso */
  }

  return <CredenciamentoFlow eventos={eventos} />;
}
