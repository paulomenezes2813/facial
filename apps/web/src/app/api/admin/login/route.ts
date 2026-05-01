import { NextResponse } from 'next/server';
import { adminApi } from '@/lib/api';
import { setAdminToken } from '@/lib/session';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { email?: unknown; senha?: unknown };
  const email = typeof body?.email === 'string' ? body.email : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';

  if (!email || !senha) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  try {
    const { token, user } = await adminApi.login(email, senha);
    setAdminToken(token);
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[admin/login] erro ao chamar API:', {
      name: e?.name,
      message: e?.message,
      status: e?.status,
      detail: e?.detail,
      url: e?.url,
    });
    const msg =
      typeof e?.detail?.message === 'string'
        ? e.detail.message
        : Array.isArray(e?.detail?.message)
          ? e.detail.message.join(', ')
          : 'Credenciais inválidas';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

