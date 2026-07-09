import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Organization } from '../src/common/entities/organization.entity';
import { Camera } from '../src/common/entities/camera.entity';

describe('Events ingest (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orgId: string;
  let cameraId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    const orgRepo = dataSource.getRepository(Organization);
    const cameraRepo = dataSource.getRepository(Camera);
    const org = await orgRepo.save(
      orgRepo.create({ name: 'Events E2E Test Org' }),
    );
    const camera = await cameraRepo.save(
      cameraRepo.create({ organization: org, name: 'Events E2E Test Camera' }),
    );
    orgId = org.id;
    cameraId = camera.id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM events WHERE camera_id = $1', [
      cameraId,
    ]);
    await dataSource.query('DELETE FROM cameras WHERE id = $1', [cameraId]);
    await dataSource.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await app.close();
  });

  it('POST /events/ingest with a valid payload returns 201 and persists the event', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'person',
        confidence: 0.87,
        clip_path: 'storage/clips/test-clip.mp4',
      });
    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.event_type).toBe('person');
  });

  it('POST /events/ingest with an invalid payload returns 400', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({ camera_id: 'not-a-uuid', event_type: 'person' });
    expect(response.status).toBe(400);
  });
});
