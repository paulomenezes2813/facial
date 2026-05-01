import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request } from 'express';
import type { Response } from 'express';
import { TotemService } from './totem.service';
import { Public } from '../auth/public.decorator';
import type { JwtPayload } from '../auth/jwt-auth.guard';

interface TotemPayload extends JwtPayload {
  type: 'totem';
  eventId: string;
}

@Controller()
export class TotemController {
  constructor(private readonly service: TotemService) {}

  // ---------- Admin: gerenciar totens (JWT admin obrigatório) ----------

  @Post('events/:eventId/totens')
  createForEvent(@Param('eventId') eventId: string, @Body() body: { nome: string }) {
    return this.service.createForEvent(eventId, body.nome);
  }

  @Get('events/:eventId/totens')
  listByEvent(@Param('eventId') eventId: string) {
    return this.service.listByEvent(eventId);
  }

  @Get('totens')
  listAll() {
    return this.service.listAll();
  }

  @Patch('totens/:id')
  update(@Param('id') id: string, @Body() body: { nome?: string }) {
    return this.service.update(id, body);
  }

  @Delete('totens/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ---------- Pareamento (público — apiKey é a credencial) ----------

  @Public()
  @Post('totem/session')
  session(@Body() body: { apiKey: string }) {
    if (!body?.apiKey) throw new BadRequestException('apiKey ausente');
    return this.service.session(body.apiKey);
  }

  // ---------- Operação do totem (JWT do totem) ----------

  /**
   * Dev-only: troca o evento do token do totem para facilitar testes.
   * Em produção, o totem é pareado a um evento via apiKey.
   */
  @Post('totem/switch-event')
  switchEvent(
    @Req() req: Request & { user?: JwtPayload },
    @Body() body: { eventId: string },
  ) {
    const user = req.user as TotemPayload | undefined;
    if (!user || user.type !== 'totem') {
      throw new ForbiddenException('Token não é de totem');
    }
    // Segurança: por padrão só habilita em DEV. Em produção, exige flag explícita.
    const allowByEnv = process.env.ALLOW_TOTEM_EVENT_SWITCH === 'true';
    const allowByDev = process.env.NODE_ENV !== 'production';
    if (!allowByEnv && !allowByDev) {
      throw new ForbiddenException('Troca de evento não habilitada');
    }
    if (!body?.eventId) throw new BadRequestException('eventId ausente');
    return this.service.sessionForEvent(user.sub, body.eventId);
  }

  @Post('totem/checkin')
  checkin(
    @Req() req: Request & { user?: JwtPayload },
    @Body() body: { imageBase64: string },
  ) {
    const user = req.user as TotemPayload | undefined;
    if (!user || user.type !== 'totem') {
      throw new ForbiddenException('Token não é de totem');
    }
    if (!body?.imageBase64) throw new BadRequestException('imageBase64 ausente');
    return this.service.checkin(user.sub, user.eventId, body.imageBase64);
  }

  // ---------- Fallback manual ----------

  @Get('totem/attendees')
  searchAttendees(
    @Req() req: Request & { user?: JwtPayload },
    @Query('q') q: string = '',
  ) {
    const user = req.user as TotemPayload | undefined;
    if (!user || user.type !== 'totem') {
      throw new ForbiddenException('Token não é de totem');
    }
    return this.service.searchAttendees(user.eventId, q);
  }

  /** Stream da foto (jpeg) para o totem (JWT do totem). */
  @Get('totem/attendees/:id/photos/:ordem')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'private, max-age=300')
  async getAttendeePhoto(
    @Req() req: Request & { user?: JwtPayload },
    @Param('id') attendeeId: string,
    @Param('ordem') ordem: string,
    @Res() res: Response,
  ) {
    const user = req.user as TotemPayload | undefined;
    if (!user || user.type !== 'totem') {
      throw new ForbiddenException('Token não é de totem');
    }
    const ord = Number(ordem);
    if (ord !== 1 && ord !== 2) throw new BadRequestException('ordem inválida');
    const stream = await this.service.getPhotoStream(user.eventId, attendeeId, ord);
    stream.pipe(res);
  }

  @Post('totem/checkin-manual')
  checkinManual(
    @Req() req: Request & { user?: JwtPayload },
    @Body() body: { attendeeId: string },
  ) {
    const user = req.user as TotemPayload | undefined;
    if (!user || user.type !== 'totem') {
      throw new ForbiddenException('Token não é de totem');
    }
    if (!body?.attendeeId) throw new BadRequestException('attendeeId ausente');
    return this.service.checkinManual(user.sub, user.eventId, body.attendeeId);
  }
}
