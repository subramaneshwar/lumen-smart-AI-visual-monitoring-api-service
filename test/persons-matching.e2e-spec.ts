import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Organization } from '../src/common/entities/organization.entity';
import { Camera } from '../src/common/entities/camera.entity';
import { Person } from '../src/common/entities/person.entity';

describe('Person matching (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orgId: string;
  let cameraId: string;
  let knownPersonId: string;
  let originalFetch: typeof global.fetch;

  const knownEmbedding = new Array(128).fill(0) as unknown as number[];
  const nearDuplicateEmbedding = new Array(128).fill(0) as unknown as number[];
  const farEmbedding = new Array(128).fill(10) as unknown as number[];

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
    const personRepo = dataSource.getRepository(Person);

    const org = await orgRepo.save(
      orgRepo.create({ name: 'Persons E2E Test Org' }),
    );
    const camera = await cameraRepo.save(
      cameraRepo.create({ organization: org, name: 'Persons E2E Test Camera' }),
    );
    const person = await personRepo.save(
      personRepo.create({
        organization: org,
        label: null,
        face_embedding: knownEmbedding,
        first_seen: new Date(),
        last_seen: new Date(),
        visit_count: 1,
      }),
    );
    orgId = org.id;
    cameraId = camera.id;
    knownPersonId = person.id;
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

    await dataSource.query('DELETE FROM persons WHERE org_id = $1', [orgId]);

    await dataSource.query('DELETE FROM cameras WHERE id = $1', [cameraId]);

    await dataSource.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await app.close();
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('links the event to the existing person and increments visit_count for a near-duplicate embedding', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'person',
        confidence: 0.9,
        face_embedding: nearDuplicateEmbedding,
      });

    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.person.face_embedding).toBeFalsy();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const persons = await dataSource.query(
      'SELECT visit_count, face_embedding FROM persons WHERE id = $1',
      [knownPersonId],
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(persons[0].visit_count).toBe(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(persons[0].face_embedding).not.toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const events = await dataSource.query(
      'SELECT person_id FROM events WHERE id = $1',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      [response.body.id],
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(events[0].person_id).toBe(knownPersonId);
  });

  it('creates a new person for a very different embedding', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const before = await dataSource.query(
      'SELECT COUNT(*) FROM persons WHERE org_id = $1',
      [orgId],
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'person',
        confidence: 0.9,
        face_embedding: farEmbedding,
      });

    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.person.face_embedding).toBeFalsy();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const after = await dataSource.query(
      'SELECT COUNT(*) FROM persons WHERE org_id = $1',
      [orgId],
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(Number(after[0].count)).toBe(Number(before[0].count) + 1);

    const newPersonRow = await dataSource.query(
      'SELECT face_embedding FROM persons WHERE org_id = $1 AND id != $2',
      [orgId, knownPersonId],
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(newPersonRow[0].face_embedding).not.toBeNull();
  });

  it('leaves person null when no face_embedding is sent', async () => {
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
    expect(response.body.person).toBeNull();
  });
});
