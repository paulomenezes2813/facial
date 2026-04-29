/**
 * Sessão do admin no Server. Usa cookie httpOnly para guardar o JWT.
 * Compatível com Server Components, Server Actions e Route Handlers.
 */
import { cookies } from 'next/headers';

const COOKIE_NAME = 'facial_admin_token';
const MAX_AGE = 60 * 60 * 12; // 12h, alinhado com o JWT

export function getAdminToken(): string | null {
  return cookies().get(COOKIE_NAME)?.value ?? null;
}

export function requireAdminToken(): string {
  const t = getAdminToken();
  if (!t) {
    // Em RSC, a página chama redirect() depois disso.
    throw new Error('NO_ADMIN_TOKEN');
  }
  return t;
}

export function setAdminToken(token: string) {
  cookies().set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearAdminToken() {
  cookies().delete(COOKIE_NAME);
}
