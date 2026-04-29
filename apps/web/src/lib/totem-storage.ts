/** Persistência local da sessão do totem (localStorage). Roda no browser. */
import type { TotemSession } from './api';

const KEY = 'facial.totem.session';

export function saveTotemSession(s: TotemSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function loadTotemSession(): TotemSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TotemSession;
  } catch {
    return null;
  }
}

export function clearTotemSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
