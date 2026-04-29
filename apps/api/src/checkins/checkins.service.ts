import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface ListParams {
  eventId?: string;
  /** YYYY-MM-DD para filtrar 1 dia. */
  dia?: string;
  tipo?: 'AUTO' | 'MANUAL';
  totemId?: string;
  /** Busca livre por nome/sobrenome/cpfLast3 do participante. */
  q?: string;
}

interface ListByEventParams extends ListParams {
  eventId: string;
}

@Injectable()
export class CheckinsService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: ListParams) {
    const where: Prisma.CheckinWhereInput = {};
    if (params.eventId) where.eventId = params.eventId;
    if (params.tipo) where.tipo = params.tipo;
    if (params.totemId) where.totemId = params.totemId;
    if (params.dia) {
      const start = new Date(`${params.dia}T00:00:00`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      where.registradoEm = { gte: start, lt: end };
    }
    if (params.q && params.q.trim()) {
      const q = params.q.trim();
      const onlyDigits = q.replace(/\D/g, '');
      where.attendee = {
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { sobrenome: { contains: q, mode: 'insensitive' } },
          ...(onlyDigits ? [{ cpfLast3: onlyDigits.slice(-3) }] : []),
        ],
      };
    }
    return this.prisma.checkin.findMany({
      where,
      orderBy: { registradoEm: 'desc' },
      take: 500,
      include: {
        attendee: {
          select: {
            id: true,
            nome: true,
            sobrenome: true,
            cpfLast3: true,
            cargo: true,
            municipio: true,
          },
        },
        evento: { select: { id: true, nome: true } },
        totem: { select: { id: true, nome: true } },
      },
    });
  }

  listByEvent(params: ListByEventParams) {
    return this.list(params);
  }

  listByAttendee(attendeeId: string) {
    return this.prisma.checkin.findMany({
      where: { attendeeId },
      orderBy: { registradoEm: 'desc' },
      include: { totem: { select: { id: true, nome: true } } },
    });
  }

  /** Agrupa contagem por dia (YYYY-MM-DD) — útil pra evento multi-dia. */
  async daysSummary(eventId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ dia: string; total: bigint }>>`
      SELECT to_char("registradoEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS dia,
             COUNT(*) AS total
        FROM "checkins"
       WHERE "eventId" = ${eventId}
       GROUP BY 1
       ORDER BY 1
    `;
    return rows.map((r) => ({ dia: r.dia, total: Number(r.total) }));
  }
}
