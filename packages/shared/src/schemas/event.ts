import { z } from 'zod';

export const EventSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).max(120),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
  local: z.string().max(200).optional().nullable(),
  /** Dias de retenção pós-evento. Default 10. */
  retencaoDias: z.number().int().min(1).max(365).default(10),
});

export type Event = z.infer<typeof EventSchema>;
