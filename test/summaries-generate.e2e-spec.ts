import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Camera } from '../src/common/entities/camera.entity';
import { LLM_CLIENT, LlmClient } from '../src/llm/llm-client.interface';

describe('Summaries generate flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cameraId: string;
  let originalFetch: typeof global.fetch;
  const mockLlmClient: LlmClient = { generate: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLM_CLIENT)
      .useValue(mockLlmClient)
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
      `DELETE FROM summaries WHERE date IN ('2026-02-01', '2026-02-02')`,
    );
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
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    (mockLlmClient.generate as jest.Mock).mockReset();
  });

  it('generates a canned summary and notifies when there are zero events for the date', async () => {
    const response = await request(app.getHttpServer())
      .post('/summaries/generate')
      .send({ date: '2026-02-01' });

    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.content).toBe('No activity detected.');
    expect(mockLlmClient.generate).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.anything(),
    );

    const listResponse = await request(app.getHttpServer()).get(
      '/summaries?period=daily&date=2026-02-01',
    );
    expect(listResponse.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(listResponse.body).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(listResponse.body[0].content).toBe('No activity detected.');
  });

  it('generates an LLM-authored summary when events exist for the date', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'cat',
        confidence: 0.8,
      });
    await dataSource.query(
      `UPDATE events SET created_at = '2026-02-02T10:00:00Z' WHERE camera_id = $1`,
      [cameraId],
    );

    (mockLlmClient.generate as jest.Mock).mockResolvedValue(
      'A cat was spotted once today.',
    );

    const response = await request(app.getHttpServer())
      .post('/summaries/generate')
      .send({ date: '2026-02-02' });

    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.content).toBe('A cat was spotted once today.');
    expect(mockLlmClient.generate).toHaveBeenCalledTimes(1);
  });
});
