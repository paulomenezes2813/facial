import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
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
