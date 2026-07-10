import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rule } from '../common/entities/rule.entity';
import { Event } from '../common/entities/event.entity';

interface RuleConditions {
  detected_type?: string;
  time_range?: { start: string; end: string };
}

interface RuleConfig {
  conditions: RuleConditions;
  action: 'critical_alert' | 'record_only';
}

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    @InjectRepository(Rule) private readonly rules: Repository<Rule>,
  ) {}

  async evaluate(event: Event): Promise<'critical_alert' | 'record_only'> {
    const activeRules = await this.rules.find({
      where: { organization: { id: event.organization.id }, active: true },
    });

    for (const rule of activeRules) {
      const config = this.parseConfig(rule);
      if (config && this.matches(config.conditions, event)) {
        return config.action;
      }
    }
    return 'record_only';
  }

  private parseConfig(rule: Rule): RuleConfig | null {
    const config = rule.config as Partial<RuleConfig>;
    if (
      !config ||
      typeof config !== 'object' ||
      !config.conditions ||
      !config.action
    ) {
      this.logger.warn(`Rule ${rule.id} has malformed config, skipping`);
      return null;
    }
    return config as RuleConfig;
  }

  private matches(conditions: RuleConditions, event: Event): boolean {
    if (
      conditions.detected_type &&
      conditions.detected_type !== event.event_type
    ) {
      return false;
    }
    if (
      conditions.time_range &&
      !this.withinTimeRange(event.created_at, conditions.time_range)
    ) {
      return false;
    }
    return true;
  }

  private withinTimeRange(
    date: Date,
    range: { start: string; end: string },
  ): boolean {
    const startMinutes = this.parseTimeToMinutes(range.start);
    const endMinutes = this.parseTimeToMinutes(range.end);
    if (startMinutes === null || endMinutes === null) {
      this.logger.warn(`Malformed time_range: ${JSON.stringify(range)}`);
      return false;
    }

    const nowMinutes = date.getHours() * 60 + date.getMinutes();
    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    }
    // range wraps midnight, e.g. 23:00-06:00
    return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
  }

  private parseTimeToMinutes(time: string): number | null {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) {
      return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }
}
