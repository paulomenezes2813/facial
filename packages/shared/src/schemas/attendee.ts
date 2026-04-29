import { z } from 'zod';

/** Validador básico de CPF (apenas formato; algoritmo dos dígitos verificadores). */
const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

export const AttendeeRegistrationSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome').max(80),
  sobrenome: z.string().trim().min(1, 'Informe o sobrenome').max(120),
  cpf: z.string().regex(cpfRegex, 'CPF inválido'),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)'),
  cargo: z.string().trim().max(100).optional().nullable(),
  email: z.string().email('E-mail inválido'),
  celular: z
    .string()
    .regex(/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/, 'Celular inválido')
    .transform((v) => v.replace(/\D/g, '')),
  municipio: z.string().trim().min(1, 'Informe o município').transform((v) => v.toUpperCase()),
  consentimentoLgpd: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar o termo de consentimento' }),
  }),
  eventoId: z.string().uuid(),
});

export type AttendeeRegistration = z.infer<typeof AttendeeRegistrationSchema>;

export const AttendeeStatus = z.enum(['pending_photos', 'pre_registered', 'checked_in', 'deleted']);
export type AttendeeStatus = z.infer<typeof AttendeeStatus>;
