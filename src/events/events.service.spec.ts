import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Between } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { RulesService } from '../rules/rules.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PersonsService } from '../persons/persons.service';
import { Event } from '../common/entities/event.entity';
import { Camera } from '../common/entities/camera.entity';

describe('EventsService', () => {
  let service: EventsService;
  const mockCamerasRepo = { findOne: jest.fn() };
  const mockEventsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn<Promise<[Event[], number]>, [unknown]>(),
  };
  const mockRulesService = { evaluate: jest.fn() };
  const mockNotificationsService = { sendTextAlert: jest.fn() };
  const mockPersonsService = { matchOrCreate: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
        { provide: getRepositoryToken(Camera), useValue: mockCamerasRepo },
        { provide: RulesService, useValue: mockRulesService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: PersonsService, useValue: mockPersonsService },
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

  it('still returns the saved event when rule evaluation throws', async () => {
    const camera = { id: 'cam-1', organization: { id: 'org-1' } } as Camera;
    mockCamerasRepo.findOne.mockResolvedValue(camera);
    mockEventsRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    mockRulesService.evaluate.mockRejectedValue(new Error('db unavailable'));

    const saveImplementation = (data: Record<string, unknown>) =>
      Promise.resolve({ id: 'evt-1', ...data } as Event);
    mockEventsRepo.save.mockImplementation(saveImplementation);

    const result = await service.ingest({
      camera_id: 'cam-1',
      event_type: 'person',
      confidence: 0.9,
      clip_path: 'x.mp4',
    });

    expect(mockRulesService.evaluate).toHaveBeenCalled();
    expect(mockNotificationsService.sendTextAlert).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'evt-1',
        event_type: 'person',
      }),
    );
  });

  describe('findAll', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('defaults to a date range for today when no date filter is given', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-13T10:00:00'));
      mockEventsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(mockEventsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            created_at: Between(
              new Date('2026-07-13T00:00:00'),
              new Date('2026-07-13T23:59:59.999'),
            ),
          }),
        }),
      );
    });

    it('uses the given date when provided', async () => {
      mockEventsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ date: '2026-07-01' });

      expect(mockEventsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            created_at: Between(
              new Date('2026-07-01T00:00:00'),
              new Date('2026-07-01T23:59:59.999'),
            ),
          }),
        }),
      );
    });

    it('throws BadRequestException for a semantically invalid date', async () => {
      await expect(service.findAll({ date: '2026-13-45' })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockEventsRepo.findAndCount).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a day-of-month rollover date', async () => {
      await expect(service.findAll({ date: '2026-02-30' })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockEventsRepo.findAndCount).not.toHaveBeenCalled();
    });

    it('filters by type when given', async () => {
      mockEventsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ date: '2026-07-01', type: 'person' });

      expect(mockEventsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({ event_type: 'person' }),
        }),
      );
    });

    it('filters by zone when given', async () => {
      mockEventsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ date: '2026-07-01', zone: 'front_door' });

      expect(mockEventsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({ zone: 'front_door' }),
        }),
      );
    });

    it('does not add type/zone keys to the where clause when omitted', async () => {
      mockEventsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ date: '2026-07-01' });

      const callArgs = mockEventsRepo.findAndCount.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArgs.where.event_type).toBeUndefined();
      expect(callArgs.where.zone).toBeUndefined();
    });

    it('defaults page to 1 and limit to 50', async () => {
      mockEventsRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ date: '2026-07-01' });

      expect(mockEventsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('computes skip/take for a later page and custom limit', async () => {
      mockEventsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ date: '2026-07-01', page: 3, limit: 10 });

      expect(mockEventsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('clamps limit to a maximum of 100', async () => {
      mockEventsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ date: '2026-07-01', limit: 500 });

      expect(mockEventsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('maps a matched person to {id, visit_count} and an unmatched event to null', async () => {
      mockEventsRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'evt-1',
            event_type: 'person',
            confidence: 0.9,
            zone: null,
            action_taken: 'critical_alert',
            created_at: new Date('2026-07-01T10:00:00.000Z'),
            person: { id: 'person-1', visit_count: 4 },
          },
          {
            id: 'evt-2',
            event_type: 'dog',
            confidence: null,
            zone: null,
            action_taken: null,
            created_at: new Date('2026-07-01T11:00:00.000Z'),
            person: null,
          },
        ],
        2,
      ]);

      const result = await service.findAll({ date: '2026-07-01' });

      expect(result.total).toBe(2);
      expect(result.events[0]).toEqual(
        expect.objectContaining({
          id: 'evt-1',
          person: { id: 'person-1', visit_count: 4 },
        }),
      );
      expect(result.events[1]).toEqual(
        expect.objectContaining({ id: 'evt-2', person: null }),
      );
    });
  });
});
