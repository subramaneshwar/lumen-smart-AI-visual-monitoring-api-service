import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../common/entities/event.entity';
import { Camera } from '../common/entities/camera.entity';
import { IngestEventDto } from './dto/ingest-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(Camera) private readonly cameras: Repository<Camera>,
  ) {}

  async ingest(dto: IngestEventDto): Promise<Event> {
    const camera = await this.cameras.findOne({
      where: { id: dto.camera_id },
      relations: { organization: true },
    });
    if (!camera) {
      throw new NotFoundException(`Camera ${dto.camera_id} not found`);
    }
    const event = this.events.create({
      organization: camera.organization,
      camera,
      event_type: dto.event_type,
      confidence: dto.confidence,
      clip_path: dto.clip_path,
      zone: dto.zone ?? null,
    });
    return this.events.save(event);
  }
}
