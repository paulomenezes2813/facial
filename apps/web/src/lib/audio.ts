/**
 * Sons curtos via Web Audio API. Sem arquivos externos — geração programática.
 * Os tons são tocados em sequência para soar como confirmação/erro.
 */

type Tone = { freq: number; durMs: number; type?: OscillatorType; gain?: number };

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  const c = ctx;
  if (!c) return null;
  if (c.state === 'suspended') c.resume().catch(() => {});
  return c;
}

function play(tones: Tone[]) {
  const c = getCtx();
  if (!c) return;
  let t = c.currentTime;
  for (const tone of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(tone.gain ?? 0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.durMs / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + tone.durMs / 1000);
    t += tone.durMs / 1000;
  }
}

/** Beep duplo agudo — confirmação ("ok"). */
export function playSuccess() {
  play([
    { freq: 880, durMs: 120 },
    { freq: 1320, durMs: 180 },
  ]);
}

/** Beep grave curto — erro/no_match. */
export function playError() {
  play([{ freq: 220, durMs: 220, type: 'square', gain: 0.12 }]);
}

/** Click sutil ao detectar/scanear. */
export function playClick() {
  play([{ freq: 660, durMs: 60, gain: 0.08 }]);
}
