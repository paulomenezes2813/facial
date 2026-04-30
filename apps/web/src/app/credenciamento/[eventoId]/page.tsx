import { CredenciamentoFlow } from '@/components/credenciamento/CredenciamentoFlow';

type EventListItem = { id: string; nome: string };

interface PageProps {
  params: { eventoId: string };
}

export default async function CredenciamentoPage({ params }: PageProps) {
  // Busca eventos no servidor para preencher o select.
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  let eventos: EventListItem[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/events`, { cache: 'no-store' });
    if (res.ok) {
      const data: any[] = await res.json();
      eventos = data.map((e) => ({ id: e.id, nome: e.nome }));
    }
  } catch {
    /* fallback silencioso — o componente avisa se a lista vier vazia */
  }

  return (
    <CredenciamentoFlow
      eventos={eventos}
      eventoIdInicial={params.eventoId}
      travarEvento={true}
    />
  );
}
