import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Summary } from '../common/entities/summary.entity';
import { Organization } from '../common/entities/organization.entity';
import { EventsService } from '../events/events.service';
import { EventSummary } from '../events/dto/event-summary.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { LLM_CLIENT } from '../llm/llm-client.interface';
import type { LlmClient } from '../llm/llm-client.interface';

const SUMMARY_SYSTEM_PROMPT =
  'You are a home security assistant. Write a short, friendly, natural-language recap of the events below for the property owner. Do not invent events that are not listed.';
const NO_ACTIVITY_CONTENT = 'No activity detected.';
const FAILURE_CONTENT = 'Summary generation failed — see logs.';

@Injectable()
export class SummariesService {
  private readonly logger = new Logger(SummariesService.name);

  constructor(
    @InjectRepository(Summary)
    private readonly summaries: Repository<Summary>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
    @Inject(LLM_CLIENT) private readonly llmClient: LlmClient,
  ) {}

  @Cron(process.env.SUMMARY_CRON_TIME || '0 23 * * *')
  async handleCron(): Promise<void> {
    try {
      await this.generateDailySummary();
    } catch (error) {
      this.logger.error(
        `Daily summary cron failed: ${(error as Error).message}`,
      );
    }
  }

  async generateDailySummary(date?: string): Promise<Summary> {
    const resolvedDate = date ?? this.todayDateString();
    const { events } = await this.eventsService.findAll({
      date: resolvedDate,
    });

    let content: string;
    if (events.length === 0) {
      content = NO_ACTIVITY_CONTENT;
    } else {
      try {
        content = await this.llmClient.generate({
          system: SUMMARY_SYSTEM_PROMPT,
          prompt: this.buildSummaryPrompt(events),
        });
      } catch (error) {
        this.logger.error(
          `Daily summary generation failed for ${resolvedDate}: ${(error as Error).message}`,
        );
        content = FAILURE_CONTENT;
      }
    }

    const organization = await this.organizations.findOneOrFail({
      where: {},
    });
    const saved = await this.summaries.save(
      this.summaries.create({
        organization,
        period: 'daily',
        date: resolvedDate,
        content,
      }),
    );

    await this.notificationsService.sendText(content, organization);

    return saved;
  }

  async findByPeriodAndDate(
    period = 'daily',
    date?: string,
  ): Promise<Summary[]> {
    const resolvedDate = date ?? this.todayDateString();
    return this.summaries.find({
      where: { period, date: resolvedDate },
      order: { created_at: 'DESC' },
    });
  }

  private buildSummaryPrompt(events: EventSummary[]): string {
    const lines = events.map((event) => {
      const time = event.created_at.toLocaleTimeString();
      const zone = event.zone ? ` in ${event.zone}` : '';
      const person = event.person
        ? ` (known visitor, visit #${event.person.visit_count})`
        : '';
      return `- ${time}: ${event.event_type}${zone}${person}`;
    });
    return `Today's detected events:\n${lines.join('\n')}`;
  }

  private todayDateString(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
