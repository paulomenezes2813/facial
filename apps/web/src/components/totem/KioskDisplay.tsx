'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, PauseCircle, ScanFace, UserCheck, UserX } from 'lucide-react';
import type { CheckinResponse } from '@/lib/api';

export type KioskState =
  | { kind: 'idle' }
  | { kind: 'paused' }
  | { kind: 'scanning' }
  | { kind: 'matched'; data: NonNullable<CheckinResponse['attendee']> }
  | { kind: 'no_match'; reason?: string };

interface Props {
  state: KioskState;
  /** Nome do evento — exibido sutilmente em idle. */
  eventoNome?: string;
  /** Token do totem (JWT) — usado para buscar a foto do attendee. */
  token?: string;
}

export function KioskDisplay({ state, eventoNome, token }: Props) {
  switch (state.kind) {
    case 'idle':
      return (
        <Center>
          <Bubble color="brand" size="xl">
            <ScanFace className="h-24 w-24 sm:h-32 sm:w-32" strokeWidth={1.5} />
          </Bubble>
          <BigTitle>Posicione-se em frente à câmera</BigTitle>
          <BigSubtitle>Olhe para a câmera e aguarde a confirmação.</BigSubtitle>
          {eventoNome && (
            <p className="mt-4 text-base text-slate-400 sm:text-lg">{eventoNome}</p>
          )}
        </Center>
      );

    case 'paused':
      return (
        <Center>
          <Bubble color="amber" size="xl">
            <PauseCircle className="h-24 w-24 sm:h-32 sm:w-32" strokeWidth={1.5} />
          </Bubble>
          <BigTitle className="text-amber-700">Identificação pausada</BigTitle>
          <BigSubtitle>Toque em ▶ para retomar.</BigSubtitle>
        </Center>
      );

    case 'scanning':
      return (
        <Center>
          <Bubble color="brand" size="xl" className="animate-pulse">
            <Loader2 className="h-24 w-24 animate-spin sm:h-32 sm:w-32" strokeWidth={1.5} />
          </Bubble>
          <BigTitle>Identificando…</BigTitle>
          <BigSubtitle>Mantenha o rosto centralizado.</BigSubtitle>
        </Center>
      );

    case 'matched': {
      const a = state.data;
      const Icon = a.jaCheckin ? UserCheck : CheckCircle2;
      const titulo = a.jaCheckin ? 'Você já fez check-in' : 'Bem-vindo(a)!';
      const canShowPhoto = Boolean(token && a.id);
      return (
        <Center className="animate-[fade-in_0.4s_ease-out]">
          {canShowPhoto ? (
            <AttendeePhotoBubble
              token={token!}
              attendeeId={a.id}
              fallbackIcon={<Icon className="h-24 w-24 sm:h-32 sm:w-32" strokeWidth={1.5} />}
            />
          ) : (
            <Bubble
              color="success"
              size="xl"
              className="animate-[scale-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)]"
            >
              <Icon className="h-24 w-24 sm:h-32 sm:w-32" strokeWidth={1.5} />
            </Bubble>
          )}
          <BigTitle className="text-success-700">{titulo}</BigTitle>
          <p className="text-center text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
            {a.nome} {a.sobrenome}
          </p>
          {a.cargo && (
            <p className="text-center text-xl text-slate-600 sm:text-2xl">{a.cargo}</p>
          )}
          <p className="text-center text-base text-slate-400 sm:text-lg">{a.municipio}</p>
          {a.jaCheckin && a.checkInEm && (
            <p className="mt-2 text-sm text-slate-400 sm:text-base">
              Check-in registrado às{' '}
              {new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(
                new Date(a.checkInEm),
              )}
            </p>
          )}
        </Center>
      );
    }

    case 'no_match':
      return (
        <Center>
          <Bubble color="amber" size="xl">
            <UserX className="h-24 w-24 sm:h-32 sm:w-32" strokeWidth={1.5} />
          </Bubble>
          <BigTitle className="text-amber-700">Não conseguimos identificar</BigTitle>
          <BigSubtitle>{messageFor(state.reason)}</BigSubtitle>
        </Center>
      );
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function AttendeePhotoBubble({
  token,
  attendeeId,
  fallbackIcon,
}: {
  token: string;
  attendeeId: string;
  fallbackIcon: React.ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setFailed(false);
    setUrl(null);

    (async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
        // Busca JPEG do backend com Authorization (img src não consegue enviar header).
        const res = await fetch(`${baseUrl}/api/totem/attendees/${attendeeId}/photos/1`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`photo_fetch_failed_${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attendeeId, token]);

  return (
    <Bubble color="success" size="xl" className="animate-[scale-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)]">
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Foto do participante"
          className="h-full w-full rounded-[3rem] object-cover"
        />
      ) : (
        fallbackIcon
      )}
    </Bubble>
  );
}

function Center({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className ?? ''}`}>
      {children}
    </div>
  );
}

function BigTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-center text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl ${className ?? ''}`}
    >
      {children}
    </h2>
  );
}

function BigSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-lg text-slate-500 sm:text-xl lg:text-2xl">{children}</p>
  );
}

function Bubble({
  color,
  size = 'lg',
  className,
  children,
}: {
  color: 'brand' | 'success' | 'amber';
  size?: 'lg' | 'xl';
  className?: string;
  children: React.ReactNode;
}) {
  const colorMap = {
    brand: 'bg-brand-100 text-brand-600',
    success: 'bg-success-500/15 text-success-600',
    amber: 'bg-amber-100 text-amber-600',
  } as const;
  const sizeMap = {
    lg: 'h-32 w-32 sm:h-40 sm:w-40',
    xl: 'h-44 w-44 sm:h-56 sm:w-56 lg:h-64 lg:w-64',
  } as const;
  return (
    <div
      className={`flex items-center justify-center rounded-[3rem] shadow-sm ${colorMap[color]} ${sizeMap[size]} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

function messageFor(reason?: string): string {
  switch (reason) {
    case 'no_face':
      return 'Aproxime-se um pouco mais.';
    case 'multiple_faces':
      return 'Apenas uma pessoa por vez, por favor.';
    case 'low_liveness':
      return 'Não foi possível validar a captura. Tente novamente.';
    case 'below_threshold':
    case 'attendee_missing':
      return 'Verifique se você concluiu o pré-cadastro online.';
    default:
      return 'Tente novamente em alguns segundos.';
  }
}
