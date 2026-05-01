import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RecognitionService } from '../recognition/recognition.service';
import { StorageService } from '../storage/storage.service';

export interface CheckinResult {
  matched: boolean;
  attendee?: {
    id: string;
    nome: string;
    sobrenome: string;
    cargo: string | null;
    municipio: string;
    cpfLast3: string;
    jaCheckin: boolean;
    checkInEm: string;
  };
  similarity?: number;
  reason?: string;
}

@Injectable()
export class TotemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recognition: RecognitionService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
  ) {}

  // -------------------------------------------------------------------------
  // Admin: criação/listagem/exclusão de totens
  // -------------------------------------------------------------------------

  async createForEvent(eventId: string, nome: string) {
    const evento = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!evento) throw new NotFoundException('Evento não encontrado');

    const apiKey = `tk_${randomBytes(24).toString('base64url')}`;
    return this.prisma.totem.create({
      data: { nome, apiKey, eventId },
    });
  }

  listByEvent(eventId: string) {
    return this.prisma.totem.findMany({
      where: { eventId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async update(totemId: string, data: { nome?: string }) {
    return this.prisma.totem.update({
      where: { id: totemId },
      data: { ...(data.nome ? { nome: data.nome } : {}) },
    });
  }

  listAll() {
    return this.prisma.totem.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { evento: { select: { id: true, nome: true } } },
    });
  }

  async remove(totemId: string) {
    await this.prisma.totem.delete({ where: { id: totemId } });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Pareamento: apiKey -> JWT escopado ao evento
  // -------------------------------------------------------------------------

  async session(apiKey: string) {
    const totem = await this.prisma.totem.findUnique({
      where: { apiKey },
      include: { evento: true },
    });
    if (!totem) throw new UnauthorizedException('apiKey inválida');

    await this.prisma.totem.update({
      where: { id: totem.id },
      data: { ultimoSync: new Date() },
    });

    const token = await this.jwt.signAsync(
      {
        sub: totem.id,
        type: 'totem' as const,
        eventId: totem.eventId,
      },
      { expiresIn: '30d' },
    );

    return {
      token,
      totem: {
        id: totem.id,
        nome: totem.nome,
        evento: {
          id: totem.evento.id,
          nome: totem.evento.nome,
          inicio: totem.evento.inicio,
          fim: totem.evento.fim,
        },
      },
    };
  }

  /**
   * Dev-only helper: cria sessão do totem para um evento arbitrário.
   * Não usa apiKey, apenas o totemId já autenticado via JWT.
   */
  async sessionForEvent(totemId: string, eventId: string) {
    const [totem, evento] = await Promise.all([
      this.prisma.totem.findUnique({ where: { id: totemId } }),
      this.prisma.event.findUnique({ where: { id: eventId } }),
    ]);
    if (!totem) throw new UnauthorizedException('Totem inválido');
    if (!evento) throw new NotFoundException('Evento não encontrado');

    await this.prisma.totem.update({
      where: { id: totem.id },
      data: { ultimoSync: new Date(), eventId },
    });

    const token = await this.jwt.signAsync(
      {
        sub: totem.id,
        type: 'totem' as const,
        eventId,
      },
      { expiresIn: '30d' },
    );

    return {
      token,
      totem: {
        id: totem.id,
        nome: totem.nome,
        evento: {
          id: evento.id,
          nome: evento.nome,
          inicio: evento.inicio,
          fim: evento.fim,
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Check-in: captura → match → marca presença
  // -------------------------------------------------------------------------

  async checkin(totemId: string, eventId: string, imageBase64: string): Promise<CheckinResult> {
    const matchRes = await this.recognition.match({
      eventId,
      imageBase64,
    });

    if (!matchRes.matched) {
      await this.audit(null, 'MATCH_FAIL', `totem:${totemId}`, {
        reason: matchRes.reason,
        similarity: matchRes.similarity,
      });
      return { matched: false, reason: matchRes.reason, similarity: matchRes.similarity };
    }

    const attendee = await this.prisma.attendee.findUnique({
      where: { id: matchRes.attendee_id },
    });
    if (!attendee) {
      // embedding existe no Qdrant mas attendee foi excluído — tratar como no_match
      return { matched: false, reason: 'attendee_missing' };
    }

    const jaCheckin = attendee.status === 'CHECKED_IN';
    const agora = new Date();

    // Sempre cria 1 registro novo no histórico (pode haver várias passagens)
    await this.prisma.checkin.create({
      data: {
        attendeeId: attendee.id,
        eventId,
        totemId,
        tipo: 'AUTO',
        similarity: matchRes.similarity,
        registradoEm: agora,
      },
    });

    // Atualiza o cache de "última passagem" e marca CHECKED_IN se for o primeiro.
    const updated = await this.prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        ...(jaCheckin ? {} : { status: 'CHECKED_IN' }),
        checkInEm: agora,
        checkInTotemId: totemId,
      },
    });

    await this.audit(attendee.id, jaCheckin ? 'CHECKIN_DUP' : 'CHECKIN_OK', `totem:${totemId}`, {
      similarity: matchRes.similarity,
    });

    return {
      matched: true,
      similarity: matchRes.similarity,
      attendee: {
        id: updated.id,
        nome: updated.nome,
        sobrenome: updated.sobrenome,
        cargo: updated.cargo,
        municipio: updated.municipio,
        cpfLast3: updated.cpfLast3,
        jaCheckin,
        checkInEm: (updated.checkInEm ?? new Date()).toISOString(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Check-in manual (fallback quando o reconhecimento facial falha)
  // -------------------------------------------------------------------------

  /** Busca participantes do evento (apenas nome/protocolo/cpfLast3 — sem dado sensível). */
  searchAttendees(eventId: string, q: string) {
    const query = (q ?? '').trim();
    if (!query) {
      return this.prisma.attendee.findMany({
        where: { eventId, status: { not: 'DELETED' } },
        orderBy: { criadoEm: 'desc' },
        take: 20,
        select: {
          id: true,
          nome: true,
          sobrenome: true,
          cpfLast3: true,
          status: true,
          checkInEm: true,
          cargo: true,
          municipio: true,
          protocolo: true,
        },
      });
    }
    const onlyDigits = query.replace(/\D/g, '');
    return this.prisma.attendee.findMany({
      where: {
        eventId,
        status: { not: 'DELETED' },
        OR: [
          { nome: { contains: query, mode: 'insensitive' } },
          { sobrenome: { contains: query, mode: 'insensitive' } },
          { protocolo: { contains: query.toLowerCase() } },
          ...(onlyDigits ? [{ cpfLast3: onlyDigits.slice(-3) }] : []),
        ],
      },
      orderBy: { nome: 'asc' },
      take: 30,
      select: {
        id: true,
        nome: true,
        sobrenome: true,
        cpfLast3: true,
        status: true,
        checkInEm: true,
        cargo: true,
        municipio: true,
        protocolo: true,
      },
    });
  }

  /** Stream de foto do participante (escopado ao evento do totem). */
  async getPhotoStream(eventId: string, attendeeId: string, ordem: 1 | 2) {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      select: { id: true, eventId: true, status: true },
    });
    if (!attendee || attendee.status === 'DELETED') {
      throw new NotFoundException('Participante não encontrado');
    }
    if (attendee.eventId !== eventId) {
      throw new UnauthorizedException('Participante não pertence a este evento');
    }

    const photo = await this.prisma.photo.findUnique({
      where: { attendeeId_ordem: { attendeeId, ordem } },
      select: { storageKey: true },
    });
    if (!photo) throw new NotFoundException('Foto não encontrada');
    return this.storage.getStream(photo.storageKey);
  }

  async checkinManual(totemId: string, eventId: string, attendeeId: string): Promise<CheckinResult> {
    const attendee = await this.prisma.attendee.findUnique({ where: { id: attendeeId } });
    if (!attendee) throw new NotFoundException('Participante não encontrado');
    if (attendee.eventId !== eventId) {
      throw new UnauthorizedException('Participante não pertence a este evento');
    }

    const jaCheckin = attendee.status === 'CHECKED_IN';
    const agora = new Date();

    await this.prisma.checkin.create({
      data: {
        attendeeId,
        eventId,
        totemId,
        tipo: 'MANUAL',
        registradoEm: agora,
      },
    });

    const updated = await this.prisma.attendee.update({
      where: { id: attendeeId },
      data: {
        ...(jaCheckin ? {} : { status: 'CHECKED_IN' }),
        checkInEm: agora,
        checkInTotemId: totemId,
      },
    });

    await this.audit(attendeeId, jaCheckin ? 'CHECKIN_DUP' : 'CHECKIN_MANUAL', `totem:${totemId}`);

    return {
      matched: true,
      attendee: {
        id: updated.id,
        nome: updated.nome,
        sobrenome: updated.sobrenome,
        cargo: updated.cargo,
        municipio: updated.municipio,
        cpfLast3: updated.cpfLast3,
        jaCheckin,
        checkInEm: (updated.checkInEm ?? new Date()).toISOString(),
      },
    };
  }

  private audit(
    attendeeId: string | null,
    acao: string,
    ator: string,
    detalhes?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: { attendeeId, acao, ator, detalhes: detalhes as never },
    });
  }
}
