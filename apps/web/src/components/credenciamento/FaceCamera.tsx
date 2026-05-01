'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computeBrightness, computeSharpness, validateQuality, type QualityResult } from '@/lib/imageQuality';

interface FaceCameraProps {
  /** Texto curto exibido abaixo da câmera. */
  titulo: string;
  /** Lista de dicas a mostrar. */
  dicas?: string[];
  /** Recebe a foto em base64 (sem prefixo data:). */
  onCapture: (imageBase64: string) => Promise<void> | void;
}

const FRAME_COUNT = 3;
const FRAME_INTERVAL_MS = 150;

export function FaceCamera({ titulo, dicas = [], onCapture }: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [quality, setQuality] = useState<QualityResult | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      // Garante que não fica uma stream anterior “presa” ao trocar de etapa (foto1 → foto2).
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);

      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        // Em alguns browsers/mobile, o autoplay não inicia sem chamar play() explicitamente.
        // O botão "Capturar" depende de stream != null, mas o preview pode ficar preto sem play().
        await videoRef.current.play().catch(() => {});
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Tira um snapshot do vídeo SEM espelhar (a imagem enviada deve ser
   * geometricamente correta — o backend espera selfie real, não invertida).
   * O preview na tela continua espelhado via CSS (-scale-x-100).
   */
  function grabFrame(): { dataUrl: string; imageData: ImageData } | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (!video.videoWidth || !video.videoHeight) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // IMPORTANTE: sem translate/scale — desenha igual ao sensor.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    return { dataUrl, imageData };
  }

  async function captureMultiFrame() {
    if (capturing) return;
    setCapturing(true);
    setQuality(null);

    try {
      const frames: { dataUrl: string; sharpness: number; brightness: number }[] = [];

      for (let i = 0; i < FRAME_COUNT; i++) {
        const f = grabFrame();
        if (f) {
          const sharpness = computeSharpness(f.imageData);
          const brightness = computeBrightness(f.imageData);
          frames.push({ dataUrl: f.dataUrl, sharpness, brightness });
        }
        if (i < FRAME_COUNT - 1) {
          await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
        }
      }

      if (frames.length === 0) return;

      // Escolhe o frame mais nítido.
      frames.sort((a, b) => b.sharpness - a.sharpness);
      const best = frames[0];

      const q = validateQuality({ sharpness: best.sharpness, brightness: best.brightness });
      setQuality(q);

      if (!q.ok) {
        // Não vai pro preview — mantém a câmera viva pra usuário tentar de novo.
        return;
      }

      setPreviewUrl(best.dataUrl);
      // Para a câmera enquanto preview está visível.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    } finally {
      setCapturing(false);
    }
  }

  function retake() {
    setPreviewUrl(null);
    setQuality(null);
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
          <img
            src={previewUrl}
            alt="Pré-visualização"
            // Espelha SÓ visualmente para parecer selfie — o base64 enviado segue não-espelhado.
            className="h-full w-full -scale-x-100 object-cover"
          />
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

      {quality && !quality.ok && !previewUrl && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <strong>Qualidade insuficiente.</strong> {quality.hint}
          </div>
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
        <Button size="lg" onClick={captureMultiFrame} disabled={!stream || capturing} loading={capturing}>
          <Camera className="h-5 w-5" />
          {capturing ? 'Capturando...' : 'Capturar'}
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
