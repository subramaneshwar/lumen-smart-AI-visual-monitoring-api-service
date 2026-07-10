import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { IngestEventDto } from './dto/ingest-event.dto';
import { AttachClipDto } from './dto/attach-clip.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(): never {
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
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
