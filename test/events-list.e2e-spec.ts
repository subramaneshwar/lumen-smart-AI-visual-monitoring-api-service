import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Organization } from '../src/common/entities/organization.entity';
import { Camera } from '../src/common/entities/camera.entity';
import { Event } from '../src/common/entities/event.entity';
import { Person } from '../src/common/entities/person.entity';

function todayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

describe('Events listing (e2e)', () => {
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
    const eventRepo = dataSource.getRepository(Event);
    const personRepo = dataSource.getRepository(Person);

    const org = await orgRepo.save(
      orgRepo.create({ name: 'Events List E2E Test Org' }),
    );
    const camera = await cameraRepo.save(
      cameraRepo.create({
        organization: org,
        name: 'Events List E2E Test Camera',
      }),
    );
    const person = await personRepo.save(
      personRepo.create({
        organization: org,
        label: null,
        face_embedding: new Array(128).fill(0),
        first_seen: new Date(),
        last_seen: new Date(),
        visit_count: 2,
      }),
    );
    orgId = org.id;
    cameraId = camera.id;

    await eventRepo.save([
      eventRepo.create({
        organization: org,
        camera,
        event_type: 'person',
        confidence: 0.9,
        zone: 'front_door',
        action_taken: 'critical_alert',
        person,
        created_at: new Date(`${todayDateString()}T09:00:00.000Z`),
      }),
      eventRepo.create({
        organization: org,
        camera,
        event_type: 'dog',
        confidence: 0.8,
        zone: null,
        action_taken: 'record_only',
        person: null,
        created_at: new Date(`${todayDateString()}T10:00:00.000Z`),
      }),
    ]);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM events WHERE camera_id = $1', [
      cameraId,
    ]);
    await dataSource.query('DELETE FROM persons WHERE org_id = $1', [orgId]);
    await dataSource.query('DELETE FROM cameras WHERE id = $1', [cameraId]);
    await dataSource.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await app.close();
  });

  it('defaults to today and maps person data for matched/unmatched events', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer()).get('/events');

    expect(response.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.total).toBeGreaterThanOrEqual(2);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const personEvent = response.body.events.find(
      (e: { event_type: string }) => e.event_type === 'person',
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(personEvent.person).toEqual(
      expect.objectContaining({ visit_count: 2 }),
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const dogEvent = response.body.events.find(
      (e: { event_type: string }) => e.event_type === 'dog',
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(dogEvent.person).toBeNull();
  });

  it('filters by type', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer()).get('/events?type=dog');

    expect(response.status).toBe(200);
    expect(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      response.body.events.every(
        (e: { event_type: string }) => e.event_type === 'dog',
      ),
    ).toBe(true);
  });

  it('returns 400 for a malformed date format', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer()).get(
      '/events?date=not-a-date',
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 for a semantically invalid date', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer()).get(
      '/events?date=2026-13-45',
    );

    expect(response.status).toBe(400);
  });

  it('paginates results', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer()).get(
      `/events?date=${todayDateString()}&limit=1&page=1`,
    );

    expect(response.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.events).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.limit).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.total).toBeGreaterThanOrEqual(2);
  });
});
