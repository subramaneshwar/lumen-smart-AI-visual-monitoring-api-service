import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Event } from '../common/entities/event.entity';
import { Camera } from '../common/entities/camera.entity';
import { IngestEventDto } from './dto/ingest-event.dto';
import { EventSummary, ListEventsResult } from './dto/event-summary.dto';
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

  async findAll(filters: {
    date?: string;
    type?: string;
    zone?: string;
    page?: number;
    limit?: number;
  }): Promise<ListEventsResult> {
    const dateStr = filters.date ?? this.todayDateString();
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999`);
    if (Number.isNaN(dayStart.getTime())) {
      throw new BadRequestException(`Invalid date: ${dateStr}`);
    }

    // Validate that the parsed date's year/month/day match the input
    // This catches rollovers like '2026-02-30' -> March 2
    const parts = dateStr.split('-');
    if (
      parts.length !== 3 ||
      dayStart.getFullYear() !== parseInt(parts[0], 10) ||
      dayStart.getMonth() + 1 !== parseInt(parts[1], 10) ||
      dayStart.getDate() !== parseInt(parts[2], 10)
    ) {
      throw new BadRequestException(`Invalid date: ${dateStr}`);
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 50;

    const where: FindOptionsWhere<Event> = {
      created_at: Between(dayStart, dayEnd),
    };
    if (filters.type) {
      where.event_type = filters.type;
    }
    if (filters.zone) {
      where.zone = filters.zone;
    }

    const [events, total] = await this.events.findAndCount({
      where,
      relations: { person: true },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      events: events.map((event) => this.toSummary(event)),
      page,
      limit,
      total,
    };
  }

  private toSummary(event: Event): EventSummary {
    return {
      id: event.id,
      event_type: event.event_type,
      confidence: event.confidence,
      zone: event.zone,
      action_taken: event.action_taken,
      created_at: event.created_at,
      person: event.person
        ? { id: event.person.id, visit_count: event.person.visit_count }
        : null,
    };
  }

  private todayDateString(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
