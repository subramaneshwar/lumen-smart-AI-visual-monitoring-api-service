import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Event } from '../common/entities/event.entity';
import { Camera } from '../common/entities/camera.entity';
import { IngestEventDto } from './dto/ingest-event.dto';
import { RulesService } from '../rules/rules.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PersonsService } from '../persons/persons.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(Camera) private readonly cameras: Repository<Camera>,
    private readonly rulesService: RulesService,
    private readonly notificationsService: NotificationsService,
    private readonly personsService: PersonsService,
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
      person: null,
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

    if (dto.face_embedding) {
      try {
        const person = await this.personsService.matchOrCreate(
          dto.face_embedding,
          camera.organization.id,
        );
        saved.person = person;
        await this.events.save(saved);
        saved.person = { ...person, face_embedding: null };
      } catch (error) {
        this.logger.error(
          `Person matching failed for event ${saved.id}: ${(error as Error).message}`,
        );
      }
    }

    return saved;
  }

  saveClipFile(file: Express.Multer.File): string {
    const clipsDir = path.join(process.cwd(), 'storage', 'clips');
    fs.mkdirSync(clipsDir, { recursive: true });
    const savedPath = path.join(clipsDir, `${randomUUID()}.mp4`);
    fs.writeFileSync(savedPath, file.buffer);
    return savedPath;
  }

  async attachClip(eventIds: string[], filePath: string): Promise<void> {
    for (const eventId of eventIds) {
      let event: Event | null;
      try {
        event = await this.events.findOne({
          where: { id: eventId },
          relations: { organization: true, camera: true },
        });
      } catch (error) {
        this.logger.warn(
          `Skipping invalid event id ${eventId}: ${(error as Error).message}`,
        );
        continue;
      }
      if (!event) {
        continue;
      }
      event.clip_path = filePath;
      await this.events.save(event);

      if (event.action_taken === 'critical_alert') {
        await this.notificationsService.sendVideoAlert(event, filePath);
      }
    }
  }
}
