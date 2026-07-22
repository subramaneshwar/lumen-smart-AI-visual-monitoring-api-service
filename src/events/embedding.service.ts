import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../common/entities/event.entity';
import { EMBEDDING_CLIENT } from '../llm/embedding-client.interface';
import type { EmbeddingClient } from '../llm/embedding-client.interface';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @Inject(EMBEDDING_CLIENT)
    private readonly embeddingClient: EmbeddingClient,
  ) {}

  async embedEvent(event: Event): Promise<void> {
    const description = this.buildDescription(event);
    const embedding = await this.embeddingClient.embed(description);
    const vectorLiteral = `[${embedding.join(',')}]`;

    await this.events.manager.query(
      'UPDATE events SET description = $1, description_embedding = $2 WHERE id = $3',
      [description, vectorLiteral, event.id],
    );
  }

  private buildDescription(event: Event): string {
    const time = event.created_at.toLocaleTimeString();
    const zone = event.zone ? ` in ${event.zone}` : '';
    const person = event.person
      ? ` (known visitor, visit #${event.person.visit_count})`
      : '';
    return `${event.event_type} detected${zone} at ${time}${person}`;
  }
}
