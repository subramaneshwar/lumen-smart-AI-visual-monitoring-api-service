import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../common/entities/event.entity';
import { EMBEDDING_CLIENT } from '../llm/embedding-client.interface';
import type { EmbeddingClient } from '../llm/embedding-client.interface';

@Injectable()
export class EmbeddingService {
  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @Inject(EMBEDDING_CLIENT)
    private readonly embeddingClient: EmbeddingClient,
  ) {}

  async embedEvent(event: Event): Promise<void> {
    const description = this.buildDescription(event);
    const embedding = await this.embeddingClient.embed(description);

    await this.events.update(event.id, {
      description,
      description_embedding: embedding,
    });
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
