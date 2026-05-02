/** Cliente HTTP para a API NestJS (público + admin). */

// API NestJS roda em 3001 por padrão (apps/api/.env: API_PORT=3001).
// Se mudar a porta da API, defina NEXT_PUBLIC_API_URL no apps/web/.env.local.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
    /** URL completa que falhou (ajuda muito no diagnóstico). */
    public url: string = '',
    /** Método HTTP. */
    public method: string = 'GET',
  ) {
    const detailMsg =
      typeof detail === 'string'
        ? detail
        : (detail as any)?.message
          ? (detail as any).message
          : `HTTP ${status}`;
    super(`${method} ${url} → ${status}: ${detailMsg}`);
  }
}

interface RequestOpts extends RequestInit {
  /** JWT a enviar no Authorization. Em SSR é resolvido pelos helpers do server.ts. */
  token?: string | null;
}

export async function request<T>(path: string, init: RequestOpts = {}): Promise<T> {
  const { token, headers, method = 'GET', ...rest } = init;
  const url = `${BASE_URL}/api${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
      cache: 'no-store',
      ...rest,
    });
  } catch (e: any) {
    throw new ApiError(0, `Falha de rede (${e?.message ?? 'desconhecida'})`, url, method);
  }
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      detail = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail, url, method);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface RegisterPayload {
  eventoId: string;
  nome: string;
  sobrenome: string;
  cpf: string;
  dataNascimento: string;
  cargo?: string | null;
  email: string;
  celular: string;
  municipio: string;
  consentimentoLgpd: true;
  /** Enviado quando o participante é menor de 18 anos. */
  cpfResponsavel?: string | null;
}
export interface RegisterResponse {
  id: string;
  protocolo: string;
}

export type AttendeeStatus =
  | 'PENDING_PHOTOS'
  | 'PRE_REGISTERED'
  | 'CHECKED_IN'
  | 'DELETED';

export interface AdminEvent {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  local: string | null;
  retencaoDias: number;
  criadoEm: string;
  _count?: { attendees: number };
}

export interface AdminAttendee {
  id: string;
  protocolo: string;
  nome: string;
  sobrenome: string;
  cpfLast3: string;
  email: string;
  celular: string;
  municipio: string;
  cargo: string | null;
  status: AttendeeStatus;
  checkInEm: string | null;
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// API público (cadastro)
// ---------------------------------------------------------------------------
export type CheckResponse =
  | { existe: false }
  | {
      existe: true;
      id: string;
      protocolo: string;
      nome: string;
      sobrenome: string;
      status: AttendeeStatus;
      fotosOrdens: number[];
      completo: boolean;
    };

export const api = {
  /** Lookup por CPF + evento. Decide se o usuário precisa cadastrar dados, foto ou nada. */
  check(eventoId: string, cpf: string): Promise<CheckResponse> {
    const qs = new URLSearchParams({ eventoId, cpf });
    return request<CheckResponse>(`/attendees/check?${qs}`);
  },

  register(payload: RegisterPayload): Promise<RegisterResponse> {
    return request('/attendees/register', { method: 'POST', body: JSON.stringify(payload) });
  },

  uploadPhoto(attendeeId: string, ordem: 1 | 2, imageBase64: string): Promise<{ photoId: string }> {
    return request(`/attendees/${attendeeId}/photos`, {
      method: 'POST',
      body: JSON.stringify({ ordem, imageBase64 }),
    });
  },
};

// ---------------------------------------------------------------------------
// API admin (recebe token explicitamente — chamada via Server Component / Action)
// ---------------------------------------------------------------------------
export const adminApi = {
  login(email: string, senha: string) {
    return request<{ token: string; user: { id: string; email: string; nome: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, senha }) },
    );
  },

  me(token: string) {
    return request<{ sub: string; email: string; type: 'admin' | 'totem' }>('/auth/me', { token });
  },

  events: {
    list(token: string) {
      return request<AdminEvent[]>('/events', { token });
    },
    byId(token: string, id: string) {
      return request<AdminEvent>(`/events/${id}`, { token });
    },
    create(
      token: string,
      data: { nome: string; inicio: string; fim: string; local?: string; retencaoDias?: number },
    ) {
      return request<AdminEvent>('/events', {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      });
    },
    update(
      token: string,
      id: string,
      data: { nome?: string; inicio?: string; fim?: string; local?: string | null; retencaoDias?: number },
    ) {
      return request<AdminEvent>(`/events/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      });
    },
    remove(token: string, id: string) {
      return request<{ ok: true }>(`/events/${id}`, { method: 'DELETE', token });
    },
  },

  attendees: {
    list(
      token: string,
      params: { eventId?: string; status?: string; q?: string } = {},
    ) {
      const qs = new URLSearchParams();
      if (params.eventId) qs.set('eventId', params.eventId);
      if (params.status) qs.set('status', params.status);
      if (params.q) qs.set('q', params.q);
      const url = `/attendees${qs.toString() ? `?${qs}` : ''}`;
      return request<AdminAttendeeListItem[]>(url, { token });
    },
    listByEvent(token: string, eventId: string) {
      return request<AdminAttendeeListItem[]>(`/attendees?eventId=${eventId}`, { token });
    },
    byId(token: string, id: string) {
      return request<AdminAttendeeDetail>(`/attendees/${id}`, { token });
    },
    update(
      token: string,
      id: string,
      data: {
        nome?: string;
        sobrenome?: string;
        cargo?: string | null;
        email?: string;
        celular?: string;
        municipio?: string;
      },
    ) {
      return request<AdminAttendeeDetail>(`/attendees/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      });
    },
    remove(token: string, id: string) {
      return request<{ ok: true }>(`/attendees/${id}`, { method: 'DELETE', token });
    },
    /** Re-indexa o embedding (usar quando a foto foi salva mas o reconhecimento estava down). */
    reenroll(token: string, id: string) {
      return request<{ ok: true; embeddingId: string }>(`/attendees/${id}/enroll`, {
        method: 'POST',
        token,
      });
    },
    /** Lista pendentes de indexação (com foto mas sem embedding). */
    listPendentes(token: string, eventId?: string) {
      const qs = eventId ? `?eventId=${eventId}` : '';
      return request<{ id: string; nome: string; sobrenome: string; eventId: string }[]>(
        `/attendees/pendentes/list${qs}`,
        { token },
      );
    },
    /** Re-indexa todos pendentes em lote. */
    enrollPendentes(token: string, eventId?: string) {
      const qs = eventId ? `?eventId=${eventId}` : '';
      return request<{
        total: number;
        ok: number;
        falhas: number;
        erros: { attendeeId: string; nome: string; erro: string }[];
      }>(`/attendees/pendentes/enroll-all${qs}`, { method: 'POST', token });
    },
    photoUrl(id: string, ordem: 1 | 2): string {
      return `${BASE_URL}/api/attendees/${id}/photos/${ordem}`;
    },
  },

  checkins: {
    list(
      token: string,
      params: {
        eventId?: string;
        dia?: string;
        tipo?: 'AUTO' | 'MANUAL';
        totemId?: string;
        q?: string;
      } = {},
    ) {
      const qs = new URLSearchParams();
      if (params.eventId) qs.set('eventId', params.eventId);
      if (params.dia) qs.set('dia', params.dia);
      if (params.tipo) qs.set('tipo', params.tipo);
      if (params.totemId) qs.set('totemId', params.totemId);
      if (params.q) qs.set('q', params.q);
      const url = `/checkins${qs.toString() ? `?${qs}` : ''}`;
      return request<AdminCheckinGlobal[]>(url, { token });
    },
    byEvent(
      token: string,
      eventId: string,
      params: { dia?: string; tipo?: 'AUTO' | 'MANUAL'; totemId?: string; q?: string } = {},
    ) {
      const qs = new URLSearchParams();
      if (params.dia) qs.set('dia', params.dia);
      if (params.tipo) qs.set('tipo', params.tipo);
      if (params.totemId) qs.set('totemId', params.totemId);
      if (params.q) qs.set('q', params.q);
      const url = `/events/${eventId}/checkins${qs.toString() ? `?${qs}` : ''}`;
      return request<AdminCheckin[]>(url, { token });
    },
    days(token: string, eventId: string) {
      return request<{ dia: string; total: number }[]>(`/events/${eventId}/checkins/days`, { token });
    },
    byAttendee(token: string, attendeeId: string) {
      return request<AdminCheckinWithoutAttendee[]>(`/attendees/${attendeeId}/checkins`, { token });
    },
  },

  totens: {
    listAll(token: string) {
      return request<AdminTotemRich[]>('/totens', { token });
    },
    listByEvent(token: string, eventId: string) {
      return request<AdminTotem[]>(`/events/${eventId}/totens`, { token });
    },
    create(token: string, eventId: string, nome: string) {
      return request<AdminTotem>(`/events/${eventId}/totens`, {
        method: 'POST',
        token,
        body: JSON.stringify({ nome }),
      });
    },
    update(token: string, id: string, data: { nome?: string }) {
      return request<AdminTotem>(`/totens/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      });
    },
    remove(token: string, id: string) {
      return request<{ ok: true }>(`/totens/${id}`, { method: 'DELETE', token });
    },
  },
};

export interface AdminAttendeeListItem extends AdminAttendee {
  eventId: string;
  evento?: { nome: string };
}

export interface AdminAttendeeDetail extends AdminAttendee {
  eventId: string;
  cpfHash: string;
  dataNascimento: string;
  evento: { id: string; nome: string };
  fotos: Array<{ id: string; ordem: number; storageKey: string; criadoEm: string }>;
  consentimentoLgpd: boolean;
  consentimentoEm: string | null;
  embeddingId: string | null;
}

export interface AdminTotemRich extends AdminTotem {
  evento: { id: string; nome: string };
}

export type CheckinTipo = 'AUTO' | 'MANUAL';

export interface AdminCheckinWithoutAttendee {
  id: string;
  attendeeId: string;
  eventId: string;
  totemId: string | null;
  tipo: CheckinTipo;
  similarity: number | null;
  registradoEm: string;
  totem: { id: string; nome: string } | null;
}

export interface AdminCheckin extends AdminCheckinWithoutAttendee {
  attendee: {
    id: string;
    nome: string;
    sobrenome: string;
    cpfLast3: string;
    cargo: string | null;
    municipio: string;
  };
}

/** Versão da listagem global, que inclui dados do evento. */
export interface AdminCheckinGlobal extends AdminCheckin {
  evento: { id: string; nome: string };
}

export interface AdminTotem {
  id: string;
  nome: string;
  eventId: string;
  apiKey: string;
  ultimoSync: string | null;
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// Cliente do totem (browser, JWT em localStorage)
// ---------------------------------------------------------------------------
export interface TotemSession {
  token: string;
  totem: {
    id: string;
    nome: string;
    evento: { id: string; nome: string; inicio: string; fim: string };
  };
}

export interface CheckinResponse {
  matched: boolean;
  similarity?: number;
  reason?: string;
  attendee?: {
    id: string;
    nome: string;
    sobrenome: string;
    cargo: string | null;
    municipio: string;
    cpfLast3: string;
    jaCheckin: boolean;
    checkInEm: string;
  };
}

export interface TotemAttendeeSearch {
  id: string;
  nome: string;
  sobrenome: string;
  cpfLast3: string;
  status: AttendeeStatus;
  checkInEm: string | null;
  cargo: string | null;
  municipio: string;
  protocolo: string;
}

export const totemApi = {
  session(apiKey: string) {
    return request<TotemSession>('/totem/session', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  },
  switchEvent(token: string, eventId: string) {
    return request<TotemSession>('/totem/switch-event', {
      method: 'POST',
      token,
      body: JSON.stringify({ eventId }),
    });
  },
  checkin(token: string, imageBase64: string) {
    return request<CheckinResponse>('/totem/checkin', {
      method: 'POST',
      token,
      body: JSON.stringify({ imageBase64 }),
    });
  },
  searchAttendees(token: string, q: string) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request<TotemAttendeeSearch[]>(`/totem/attendees${qs}`, { token });
  },
  checkinManual(token: string, attendeeId: string) {
    return request<CheckinResponse>('/totem/checkin-manual', {
      method: 'POST',
      token,
      body: JSON.stringify({ attendeeId }),
    });
  },
};
