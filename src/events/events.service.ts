import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../common/entities/event.entity';
import { Camera } from '../common/entities/camera.entity';
import { IngestEventDto } from './dto/ingest-event.dto';
import { RulesService } from '../rules/rules.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(Camera) private readonly cameras: Repository<Camera>,
    private readonly rulesService: RulesService,
    private readonly notificationsService: NotificationsService,
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
      clip_path: dto.clip_path ?? null,
      zone: dto.zone ?? null,
    });
    const saved = await this.events.save(event);

    try {
      saved.action_taken = await this.rulesService.evaluate(saved);
      await this.events.save(saved);

      if (saved.action_taken === 'critical_alert') {
        await this.notificationsService.sendTextAlert(saved);
      }
    } catch (error) {
      this.logger.error(
        `Rule evaluation/notification failed for event ${saved.id}: ${(error as Error).message}`,
      );
    }

    return saved;
  }
}
