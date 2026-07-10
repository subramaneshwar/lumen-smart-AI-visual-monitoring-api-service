import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Organization } from '../src/common/entities/organization.entity';
import { Camera } from '../src/common/entities/camera.entity';
import { Event } from '../src/common/entities/event.entity';
import { NotificationLog } from '../src/common/entities/notification-log.entity';
import { RetentionService } from '../src/retention/retention.service';

describe('Retention cleanup (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let retentionService: RetentionService;
  let orgId: string;
  let cameraId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    retentionService = moduleFixture.get(RetentionService);

    const orgRepo = dataSource.getRepository(Organization);
    const cameraRepo = dataSource.getRepository(Camera);
    const org = await orgRepo.save(
      orgRepo.create({ name: 'Retention Test Org' }),
    );
    const camera = await cameraRepo.save(
      cameraRepo.create({ organization: org, name: 'Retention Test Camera' }),
    );
    orgId = org.id;
    cameraId = camera.id;
  });

  afterAll(async () => {
    await dataSource.query(
      'DELETE FROM notifications_log WHERE event_id IN (SELECT id FROM events WHERE camera_id = $1)',
      [cameraId],
    );
    await dataSource.query('DELETE FROM events WHERE camera_id = $1', [
      cameraId,
    ]);
    await dataSource.query('DELETE FROM cameras WHERE id = $1', [cameraId]);
    await dataSource.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await app.close();
  });

  it('deletes only stale record_only events, keeping recent and critical_alert ones', async () => {
    const eventRepo = dataSource.getRepository(Event);
    const notificationLogRepo = dataSource.getRepository(NotificationLog);
    const organization = { id: orgId } as Organization;
    const camera = { id: cameraId } as Camera;
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const staleRecordOnly = await eventRepo.save(
      eventRepo.create({
        organization,
        camera,
        event_type: 'cat',
        action_taken: 'record_only',
      }),
    );
    await dataSource.query('UPDATE events SET created_at = $1 WHERE id = $2', [
      eightDaysAgo,
      staleRecordOnly.id,
    ]);
    await notificationLogRepo.save(
      notificationLogRepo.create({
        organization,
        event: staleRecordOnly,
        channel: 'telegram',
        status: 'sent',
      }),
    );

    const recentRecordOnly = await eventRepo.save(
      eventRepo.create({
        organization,
        camera,
        event_type: 'cat',
        action_taken: 'record_only',
      }),
    );

    const staleCriticalAlert = await eventRepo.save(
      eventRepo.create({
        organization,
        camera,
        event_type: 'person',
        action_taken: 'critical_alert',
      }),
    );
    await dataSource.query('UPDATE events SET created_at = $1 WHERE id = $2', [
      eightDaysAgo,
      staleCriticalAlert.id,
    ]);

    const result = await retentionService.cleanupOldEvents(7);

    expect(result.deletedCount).toBe(1);
    expect(
      await eventRepo.findOne({ where: { id: staleRecordOnly.id } }),
    ).toBeNull();
    expect(
      await eventRepo.findOne({ where: { id: recentRecordOnly.id } }),
    ).not.toBeNull();
    expect(
      await eventRepo.findOne({ where: { id: staleCriticalAlert.id } }),
    ).not.toBeNull();
    expect(
      await notificationLogRepo.findOne({
        where: { event: { id: staleRecordOnly.id } },
      }),
    ).toBeNull();

    await eventRepo.delete({ id: recentRecordOnly.id });
    await eventRepo.delete({ id: staleCriticalAlert.id });
  });
});
