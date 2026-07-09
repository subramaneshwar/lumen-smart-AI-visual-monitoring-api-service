import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const client = new Redis(this.config.get<string>('REDIS_URL') as string, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await client.connect();
      await client.ping();
      return this.getStatus(key, true);
    } catch {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false),
      );
    } finally {
      client.disconnect();
    }
  }
}
