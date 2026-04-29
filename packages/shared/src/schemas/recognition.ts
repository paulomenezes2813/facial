import { z } from 'zod';

/** Request enviado pelo backend Node ao microserviço Python para cadastrar um rosto. */
export const EnrollRequestSchema = z.object({
  attendeeId: z.string().uuid(),
  eventId: z.string().uuid(),
  /** Imagem em base64 (sem prefixo data:). */
  imageBase64: z.string().min(100),
});
export type EnrollRequest = z.infer<typeof EnrollRequestSchema>;

export const EnrollResponseSchema = z.object({
  attendeeId: z.string().uuid(),
  embeddingId: z.string(),
  qualityScore: z.number().min(0).max(1),
  livenessScore: z.number().min(0).max(1),
  faceCount: z.number().int(),
});
export type EnrollResponse = z.infer<typeof EnrollResponseSchema>;

/** Request de busca enviado pelo totem. */
export const MatchRequestSchema = z.object({
  eventId: z.string().uuid(),
  imageBase64: z.string().min(100),
  /** Threshold opcional; default vem do .env do microserviço. */
  threshold: z.number().min(0).max(1).optional(),
});
export type MatchRequest = z.infer<typeof MatchRequestSchema>;

export const MatchResponseSchema = z.object({
  matched: z.boolean(),
  attendeeId: z.string().uuid().optional(),
  similarity: z.number().min(0).max(1).optional(),
  livenessScore: z.number().min(0).max(1),
  /** Razão quando matched=false. */
  reason: z.enum(['no_face', 'multiple_faces', 'low_liveness', 'below_threshold', 'ok']),
});
export type MatchResponse = z.infer<typeof MatchResponseSchema>;
