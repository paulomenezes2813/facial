import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Ip,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AttendeesService } from './attendees.service';
import { Public } from '../auth/public.decorator';

@Controller('attendees')
export class AttendeesController {
  constructor(private readonly service: AttendeesService) {}

  // ==========================================================================
  // ⚠ ROTAS ESTÁTICAS PRIMEIRO!
  // NestJS/Express resolvem por ordem de registro. Tudo que tem path literal
  // (ex: 'check', 'pendentes/list') tem que vir ANTES das rotas com :id.
  // Senão `/attendees/pendentes/list` vira `:id = "pendentes"` + sobra "/list".
  // ==========================================================================

  // ---------- Públicas ----------

  @Public()
  @Post('register')
  async register(@Body() body: any, @Ip() ip: string) {
    return this.service.register({ ...body, consentimentoIp: ip });
  }

  @Public()
  @Get('check')
  async check(@Query('eventoId') eventoId: string, @Query('cpf') cpf: string) {
    if (!eventoId) throw new BadRequestException('eventoId é obrigatório');
    if (!cpf) throw new BadRequestException('cpf é obrigatório');
    return this.service.check(eventoId, cpf);
  }

  @Public()
  @Get('protocolo/:protocolo')
  async byProtocolo(@Param('protocolo') protocolo: string) {
    const a = await this.service.byProtocolo(protocolo);
    if (!a) throw new NotFoundException();
    return {
      protocolo: a.protocolo,
      nome: `${a.nome} ${a.sobrenome}`,
      status: a.status,
    };
  }

  // ---------- Admin: re-indexação ----------

  /** Lista todos pendentes de indexação (com foto mas sem embedding). */
  @Get('pendentes/list')
  listPendentes(@Query('eventId') eventId?: string) {
    return this.service.listPendentes(eventId);
  }

  /** Re-indexa em lote todos os pendentes. Pode filtrar por evento. */
  @Post('pendentes/enroll-all')
  enrollPendentes(@Query('eventId') eventId?: string) {
    return this.service.enrollPendentes(eventId);
  }

  // ---------- Admin: listagem ----------

  @Get()
  async list(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list({ eventId, status, q });
  }

  // ==========================================================================
  // ⚠ DAQUI PRA BAIXO: rotas paramétricas (:id). Tudo que vem antes disso
  // tem que ser path estático.
  // ==========================================================================

  @Public()
  @Post(':id/photos')
  async addPhoto(
    @Param('id') id: string,
    @Body() body: { ordem: 1 | 2; imageBase64: string },
  ) {
    if (body.ordem !== 1 && body.ordem !== 2) {
      throw new BadRequestException('ordem deve ser 1 ou 2');
    }
    return this.service.addPhoto({ attendeeId: id, ordem: body.ordem, imageBase64: body.imageBase64 });
  }

  /** Stream da foto (jpeg). Protegido por JWT (admin). */
  @Get(':id/photos/:ordem')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'private, max-age=300')
  async getPhoto(
    @Param('id') id: string,
    @Param('ordem') ordem: string,
    @Res() res: Response,
  ) {
    const ord = Number(ordem);
    if (ord !== 1 && ord !== 2) throw new BadRequestException('ordem inválida');
    const stream = await this.service.getPhotoStream(id, ord);
    stream.pipe(res);
  }

  /** Re-tenta indexação no motor de reconhecimento (caso tenha falhado no upload). */
  @Post(':id/enroll')
  reenroll(@Param('id') id: string) {
    return this.service.enrollAgain(id);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.byId(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      nome?: string;
      sobrenome?: string;
      cargo?: string | null;
      email?: string;
      celular?: string;
      municipio?: string;
    },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
