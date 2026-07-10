import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotificationsService } from './notifications.service';
import { NotificationLog } from '../common/entities/notification-log.entity';
import { Event } from '../common/entities/event.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const mockLogsRepo = { create: jest.fn((x: unknown) => x), save: jest.fn() };
  const mockConfigService = {
    get: jest.fn((key: string) =>
      key === 'TELEGRAM_BOT_TOKEN'
        ? 'test-token'
        : key === 'TELEGRAM_CHAT_ID'
          ? '778570911'
          : undefined,
    ),
  };

  const makeEvent = (): Event =>
    ({
      id: 'evt-1',
      organization: { id: 'org-1' },
      camera: { name: 'Primary Camera' },
      event_type: 'person',
      confidence: 0.87,
      created_at: new Date(2026, 0, 1, 10, 0, 0),
    }) as Event;

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(NotificationLog),
          useValue: mockLogsRepo,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('logs a sent notification when the Telegram text alert succeeds', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    await service.sendTextAlert(makeEvent());
    expect(mockLogsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent' }),
    );
  });

  it('logs a failed notification when the Telegram text alert fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
    await service.sendTextAlert(makeEvent());
    expect(mockLogsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'failed' }),
    );
  });

  it('does not throw when the text alert request itself throws (network error)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    await expect(service.sendTextAlert(makeEvent())).resolves.toBeUndefined();
    expect(mockLogsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'failed' }),
    );
  });

  it('logs a sent notification when the Telegram video alert succeeds', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const tmpFile = path.join(os.tmpdir(), `clip-${Date.now()}.mp4`);
    fs.writeFileSync(tmpFile, 'fake video bytes');

    await service.sendVideoAlert(makeEvent(), tmpFile);

    expect(mockLogsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent' }),
    );
    fs.unlinkSync(tmpFile);
  });

  it('logs a failed notification when the Telegram video alert fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    const tmpFile = path.join(os.tmpdir(), `clip-${Date.now()}.mp4`);
    fs.writeFileSync(tmpFile, 'fake video bytes');

    await service.sendVideoAlert(makeEvent(), tmpFile);

    expect(mockLogsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'failed' }),
    );
    fs.unlinkSync(tmpFile);
  });
});
