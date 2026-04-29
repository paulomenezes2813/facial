'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FaceCameraProps {
  /** Texto curto exibido abaixo da câmera. */
  titulo: string;
  /** Lista de dicas a mostrar. */
  dicas?: string[];
  /** Recebe a foto em base64 (sem prefixo data:). */
  onCapture: (imageBase64: string) => Promise<void> | void;
}

export function FaceCamera({ titulo, dicas = [], onCapture }: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Habilite o acesso e recarregue a página.'
          : 'Não foi possível acessar a câmera.',
      );
    }
  }, []);

  useEffect(() => {
    start();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function snapshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    // Espelha horizontalmente (selfie)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreviewUrl(dataUrl);
    // Para a câmera enquanto preview está visível
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  function retake() {
    setPreviewUrl(null);
    start();
  }

  async function confirm() {
    if (!previewUrl) return;
    setSubmitting(true);
    try {
      const base64 = previewUrl.split(',')[1] ?? previewUrl;
      await onCapture(base64);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Pré-visualização" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full -scale-x-100 object-cover"
            />
            <OvalOverlay />
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div>
        <h3 className="text-base font-bold text-slate-900">{titulo}</h3>
        {dicas.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
            <li>
              <strong>Dica:</strong> Olhe diretamente para a câmera.
            </li>
            {dicas.map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {previewUrl ? (
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={retake} className="flex-1" disabled={submitting}>
            <RefreshCw className="h-4 w-4" /> Tirar de novo
          </Button>
          <Button size="lg" onClick={confirm} loading={submitting} className="flex-1">
            <Check className="h-4 w-4" /> Usar esta
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={snapshot} disabled={!stream}>
          <Camera className="h-5 w-5" />
          Capturar
        </Button>
      )}
    </div>
  );
}

function OvalOverlay() {
  // SVG oval branco translúcido sobre o vídeo, igual à referência.
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 133"
      preserveAspectRatio="none"
    >
      <defs>
        <mask id="hole">
          <rect width="100" height="133" fill="white" />
          <ellipse cx="50" cy="62" rx="32" ry="42" fill="black" />
        </mask>
      </defs>
      <rect width="100" height="133" fill="rgba(0,0,0,0.35)" mask="url(#hole)" />
      <ellipse
        cx="50"
        cy="62"
        rx="32"
        ry="42"
        fill="none"
        stroke="white"
        strokeWidth="0.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
