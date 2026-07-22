import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Event } from '../src/common/entities/event.entity';
import { Camera } from '../src/common/entities/camera.entity';
import { EmbeddingService } from '../src/events/embedding.service';
import {
  EMBEDDING_CLIENT,
  EmbeddingClient,
} from '../src/llm/embedding-client.interface';
import { backfillEventEmbeddings } from '../src/scripts/backfill-event-embeddings';

describe('backfillEventEmbeddings (e2e)', () => {
  let dataSource: DataSource;
  let eventsRepo: Repository<Event>;
  let embeddingService: EmbeddingService;
  let cameraId: string;
  const mockEmbeddingClient: EmbeddingClient = { embed: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMBEDDING_CLIENT)
      .useValue(mockEmbeddingClient)
      .compile();

    dataSource = moduleFixture.get(DataSource);
    eventsRepo = moduleFixture.get<Repository<Event>>(
      getRepositoryToken(Event),
    );
    embeddingService = moduleFixture.get(EmbeddingService);

    const cameraRepo = dataSource.getRepository(Camera);
    const camera = await cameraRepo.findOneOrFail({ where: {} });
    cameraId = camera.id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM events WHERE camera_id = $1', [
      cameraId,
    ]);
  });

  beforeEach(() => {
    (mockEmbeddingClient.embed as jest.Mock).mockReset();
  });

  it('embeds every event missing a description_embedding', async () => {
    (mockEmbeddingClient.embed as jest.Mock).mockResolvedValue(
      Array(384).fill(0.001),
    );

    const insertResult: { id: string }[] = await dataSource.query(
      `INSERT INTO events (camera_id, event_type, confidence)
       VALUES ($1, 'person', 0.9), ($1, 'cat', 0.7)
       RETURNING id`,
      [cameraId],
    );
    const seededIds = insertResult.map((row) => row.id);

    // Note: the shared dev DB may already contain other events (from
    // earlier manual testing) missing an embedding, so this run may embed
    // more than 2 rows total — assert on the count being at least 2 rather
    // than exactly 2, and verify our specific seeded rows by ID below.
    const { embedded, failed } = await backfillEventEmbeddings(
      eventsRepo,
      embeddingService,
    );

    expect(embedded).toBeGreaterThanOrEqual(seededIds.length);
    expect(failed).toBe(0);

    const rows: { description: string | null; description_embedding: string | null }[] =
      await dataSource.query(
        'SELECT description, description_embedding FROM events WHERE id = ANY($1)',
        [seededIds],
      );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.description).not.toBeNull();
      expect(row.description_embedding).not.toBeNull();
    }
  });
});
