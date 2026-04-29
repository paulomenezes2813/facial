import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecognitionService } from '../recognition/recognition.service';

interface CreateEventDto {
  nome: string;
  inicio: Date;
  fim: Date;
  local?: string;
  retencaoDias?: number;
}

interface UpdateEventDto {
  nome?: string;
  inicio?: Date;
  fim?: Date;
  local?: string | null;
  retencaoDias?: number;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recognition: RecognitionService,
  ) {}

  list() {
    return this.prisma.event.findMany({
      orderBy: { inicio: 'desc' },
      include: { _count: { select: { attendees: true } } },
    });
  }

  async byId(id: string) {
    const e = await this.prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { attendees: true } } },
    });
    if (!e) throw new NotFoundException('Evento não encontrado');
    return e;
  }

  create(data: CreateEventDto) {
    return this.prisma.event.create({ data });
  }

  async update(id: string, data: UpdateEventDto) {
    await this.byId(id);
    return this.prisma.event.update({ where: { id }, data });
  }

  /** Apaga evento + todos os participantes + embeddings no Qdrant. LGPD. */
  async remove(id: string) {
    await this.byId(id);
    await this.recognition.deleteEvent(id);
    await this.prisma.event.delete({ where: { id } });
    return { ok: true };
  }
}
