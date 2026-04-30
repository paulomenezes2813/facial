'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, QrCode as QrCodeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EventItem = { id: string; nome: string };

export function EventQrCode({
  eventos,
  baseUrl,
}: {
  eventos: EventItem[];
  /** Opcional: origem pública do site (ex: https://app.com). */
  baseUrl?: string;
}) {
  const [eventoId, setEventoId] = useState<string>(eventos[0]?.id ?? '');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const origin = useMemo(() => {
    if (baseUrl && baseUrl.trim()) return baseUrl.replace(/\/$/, '');
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }, [baseUrl]);

  const url = useMemo(() => {
    if (!eventoId) return '';
    if (!origin) return `/credenciamento/${eventoId}`;
    return `${origin}/credenciamento/${eventoId}`;
  }, [eventoId, origin]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!url) {
        setQrDataUrl(null);
        return;
      }
      const data = await QRCode.toDataURL(url, {
        margin: 1,
        width: 360,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      if (!cancelled) setQrDataUrl(data);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: ignora (alguns browsers bloqueiam sem interação/https)
    }
  }

  const eventoNome = eventos.find((e) => e.id === eventoId)?.nome ?? '';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <QrCodeIcon className="h-5 w-5 text-slate-600" />
            QR Code do credenciamento
          </h2>
          <p className="text-sm text-slate-500">
            Selecione o evento para gerar um QR Code que abre o cadastro já com o evento marcado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Evento</label>
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            {eventos.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">Nenhum evento cadastrado ainda.</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Link do cadastro</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800"
              />
              <Button variant="secondary" onClick={copyLink} disabled={!url}>
                <Copy className="h-4 w-4" />
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Dica: imprima esse QR Code e deixe na entrada do evento.
            </p>
          </div>

          {eventoNome && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Evento selecionado: <strong className="text-slate-900">{eventoNome}</strong>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR Code do credenciamento"
              className="h-auto w-full max-w-[320px] rounded-xl bg-white p-3 shadow-sm"
            />
          ) : (
            <div className="flex h-[320px] w-[320px] items-center justify-center rounded-xl bg-white text-sm text-slate-500 shadow-sm">
              Selecione um evento
            </div>
          )}
          <p className="text-xs text-slate-500">Ao escanear, abre o cadastro do participante.</p>
        </div>
      </div>
    </div>
  );
}

