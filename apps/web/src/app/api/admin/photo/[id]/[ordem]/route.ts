/**
 * Proxy autenticado para servir foto do participante via API.
 * O <img src=...> não envia o cookie httpOnly diretamente para a API NestJS
 * (origem diferente), então proxiamos pelo Next anexando o JWT do cookie.
 */
import { NextResponse } from 'next/server';
import { getAdminToken } from '@/lib/session';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(
  _req: Request,
  { params }: { params: { id: string; ordem: string } },
) {
  const token = getAdminToken();
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const upstream = await fetch(
    `${BASE_URL}/api/attendees/${params.id}/photos/${params.ordem}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!upstream.ok) {
    return new NextResponse('Foto indisponível', { status: upstream.status });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  return new NextResponse(buf, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
