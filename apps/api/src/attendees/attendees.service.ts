import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RecognitionService } from '../recognition/recognition.service';
import { StorageService } from '../storage/storage.service';

interface RegisterDto {
  eventoId: string;
  nome: string;
  sobrenome: string;
  cpf: string;
  dataNascimento: string;
  cargo?: string | null;
  email: string;
  celular: string;
  municipio: string;
  consentimentoLgpd: true;
  consentimentoIp?: string;
}

interface AddPhotoDto {
  attendeeId: string;
  ordem: 1 | 2;
  imageBase64: string;
}

interface UpdateAttendeeDto {
  nome?: string;
  sobrenome?: string;
  cargo?: string | null;
  email?: string;
  celular?: string;
  municipio?: string;
}

@Injectable()
export class AttendeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recognition: RecognitionService,
    private readonly storage: StorageService,
  ) {}

  /** Cadastro inicial — só dados pessoais. Fotos vêm depois. */
  async register(dto: RegisterDto) {
    const cpfNormalized = dto.cpf.replace(/\D/g, '');
    if (cpfNormalized.length !== 11) {
      throw new BadRequestException('CPF inválido');
    }

    const cpfHash = createHash('sha256').update(cpfNormalized).digest('hex');
    const cpfLast3 = cpfNormalized.slice(-3);

    const protocolo = generateProtocol();

    let attendee;
    try {
      attendee = await this.prisma.attendee.create({
        data: {
          protocolo,
          eventId: dto.eventoId,
          nome: dto.nome,
          sobrenome: dto.sobrenome,
          cpfHash,
          cpfLast3,
          dataNascimento: new Date(dto.dataNascimento),
          cargo: dto.cargo ?? null,
          email: dto.email.toLowerCase(),
          celular: dto.celular,
          municipio: dto.municipio.toUpperCase(),
          consentimentoLgpd: true,
          consentimentoIp: dto.consentimentoIp,
          consentimentoEm: new Date(),
          status: 'PENDING_PHOTOS',
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('CPF já cadastrado para este evento.');
      }
      throw e;
    }

    await this.audit(attendee.id, 'REGISTER', 'system');
    return { id: attendee.id, protocolo: attendee.protocolo };
  }

  /** Upload da foto para o MinIO + chamada ao motor de reconhecimento (foto 1). */
  async addPhoto(dto: AddPhotoDto) {
    const attendee = await this.prisma.attendee.findUnique({ where: { id: dto.attendeeId } });
    if (!attendee) throw new NotFoundException('Participante não encontrado');

    const storageKey = `${attendee.eventId}/${dto.attendeeId}/foto${dto.ordem}.jpg`;
    await this.storage.putBase64(storageKey, dto.imageBase64);

    const photo = await this.prisma.photo.upsert({
      where: { attendeeId_ordem: { attendeeId: dto.attendeeId, ordem: dto.ordem } },
      create: {
        attendeeId: dto.attendeeId,
        ordem: dto.ordem,
        storageKey,
      },
      update: { storageKey },
    });

    if (dto.ordem === 1) {
      const result = await this.recognition.enroll({
        attendeeId: dto.attendeeId,
        eventId: attendee.eventId,
        imageBase64: dto.imageBase64,
      });
      await this.prisma.attendee.update({
        where: { id: dto.attendeeId },
        data: { embeddingId: result.embeddingId, status: 'PRE_REGISTERED' },
      });
      await this.audit(dto.attendeeId, 'ENROLL', 'system', { embeddingId: result.embeddingId });
    }

    return { photoId: photo.id };
  }

  byProtocolo(protocolo: string) {
    return this.prisma.attendee.findUnique({ where: { protocolo } });
  }

  /** Detalhe completo (admin). */
  async byId(id: string) {
    const a = await this.prisma.attendee.findUnique({
      where: { id },
      include: {
        evento: { select: { id: true, nome: true } },
        fotos: { select: { id: true, ordem: true, storageKey: true, criadoEm: true } },
      },
    });
    if (!a) throw new NotFoundException();
    return a;
  }

  list(params: { eventId?: string; status?: string; q?: string }) {
    const where: Prisma.AttendeeWhereInput = {
      status: { not: 'DELETED' },
      ...(params.eventId ? { eventId: params.eventId } : {}),
      ...(params.status && params.status !== 'ALL'
        ? { status: params.status as Prisma.EnumAttendeeStatusFilter }
        : {}),
    };

    if (params.q && params.q.trim()) {
      const q = params.q.trim();
      const onlyDigits = q.replace(/\D/g, '');
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { sobrenome: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { protocolo: { contains: q.toLowerCase() } },
        ...(onlyDigits ? [{ cpfLast3: onlyDigits.slice(-3) }] : []),
      ];
    }

    return this.prisma.attendee.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 200,
      select: {
        id: true,
        protocolo: true,
        nome: true,
        sobrenome: true,
        cpfLast3: true,
        email: true,
        celular: true,
        municipio: true,
        cargo: true,
        status: true,
        checkInEm: true,
        criadoEm: true,
        eventId: true,
        evento: { select: { nome: true } },
      },
    });
  }

  /** Listagem por evento (back-compat). */
  listByEvent(eventId: string) {
    return this.list({ eventId });
  }

  async update(id: string, dto: UpdateAttendeeDto) {
    await this.byId(id);
    const updated = await this.prisma.attendee.update({
      where: { id },
      data: {
        ...(dto.nome != null ? { nome: dto.nome } : {}),
        ...(dto.sobrenome != null ? { sobrenome: dto.sobrenome } : {}),
        ...(dto.cargo !== undefined ? { cargo: dto.cargo } : {}),
        ...(dto.email != null ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.celular != null ? { celular: dto.celular } : {}),
        ...(dto.municipio != null ? { municipio: dto.municipio.toUpperCase() } : {}),
      },
    });
    await this.audit(id, 'UPDATE', 'admin');
    return updated;
  }

  /** Soft-delete + remove embedding do Qdrant + apaga foto no storage. LGPD. */
  async remove(attendeeId: string) {
    const a = await this.prisma.attendee.findUnique({ where: { id: attendeeId } });
    if (!a) throw new NotFoundException();

    if (a.embeddingId) {
      try {
        await this.recognition.deleteEmbedding(a.embeddingId);
      } catch {
        /* tolera ausência no Qdrant */
      }
    }
    try {
      await this.storage.deletePrefix(`${a.eventId}/${attendeeId}/`);
    } catch {
      /* ignore */
    }
    await this.prisma.attendee.update({
      where: { id: attendeeId },
      data: { status: 'DELETED', embeddingId: null },
    });
    await this.prisma.photo.deleteMany({ where: { attendeeId } });
    await this.audit(attendeeId, 'DELETE', 'admin');
    return { ok: true };
  }

  /** Stream da foto pela API. */
  async getPhotoStream(attendeeId: string, ordem: number) {
    const photo = await this.prisma.photo.findUnique({
      where: { attendeeId_ordem: { attendeeId, ordem } },
    });
    if (!photo) throw new NotFoundException('Foto não encontrada');
    return this.storage.getStream(photo.storageKey);
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

function generateProtocol(): string {
  return randomBytes(12).toString('base64url').toLowerCase().slice(0, 24);
}
