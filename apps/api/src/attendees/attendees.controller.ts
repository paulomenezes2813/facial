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

  // ---------- ROTAS PÚBLICAS (cadastro do participante) ----------

  @Public()
  @Post('register')
  async register(@Body() body: any, @Ip() ip: string) {
    return this.service.register({ ...body, consentimentoIp: ip });
  }

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

  // ---------- ROTAS ADMIN ----------

  @Get()
  async list(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list({ eventId, status, q });
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
}
