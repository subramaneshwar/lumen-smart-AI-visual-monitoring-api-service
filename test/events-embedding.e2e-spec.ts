import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Camera } from '../src/common/entities/camera.entity';
import {
  EMBEDDING_CLIENT,
  EmbeddingClient,
} from '../src/llm/embedding-client.interface';

describe('Event embedding generation on ingest (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cameraId: string;
  let originalFetch: typeof global.fetch;
  const mockEmbeddingClient: EmbeddingClient = { embed: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMBEDDING_CLIENT)
      .useValue(mockEmbeddingClient)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    const cameraRepo = dataSource.getRepository(Camera);
    const camera = await cameraRepo.findOneOrFail({ where: {} });
    cameraId = camera.id;

    originalFetch = global.fetch;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await dataSource.query(
      'DELETE FROM notifications_log WHERE event_id IN (SELECT id FROM events WHERE camera_id = $1)',
      [cameraId],
    );
    await dataSource.query('DELETE FROM events WHERE camera_id = $1', [
      cameraId,
    ]);
    await app.close();
  });

  beforeEach(() => {
    // The seeded default rule (SeedDefaultRule migration) fires
    // critical_alert on any 'person' event, which calls
    // NotificationsService.sendTextAlert() — mock the Telegram HTTP call
    // so this test never makes a real network request, matching the
    // convention in test/events-critical-alert.e2e-spec.ts.
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    (mockEmbeddingClient.embed as jest.Mock).mockReset();
    (mockEmbeddingClient.embed as jest.Mock).mockResolvedValue(
      Array(384).fill(0.001),
    );
  });

  it('populates description and description_embedding after a successful ingest', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'person',
        confidence: 0.85,
        zone: 'front_door',
      });

    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const eventId: string = response.body.id;

    expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
      expect.stringContaining('person detected in front_door at') as string,
    );

    const rows: { description: string | null; description_embedding: string | null }[] =
      await dataSource.query(
        'SELECT description, description_embedding FROM events WHERE id = $1',
        [eventId],
      );
    expect(rows[0].description).toContain('person detected in front_door at');
    expect(rows[0].description_embedding).not.toBeNull();
  });

  it('still returns 201 and does not populate the columns when embedding fails', async () => {
    (mockEmbeddingClient.embed as jest.Mock).mockRejectedValue(
      new Error('rate limited'),
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'cat',
        confidence: 0.7,
      });

    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const eventId: string = response.body.id;

    const rows: { description: string | null }[] = await dataSource.query(
      'SELECT description FROM events WHERE id = $1',
      [eventId],
    );
    expect(rows[0].description).toBeNull();
  });
});
