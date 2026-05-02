import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  /** Obrigatório quando data de nascimento indica menor de 18 anos. */
  cpfResponsavel?: string | null;
}

function idadeAnosCompletos(dataNascimento: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dataNascimento.getFullYear();
  const m = today.getMonth() - dataNascimento.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dataNascimento.getDate())) {
    age -= 1;
  }
  return age;
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
  private readonly log = new Logger(AttendeesService.name);

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

    const evento = await this.prisma.event.findUnique({ where: { id: dto.eventoId } });
    if (!evento) {
      throw new BadRequestException('Evento inválido');
    }

    const cpfHash = createHash('sha256').update(cpfNormalized).digest('hex');
    const cpfLast3 = cpfNormalized.slice(-3);

    const dataNasc = new Date(dto.dataNascimento);
    const idade = idadeAnosCompletos(dataNasc);

    let responsavelCreate: { cpfHash: string; cpfLast3: string } | undefined;
    if (idade < 18) {
      const respNorm = (dto.cpfResponsavel ?? '').replace(/\D/g, '');
      if (respNorm.length !== 11) {
        throw new BadRequestException('CPF do responsável é obrigatório para menores de 18 anos.');
      }
      const respHash = createHash('sha256').update(respNorm).digest('hex');
      if (respHash === cpfHash) {
        throw new BadRequestException('O CPF do responsável não pode ser o mesmo do participante.');
      }
      responsavelCreate = { cpfHash: respHash, cpfLast3: respNorm.slice(-3) };
    }

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
          dataNascimento: dataNasc,
          cargo: dto.cargo ?? null,
          email: dto.email.toLowerCase(),
          celular: dto.celular,
          municipio: dto.municipio.toUpperCase(),
          consentimentoLgpd: true,
          consentimentoIp: dto.consentimentoIp,
          consentimentoEm: new Date(),
          status: 'PENDING_PHOTOS',
          responsavel: responsavelCreate ? { create: responsavelCreate } : undefined,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('CPF já cadastrado para este evento.');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException('Evento inválido');
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

    const photo = await this.prisma.photo.upsert({
      where: { attendeeId_ordem: { attendeeId: dto.attendeeId, ordem: dto.ordem } },
      create: {
        attendeeId: dto.attendeeId,
        ordem: dto.ordem,
        storageKey,
      },
      update: { storageKey },
    });

    // Apenas a foto frontal vai para o motor de reconhecimento (a 2ª é redundância visual).
    if (dto.ordem === 1) {
      const result = await this.recognition.enroll({
        attendeeId: dto.attendeeId,
        eventId: attendee.eventId,
        imageBase64: dto.imageBase64,
      });
      // Armazena a face recortada (quando disponível) em vez da imagem inteira.
      await this.storage.putBase64(storageKey, result.faceImageBase64 ?? dto.imageBase64);
      await this.prisma.attendee.update({
        where: { id: dto.attendeeId },
        data: { embeddingId: result.embeddingId, status: 'PRE_REGISTERED' },
      });
      await this.audit(dto.attendeeId, 'ENROLL', 'system', { embeddingId: result.embeddingId });
    } else {
      // Foto 2: só armazenamento (não entra no embedding).
      await this.storage.putBase64(storageKey, dto.imageBase64);
    }

    return { photoId: photo.id };
  }

  /**
   * Lista participantes pendentes de indexação:
   * têm foto 1 mas não têm embeddingId.
   */
  listPendentes(eventId?: string) {
    return this.prisma.attendee.findMany({
      where: {
        embeddingId: null,
        status: { in: ['PRE_REGISTERED', 'PENDING_PHOTOS'] },
        fotos: { some: { ordem: 1 } },
        ...(eventId ? { eventId } : {}),
      },
      select: { id: true, nome: true, sobrenome: true, eventId: true },
    });
  }

  /**
   * Re-indexa em lote todos os pendentes (com foto mas sem embedding).
   * Útil pra rodar depois que o motor de reconhecimento voltar.
   */
  async enrollPendentes(eventId?: string) {
    const pendentes = await this.listPendentes(eventId);
    let ok = 0;
    let falhas = 0;
    const erros: { attendeeId: string; nome: string; erro: string }[] = [];

    for (const p of pendentes) {
      try {
        await this.enrollAgain(p.id);
        ok++;
      } catch (err: any) {
        falhas++;
        erros.push({
          attendeeId: p.id,
          nome: `${p.nome} ${p.sobrenome}`,
          erro: err?.message ?? 'erro desconhecido',
        });
      }
    }

    return { total: pendentes.length, ok, falhas, erros };
  }

  /**
   * Re-indexa o embedding de um participante que ficou pendente
   * (ex: motor de reconhecimento estava fora quando ele cadastrou).
   * Lê a foto 1 do MinIO e envia pro recognition novamente.
   */
  async enrollAgain(attendeeId: string) {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: { fotos: { where: { ordem: 1 } } },
    });
    if (!attendee) throw new NotFoundException('Participante não encontrado');
    if (attendee.fotos.length === 0) {
      throw new BadRequestException('Participante ainda não enviou a foto 1.');
    }

    // Lê a foto do storage
    const stream = await this.storage.getStream(attendee.fotos[0].storageKey);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    const imageBase64 = Buffer.concat(chunks).toString('base64');

    // Limpa embedding antigo (se houver) antes de re-indexar
    if (attendee.embeddingId) {
      try {
        await this.recognition.deleteEmbedding(attendee.embeddingId);
      } catch {
        /* ignore */
      }
    }

    const result = await this.recognition.enroll({
      attendeeId: attendee.id,
      eventId: attendee.eventId,
      imageBase64,
    });

    await this.prisma.attendee.update({
      where: { id: attendeeId },
      data: { embeddingId: result.embeddingId, status: 'PRE_REGISTERED' },
    });
    await this.audit(attendeeId, 'ENROLL_RETRY', 'admin', { embeddingId: result.embeddingId });

    return { ok: true, embeddingId: result.embeddingId };
  }

  byProtocolo(protocolo: string) {
    return this.prisma.attendee.findUnique({ where: { protocolo } });
  }

  /**
   * Lookup público por CPF + evento (usado antes de iniciar o cadastro).
   * Retorna se o participante já existe e quais fotos já foram enviadas.
   */
  async check(eventoId: string, cpf: string) {
    const cpfNormalized = cpf.replace(/\D/g, '');
    if (cpfNormalized.length !== 11) {
      throw new BadRequestException('CPF inválido');
    }
    const cpfHash = createHash('sha256').update(cpfNormalized).digest('hex');

    const attendee = await this.prisma.attendee.findFirst({
      where: { eventId: eventoId, cpfHash, status: { not: 'DELETED' } },
      include: { fotos: { select: { ordem: true } } },
    });

    if (!attendee) return { existe: false as const };

    const fotosOrdens = attendee.fotos.map((f) => f.ordem).sort();
    const temFoto1 = fotosOrdens.includes(1);
    const temFoto2 = fotosOrdens.includes(2);
    return {
      existe: true as const,
      id: attendee.id,
      protocolo: attendee.protocolo,
      nome: attendee.nome,
      sobrenome: attendee.sobrenome,
      status: attendee.status,
      fotosOrdens,
      /** Fluxo web: cadastro considerado completo só com as duas fotos enviadas. */
      completo: temFoto1 && temFoto2,
    };
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
