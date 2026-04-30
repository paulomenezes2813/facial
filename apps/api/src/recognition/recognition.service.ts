import { HttpException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface EnrollDto {
  attendeeId: string;
  eventId: string;
  imageBase64: string;
}

interface MatchDto {
  eventId: string;
  imageBase64: string;
  threshold?: number;
}

export interface RecognitionMatchResponse {
  matched: boolean;
  attendee_id?: string;
  similarity?: number;
  liveness_score: number;
  reason: 'no_face' | 'multiple_faces' | 'low_liveness' | 'below_threshold' | 'ok';
}

export interface RecognitionEnrollResponse {
  attendee_id: string;
  embedding_id: string;
  quality_score: number;
  liveness_score: number;
  face_count: number;
  face_image_base64?: string | null;
}

@Injectable()
export class RecognitionService {
  private readonly log = new Logger(RecognitionService.name);
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.RECOGNITION_URL ?? 'http://localhost:8000',
      timeout: 30_000,
      maxBodyLength: 20 * 1024 * 1024, // 20MB
      maxContentLength: 20 * 1024 * 1024,
    });
  }

  async enroll(dto: EnrollDto): Promise<{
    embeddingId: string;
    qualityScore: number;
    livenessScore: number;
    faceImageBase64?: string | null;
  }> {
    try {
      const { data } = await this.http.post<RecognitionEnrollResponse>('/enroll', {
        attendeeId: dto.attendeeId,
        eventId: dto.eventId,
        imageBase64: dto.imageBase64,
      });
      return {
        embeddingId: data.embedding_id,
        qualityScore: data.quality_score,
        livenessScore: data.liveness_score,
        faceImageBase64: data.face_image_base64 ?? null,
      };
    } catch (err: any) {
      const code = err?.code;
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status ?? 500;

      // Sem resposta = problema de rede (serviço fora do ar / timeout / DNS)
      if (!err?.response) {
        const url = (err?.config?.baseURL ?? '') + (err?.config?.url ?? '');
        const msg = `Serviço de reconhecimento facial indisponível (${code ?? 'sem resposta'}) em ${url}. Verifique se o serviço Python está rodando.`;
        this.log.error(msg);
        throw new HttpException(msg, 503);
      }

      this.log.error(`Falha no enroll (HTTP ${status}): ${JSON.stringify(detail ?? err?.message)}`);
      // Se o Python retornou um motivo estruturado, repassamos
      if (detail && typeof detail === 'object' && detail.message) {
        throw new HttpException(detail.message, status);
      }
      throw new HttpException(
        typeof detail === 'string' ? detail : 'Falha ao processar a foto. Tente novamente.',
        status >= 400 && status < 500 ? status : 500,
      );
    }
  }

  async match(dto: MatchDto): Promise<RecognitionMatchResponse> {
    const { data } = await this.http.post<RecognitionMatchResponse>('/match', {
      eventId: dto.eventId,
      imageBase64: dto.imageBase64,
      threshold: dto.threshold,
    });
    return data;
  }

  async deleteEvent(eventId: string) {
    await this.http.delete(`/events/${eventId}/embeddings`);
  }

  async deleteEmbedding(embeddingId: string) {
    await this.http.delete(`/embeddings/${embeddingId}`);
  }
}
