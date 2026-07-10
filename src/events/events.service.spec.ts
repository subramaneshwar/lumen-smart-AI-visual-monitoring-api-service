import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { RulesService } from '../rules/rules.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Event } from '../common/entities/event.entity';
import { Camera } from '../common/entities/camera.entity';

describe('EventsService', () => {
  let service: EventsService;
  const mockCamerasRepo = { findOne: jest.fn() };
  const mockEventsRepo = { create: jest.fn(), save: jest.fn() };
  const mockRulesService = { evaluate: jest.fn() };
  const mockNotificationsService = { sendTextAlert: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
        { provide: getRepositoryToken(Camera), useValue: mockCamerasRepo },
        { provide: RulesService, useValue: mockRulesService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();
    service = module.get<EventsService>(EventsService);
  });

  it('throws NotFoundException when the camera does not exist', async () => {
    mockCamerasRepo.findOne.mockResolvedValue(null);
    await expect(
      service.ingest({
        camera_id: 'missing',
        event_type: 'person',
        confidence: 0.9,
        clip_path: 'x.mp4',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('saves and returns an event when the camera exists', async () => {
    const camera = { id: 'cam-1', organization: { id: 'org-1' } } as Camera;
    mockCamerasRepo.findOne.mockResolvedValue(camera);
    mockEventsRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    mockRulesService.evaluate.mockResolvedValue('record_only');

    const saveImplementation = (data: Record<string, unknown>) =>
      Promise.resolve({ id: 'evt-1', ...data } as Event);
    mockEventsRepo.save.mockImplementation(saveImplementation);

    const result = await service.ingest({
      camera_id: 'cam-1',
      event_type: 'person',
      confidence: 0.9,
      clip_path: 'x.mp4',
    });

    expect(mockEventsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        camera,
        organization: camera.organization,
        event_type: 'person',
        confidence: 0.9,
      }),
    );
    expect(mockEventsRepo.save).toHaveBeenCalledTimes(2);
    expect(mockRulesService.evaluate).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'evt-1',
        event_type: 'person',
        action_taken: 'record_only',
      }),
    );
  });
});
