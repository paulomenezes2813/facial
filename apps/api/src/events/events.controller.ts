import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { EventsService } from './events.service';

interface CreateEventBody {
  nome: string;
  inicio: string;
  fim: string;
  local?: string;
  retencaoDias?: number;
}

interface UpdateEventBody {
  nome?: string;
  inicio?: string;
  fim?: string;
  local?: string | null;
  retencaoDias?: number;
}

@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.byId(id);
  }

  @Post()
  create(@Body() body: CreateEventBody) {
    return this.service.create({
      nome: body.nome,
      inicio: new Date(body.inicio),
      fim: new Date(body.fim),
      local: body.local,
      retencaoDias: body.retencaoDias,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateEventBody) {
    return this.service.update(id, {
      ...body,
      inicio: body.inicio ? new Date(body.inicio) : undefined,
      fim: body.fim ? new Date(body.fim) : undefined,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
