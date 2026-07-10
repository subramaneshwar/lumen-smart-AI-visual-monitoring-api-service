import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import { Event } from '../common/entities/event.entity';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron(): Promise<void> {
    try {
      const { deletedCount } = await this.cleanupOldEvents();
      this.logger.log(`Retention cleanup deleted ${deletedCount} event(s)`);
    } catch (error) {
      this.logger.error(
        `Retention cleanup failed: ${(error as Error).message}`,
      );
    }
  }

  async cleanupOldEvents(retentionDays = 7): Promise<{ deletedCount: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const staleEvents = await this.events.find({
      where: { action_taken: 'record_only', created_at: LessThan(cutoff) },
    });

    for (const event of staleEvents) {
      await this.events.manager.query(
        'DELETE FROM notifications_log WHERE event_id = $1',
        [event.id],
      );
      if (event.clip_path) {
        this.deleteClipFileIfExists(event.clip_path);
      }
      await this.events.manager.query('DELETE FROM events WHERE id = $1', [
        event.id,
      ]);
    }

    return { deletedCount: staleEvents.length };
  }

  private deleteClipFileIfExists(clipPath: string): void {
    try {
      if (fs.existsSync(clipPath)) {
        fs.unlinkSync(clipPath);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete clip file ${clipPath}: ${(error as Error).message}`,
      );
    }
  }
}
