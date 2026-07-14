import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { IngestEventDto } from './dto/ingest-event.dto';
import { AttachClipDto } from './dto/attach-clip.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(@Query() query: ListEventsQueryDto) {
    return await this.eventsService.findAll({
      date: query.date,
      type: query.type,
      zone: query.zone,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  async ingest(@Body() dto: IngestEventDto) {
    return await this.eventsService.ingest(dto);
  }

  @Post('clips')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('clip'))
  async attachClip(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AttachClipDto,
  ) {
    if (!file) {
      throw new BadRequestException('clip file is required');
    }
    const eventIds = dto.event_ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const savedPath = this.eventsService.saveClipFile(file);
    await this.eventsService.attachClip(eventIds, savedPath);
    return { clip_path: savedPath, event_ids: eventIds };
  }
}
