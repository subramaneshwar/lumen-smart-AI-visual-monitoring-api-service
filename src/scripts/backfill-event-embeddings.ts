import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { Event } from '../common/entities/event.entity';
import { EmbeddingService } from '../events/embedding.service';

const BATCH_SIZE = 100;
const logger = new Logger('BackfillEventEmbeddings');

export async function backfillEventEmbeddings(
  events: Repository<Event>,
  embeddingService: EmbeddingService,
): Promise<{ embedded: number; failed: number }> {
  let embedded = 0;
  let failed = 0;
  const failedIds: string[] = [];

  while (true) {
    const batch = await events.find({
      where: {
        description_embedding: IsNull(),
        ...(failedIds.length > 0 ? { id: Not(In(failedIds)) } : {}),
      },
      relations: { person: true },
      order: { created_at: 'ASC' },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) {
      break;
    }

    for (const event of batch) {
      try {
        await embeddingService.embedEvent(event);
        embedded += 1;
      } catch (error) {
        logger.error(
          `Failed to embed event ${event.id}: ${(error as Error).message}`,
        );
        failed += 1;
        failedIds.push(event.id);
      }
    }
  }

  return { embedded, failed };
}

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  const events = app.get<Repository<Event>>(getRepositoryToken(Event));
  const embeddingService = app.get(EmbeddingService);

  const { embedded, failed } = await backfillEventEmbeddings(
    events,
    embeddingService,
  );
  logger.log(`Backfill complete: ${embedded} embedded, ${failed} failed`);

  await app.close();
}

if (require.main === module) {
  void bootstrap();
}
