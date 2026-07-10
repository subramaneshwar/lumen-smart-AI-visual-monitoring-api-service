import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { NotificationLog } from '../common/entities/notification-log.entity';
import { Event } from '../common/entities/event.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logs: Repository<NotificationLog>,
    private readonly config: ConfigService,
  ) {}

  async sendTextAlert(event: Event): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId(),
          text: this.formatMessage(event),
        }),
      });
      if (!response.ok) {
        throw new Error(`Telegram responded with ${response.status}`);
      }
      await this.logAttempt(event, 'sent');
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram text alert: ${(error as Error).message}`,
      );
      await this.logAttempt(event, 'failed');
    }
  }

  async sendVideoAlert(event: Event, filePath: string): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('chat_id', this.chatId());
      formData.append('caption', this.formatMessage(event));
      formData.append(
        'video',
        new Blob([fs.readFileSync(filePath)]),
        'clip.mp4',
      );

      const response = await fetch(`${this.baseUrl()}/sendVideo`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Telegram responded with ${response.status}`);
      }
      await this.logAttempt(event, 'sent');
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram video alert: ${(error as Error).message}`,
      );
      await this.logAttempt(event, 'failed');
    }
  }

  private async logAttempt(
    event: Event,
    status: 'sent' | 'failed',
  ): Promise<void> {
    await this.logs.save(
      this.logs.create({
        organization: event.organization,
        event,
        channel: 'telegram',
        status,
      }),
    );
  }

  private formatMessage(event: Event): string {
    const camera = event.camera?.name ?? 'unknown camera';
    const confidencePct = Math.round((event.confidence ?? 0) * 100);
    return `🚨 ${event.event_type} detected (${confidencePct}% confidence) on ${camera} at ${event.created_at.toLocaleString()}`;
  }

  private chatId(): string {
    return this.config.get<string>('TELEGRAM_CHAT_ID') as string;
  }

  private baseUrl(): string {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    return `https://api.telegram.org/bot${token}`;
  }
}
