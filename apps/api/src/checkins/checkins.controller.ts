import { Controller, Get, Param, Query } from '@nestjs/common';
import { CheckinsService } from './checkins.service';

@Controller()
export class CheckinsController {
  constructor(private readonly service: CheckinsService) {}

  /** Lista global (cross-evento) com filtros opcionais. */
  @Get('checkins')
  list(
    @Query('eventId') eventId?: string,
    @Query('dia') dia?: string,
    @Query('tipo') tipo?: 'AUTO' | 'MANUAL',
    @Query('totemId') totemId?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list({ eventId, dia, tipo, totemId, q });
  }

  @Get('events/:eventId/checkins')
  byEvent(
    @Param('eventId') eventId: string,
    @Query('dia') dia?: string,
    @Query('tipo') tipo?: 'AUTO' | 'MANUAL',
    @Query('totemId') totemId?: string,
    @Query('q') q?: string,
  ) {
    return this.service.listByEvent({ eventId, dia, tipo, totemId, q });
  }

  @Get('events/:eventId/checkins/days')
  daysSummary(@Param('eventId') eventId: string) {
    return this.service.daysSummary(eventId);
  }

  @Get('attendees/:attendeeId/checkins')
  byAttendee(@Param('attendeeId') attendeeId: string) {
    return this.service.listByAttendee(attendeeId);
  }
}
