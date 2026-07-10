import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Organization } from '../src/common/entities/organization.entity';
import { Camera } from '../src/common/entities/camera.entity';
import { Rule } from '../src/common/entities/rule.entity';

describe('Events critical-alert flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orgId: string;
  let cameraId: string;
  let originalFetch: typeof global.fetch;

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
    const ruleRepo = dataSource.getRepository(Rule);

    const org = await orgRepo.save(
      orgRepo.create({ name: 'Critical Alert Test Org' }),
    );
    const camera = await cameraRepo.save(
      cameraRepo.create({
        organization: org,
        name: 'Critical Alert Test Camera',
      }),
    );
    await ruleRepo.save(
      ruleRepo.create({
        organization: org,
        template: 'test',
        config: {
          conditions: { detected_type: 'person' },
          action: 'critical_alert',
        },
        active: true,
      }),
    );
    orgId = org.id;
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
    await dataSource.query('DELETE FROM rules WHERE org_id = $1', [orgId]);
    await dataSource.query('DELETE FROM cameras WHERE id = $1', [cameraId]);
    await dataSource.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await app.close();
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('a matching detection is marked critical_alert and sends a Telegram text alert', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'person',
        confidence: 0.9,
      });

    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.action_taken).toBe('critical_alert');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const notificationLog = await dataSource.query(
      'SELECT channel, status FROM notifications_log WHERE event_id = $1',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      [response.body.id],
    );

    expect(notificationLog).toEqual([{ channel: 'telegram', status: 'sent' }]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.anything(),
    );
  });

  it('a non-matching detection is marked record_only and sends no notification', async () => {
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
    expect(response.body.action_taken).toBe('record_only');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const notificationLog = await dataSource.query(
      'SELECT channel FROM notifications_log WHERE event_id = $1',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      [response.body.id],
    );
    expect(notificationLog).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('POST /events/ingest still accepts an omitted clip_path', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'cat',
        confidence: 0.6,
      });

    expect(response.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.clip_path).toBeNull();
  });

  it('POST /events/clips attaches the file and sends a video alert for a critical_alert event', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const ingestResponse = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'person',
        confidence: 0.95,
      });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    const eventId: string = ingestResponse.body.id;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const clipResponse = await request(app.getHttpServer())
      .post('/events/clips')
      .field('event_ids', eventId)
      .attach('clip', Buffer.from('fake video bytes'), 'clip.mp4');

    expect(clipResponse.status).toBe(201);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const updated = await dataSource.query(
      'SELECT clip_path FROM events WHERE id = $1',
      [eventId],
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(updated[0].clip_path).toContain('.mp4');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const notificationLogs = await dataSource.query(
      'SELECT channel, status FROM notifications_log WHERE event_id = $1 ORDER BY sent_at',
      [eventId],
    );
    expect(notificationLogs).toEqual([
      { channel: 'telegram', status: 'sent' }, // text alert from ingest
      { channel: 'telegram', status: 'sent' }, // video alert from clip attach
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendVideo'),
      expect.anything(),
    );
  });

  it('POST /events/clips attaches the file but sends no video alert for a record_only event', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const ingestResponse = await request(app.getHttpServer())
      .post('/events/ingest')
      .send({
        camera_id: cameraId,
        event_type: 'cat',
        confidence: 0.6,
      });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    const eventId: string = ingestResponse.body.id;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const clipResponse = await request(app.getHttpServer())
      .post('/events/clips')
      .field('event_ids', eventId)
      .attach('clip', Buffer.from('fake video bytes'), 'clip.mp4');

    expect(clipResponse.status).toBe(201);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const updated = await dataSource.query(
      'SELECT clip_path FROM events WHERE id = $1',
      [eventId],
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(updated[0].clip_path).toContain('.mp4');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const notificationLogs = await dataSource.query(
      'SELECT channel FROM notifications_log WHERE event_id = $1',
      [eventId],
    );
    expect(notificationLogs).toEqual([]);
  });
});
