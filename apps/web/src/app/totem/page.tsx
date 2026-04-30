'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Maximize2, Minimize2, Pause, Play, UserSearch } from 'lucide-react';
import { totemApi, ApiError, type CheckinResponse } from '@/lib/api';
import { clearTotemSession, loadTotemSession } from '@/lib/totem-storage';
import { KioskDisplay, type KioskState } from '@/components/totem/KioskDisplay';
import { CheckinManualModal } from '@/components/totem/CheckinManualModal';
import { useFullscreen } from '@/lib/useFullscreen';
import { playClick, playError, playSuccess } from '@/lib/audio';

const CAPTURE_INTERVAL_MS = 2500;
const COOLDOWN_AFTER_RESULT_MS = 5000;
const NO_MATCH_AUTO_CLEAR_MS = 4000;

export default function TotemKiosk() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inFlightRef = useRef(false);
  const cooldownUntilRef = useRef<number>(0);

  const [session, setSession] = useState<ReturnType<typeof loadTotemSession>>(null);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [estado, setEstado] = useState<KioskState>({ kind: 'idle' });
  const [manualOpen, setManualOpen] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const { isFs, toggle: toggleFs } = useFullscreen();

  function togglePause() {
    setPaused((p) => {
      const next = !p;
      setEstado(next ? { kind: 'paused' } : { kind: 'idle' });
      // Quando pausa, garante que o cooldown não atrapalhe o retorno
      cooldownUntilRef.current = 0;
      return next;
    });
  }

  // -------- Sessão --------
  useEffect(() => {
    const s = loadTotemSession();
    if (!s) {
      router.replace('/totem/setup');
      return;
    }
    setSession(s);
  }, [router]);

  // -------- Câmera --------
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e: any) {
        setErroCamera(
          e?.name === 'NotAllowedError'
            ? 'Permissão da câmera negada.'
            : 'Não foi possível acessar a câmera.',
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [session]);

  // -------- Lidar com resultado de check-in (auto ou manual) --------
  const handleResult = useCallback((res: CheckinResponse) => {
    if (res.matched && res.attendee) {
      if (audioOn) playSuccess();
      setEstado({ kind: 'matched', data: res.attendee });
      cooldownUntilRef.current = Date.now() + COOLDOWN_AFTER_RESULT_MS;
      setTimeout(() => setEstado({ kind: 'idle' }), COOLDOWN_AFTER_RESULT_MS);
    } else {
      if (audioOn) playError();
      setEstado({ kind: 'no_match', reason: res.reason });
      cooldownUntilRef.current = Date.now() + NO_MATCH_AUTO_CLEAR_MS;
      setTimeout(() => setEstado({ kind: 'idle' }), NO_MATCH_AUTO_CLEAR_MS);
    }
  }, [audioOn]);

  // -------- Captura automática --------
  const tickCapture = useCallback(async () => {
    if (!session || erroCamera || manualOpen || paused) return;
    if (inFlightRef.current) return;
    if (Date.now() < cooldownUntilRef.current) return;
    if (estado.kind === 'matched') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];

    inFlightRef.current = true;
    if (audioOn) playClick();
    setEstado({ kind: 'scanning' });

    try {
      const res = await totemApi.checkin(session.token, base64);
      handleResult(res);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        clearTotemSession();
        router.replace('/totem/setup');
        return;
      }
      if (audioOn) playError();
      setEstado({ kind: 'no_match', reason: 'erro' });
      cooldownUntilRef.current = Date.now() + NO_MATCH_AUTO_CLEAR_MS;
      setTimeout(() => setEstado({ kind: 'idle' }), NO_MATCH_AUTO_CLEAR_MS);
    } finally {
      inFlightRef.current = false;
    }
  }, [session, erroCamera, estado.kind, router, manualOpen, paused, audioOn, handleResult]);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(tickCapture, CAPTURE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session, tickCapture]);

  // -------- UI helpers --------
  function despareio() {
    if (!window.confirm('Despareiar este totem?')) return;
    clearTotemSession();
    router.replace('/totem/setup');
  }

  if (!session) return null;

  return (
    <main className="relative flex min-h-screen flex-col bg-slate-900 text-white">
      {/* Header — discreto pra não competir com o conteúdo */}
      <header className="flex items-center justify-between px-6 py-3 text-xs">
        <div>
          <p className="text-slate-400">Evento</p>
          <p className="font-semibold">{session.totem.evento.nome}</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            onClick={togglePause}
            title={paused ? 'Retomar identificação' : 'Pausar identificação'}
            highlight={paused}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            <span className="hidden sm:inline">{paused ? 'Retomar' : 'Pausar'}</span>
          </IconButton>
          <IconButton onClick={() => setAudioOn((v) => !v)} title={audioOn ? 'Silenciar' : 'Ativar som'}>
            {audioOn ? '🔊' : '🔇'}
          </IconButton>
          <IconButton onClick={toggleFs} title={isFs ? 'Sair do fullscreen' : 'Tela cheia'}>
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconButton>
          <IconButton onClick={despareio} title="Despareiar">
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      {/* Layout que vira coluna em portrait/mobile, lado-a-lado em landscape */}
      <div className="grid flex-1 grid-cols-1 gap-4 px-4 pb-4 sm:gap-6 sm:px-6 sm:pb-6 portrait:grid-rows-[3fr_2fr] landscape:grid-cols-2">
        {/* Câmera */}
        <div
          className={
            'relative overflow-hidden rounded-3xl bg-black transition ' +
            (paused ? 'opacity-40 grayscale' : '')
          }
        >
          {erroCamera ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-amber-300">
              {erroCamera}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
              <OvalGuide active={estado.kind === 'idle' || estado.kind === 'scanning'} />
              {estado.kind === 'scanning' && (
                <span className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 [animation:ring-pulse_1.4s_ease-out_infinite]" />
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Painel de feedback */}
        <div className="relative flex items-center justify-center rounded-3xl bg-white px-6 py-10 text-slate-900 sm:px-10">
          <KioskDisplay state={estado} eventoNome={session.totem.evento.nome} />

          {/* Botão de fallback manual — discreto no rodapé do painel */}
          <button
            onClick={() => setManualOpen(true)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-500 backdrop-blur transition hover:bg-white hover:text-slate-700"
          >
            <UserSearch className="h-3.5 w-3.5" />
            Não me identificou
          </button>
        </div>
      </div>

      {/* Modal de check-in manual */}
      <CheckinManualModal
        open={manualOpen}
        token={session.token}
        onClose={() => setManualOpen(false)}
        onConfirmed={handleResult}
      />
    </main>
  );
}

function IconButton({
  children,
  onClick,
  title,
  highlight,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 transition ' +
        (highlight
          ? 'border-amber-400/60 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
      }
    >
      {children}
    </button>
  );
}

function OvalGuide({ active }: { active: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 133"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Contorno com “sombra” para alto contraste, sem escurecer o vídeo */}
      <ellipse
        cx="50"
        cy="62"
        rx="28"
        ry="38"
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="2.2"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="50"
        cy="62"
        rx="28"
        ry="38"
        fill="none"
        stroke={active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)'}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
