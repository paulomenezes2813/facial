import { z } from 'zod';

/** Validador básico de CPF (apenas formato; algoritmo dos dígitos verificadores). */
const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

export const AttendeeRegistrationSchema = z
  .object({
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
    cpfResponsavel: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const birth = new Date(data.dataNascimento + 'T12:00:00');
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    if (age >= 18) return;
    const digits = (data.cpfResponsavel ?? '').replace(/\D/g, '');
    if (digits.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CPF do responsável é obrigatório para menores de 18 anos.',
        path: ['cpfResponsavel'],
      });
    }
  });

export type AttendeeRegistration = z.infer<typeof AttendeeRegistrationSchema>;

export const AttendeeStatus = z.enum(['pending_photos', 'pre_registered', 'checked_in', 'deleted']);
export type AttendeeStatus = z.infer<typeof AttendeeStatus>;
