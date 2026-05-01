/**
 * Análise leve de qualidade da imagem capturada da webcam.
 * Roda no browser, sem dependências, em sub-amostragem para ser rápido.
 *
 * - computeSharpness: aproximação de variância de Laplaciano (proxy de foco).
 * - computeBrightness: luminância média (ITU-R BT.601), 0–255.
 * - validateQuality: verifica thresholds e devolve dica amigável.
 */

const SAMPLE_STEP = 4; // pula pixels para acelerar (1 em cada 4 em x e em y)

export function computeBrightness(imageData: ImageData): number {
  const { data, width, height } = imageData;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += SAMPLE_STEP) {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // ITU-R BT.601 luma
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += luma;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Aproximação de variância de Laplaciano usando vizinhos (4-conexo).
 * Não é exatamente cv2.Laplacian, mas correlaciona bem para detectar borrão.
 */
export function computeSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData;
  // converte para luma em um buffer plano
  const luma = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    luma[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // varredura amostrada
  for (let y = SAMPLE_STEP; y < height - SAMPLE_STEP; y += SAMPLE_STEP) {
    for (let x = SAMPLE_STEP; x < width - SAMPLE_STEP; x += SAMPLE_STEP) {
      const idx = y * width + x;
      const center = luma[idx];
      const up = luma[idx - width];
      const down = luma[idx + width];
      const left = luma[idx - 1];
      const right = luma[idx + 1];
      const lap = up + down + left + right - 4 * center;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return variance;
}

export interface QualityResult {
  ok: boolean;
  sharpness: number;
  brightness: number;
  reason?: 'too_blurry' | 'too_dark' | 'too_bright';
  hint?: string;
}

// Thresholds empíricos. Webcam C920s costuma dar sharpness > 80 com foco bom.
// 30 é o piso pra evitar foto totalmente borrada / tampa fechada.
const MIN_SHARPNESS = 30;
const MIN_BRIGHTNESS = 50;
const MAX_BRIGHTNESS = 230;

export function validateQuality(params: {
  sharpness: number;
  brightness: number;
}): QualityResult {
  const { sharpness, brightness } = params;

  if (brightness < MIN_BRIGHTNESS) {
    return {
      ok: false,
      sharpness,
      brightness,
      reason: 'too_dark',
      hint: 'Ambiente muito escuro. Vá para um lugar mais iluminado.',
    };
  }
  if (brightness > MAX_BRIGHTNESS) {
    return {
      ok: false,
      sharpness,
      brightness,
      reason: 'too_bright',
      hint: 'Imagem muito clara/estourada. Evite luz forte direto na câmera.',
    };
  }
  if (sharpness < MIN_SHARPNESS) {
    return {
      ok: false,
      sharpness,
      brightness,
      reason: 'too_blurry',
      hint: 'Imagem borrada. Fique parado e a câmera pode levar 1s para focar.',
    };
  }

  return { ok: true, sharpness, brightness };
}
