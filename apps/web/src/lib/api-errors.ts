import { ApiError } from './api';

/** Mensagens HTTP em inglês que não ajudam o utilizador — substituímos por texto útil. */
function isGenericHttpMessage(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === '' ||
    t === 'internal server error' ||
    t === 'bad request' ||
    t === 'not found' ||
    t === 'conflict' ||
    t === 'unauthorized' ||
    t === 'forbidden' ||
    t === 'gateway timeout' ||
    t === 'bad gateway' ||
    t === 'service unavailable' ||
    t === 'payload too large'
  );
}

/** Extrai texto legível do JSON típico do NestJS (ValidationPipe, HttpException). */
function extractNestMessage(detail: unknown): string {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail.trim();
  if (typeof detail !== 'object') return String(detail);

  const o = detail as Record<string, unknown>;
  const msg = o.message;
  if (Array.isArray(msg)) {
    return msg.map((x) => String(x).trim()).filter(Boolean).join('. ');
  }
  if (typeof msg === 'string') return msg.trim();
  return '';
}

/** Mapa por código HTTP quando o corpo da resposta não traz motivo útil. */
function hintForStatus(status: number, fallback: string): string {
  switch (status) {
    case 400:
      return 'Os dados enviados não foram aceitos. Confira os campos obrigatórios e o formato (CPF, data, e-mail).';
    case 401:
      return 'Acesso não autorizado. Atualize a página ou entre em contato com o suporte.';
    case 403:
      return 'Esta ação não é permitida no momento.';
    case 404:
      return 'Não encontramos o que foi solicitado. Verifique o link ou tente mais tarde.';
    case 409:
      return 'Este CPF já está cadastrado neste evento. Se for você, avance para completar as fotos; caso contrário, use outro CPF.';
    case 413:
      return 'A foto ou os dados enviados são grandes demais. Tente outra foto ou reduza o tamanho.';
    case 422:
      return 'Alguns dados estão incorretos. Revise o formulário e envie novamente.';
    case 429:
      return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
    case 502:
    case 503:
    case 504:
      return 'O serviço está temporariamente indisponível. Tente novamente em alguns minutos.';
    case 500:
    default:
      if (status >= 500) {
        return 'Não foi possível concluir agora — ocorreu um problema no servidor. Tente de novo em instantes. Se continuar falhando, avise a organização do evento.';
      }
      return fallback;
  }
}

/**
 * Converte erros da API (NestJS, rede, JSON inválido) em texto útil para o utilizador final.
 *
 * @param contextFallback mensagem quando não há detalhe útil (ex.: "Não foi possível enviar seus dados.")
 */
export function humanizeApiError(error: unknown, contextFallback: string): string {
  if (error instanceof ApiError) {
    const raw = extractNestMessage(error.detail);
    const fromBody = raw || (typeof error.detail === 'string' ? error.detail.trim() : '');

    if (fromBody && !isGenericHttpMessage(fromBody)) {
      return fromBody;
    }

    return hintForStatus(error.status, contextFallback);
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return contextFallback;
}
