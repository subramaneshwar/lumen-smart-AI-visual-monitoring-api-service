import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SummariesService } from './summaries.service';
import { Summary } from '../common/entities/summary.entity';
import { Organization } from '../common/entities/organization.entity';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LLM_CLIENT, LlmClient } from '../llm/llm-client.interface';

describe('SummariesService', () => {
  let service: SummariesService;

  const org = { id: 'org-1' } as Organization;
  const mockSummariesRepo = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockOrgRepo = { findOneOrFail: jest.fn() };
  const mockEventsService = { findAll: jest.fn() };
  const mockNotificationsService = { sendText: jest.fn() };
  const mockLlmClient: LlmClient = { generate: jest.fn() };

  const makeEventSummary = (overrides = {}) => ({
    id: 'evt-1',
    event_type: 'person',
    confidence: 0.9,
    zone: 'front_door',
    action_taken: 'critical_alert',
    created_at: new Date(2026, 0, 1, 10, 0, 0),
    person: null,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOrgRepo.findOneOrFail.mockResolvedValue(org);
    mockSummariesRepo.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummariesService,
        { provide: getRepositoryToken(Summary), useValue: mockSummariesRepo },
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrgRepo,
        },
        { provide: EventsService, useValue: mockEventsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: LLM_CLIENT, useValue: mockLlmClient },
      ],
    }).compile();
    service = module.get<SummariesService>(SummariesService);
  });

  it('saves and sends a canned message when there are zero events', async () => {
    mockEventsService.findAll.mockResolvedValue({ events: [], page: 1, limit: 50, total: 0 });

    const result = await service.generateDailySummary('2026-01-01');

    expect(mockLlmClient.generate).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        organization: org,
        period: 'daily',
        date: '2026-01-01',
        content: 'No activity detected.',
      }),
    );
    expect(mockNotificationsService.sendText).toHaveBeenCalledWith(
      'No activity detected.',
      org,
    );
  });

  it('builds one prompt line per event (type/time/zone/person) and saves the LLM output', async () => {
    mockEventsService.findAll.mockResolvedValue({
      events: [
        makeEventSummary({
          event_type: 'person',
          zone: 'front_door',
          created_at: new Date(2026, 0, 1, 10, 0, 0),
          person: { id: 'p-1', visit_count: 3 },
        }),
        makeEventSummary({
          event_type: 'cat',
          zone: null,
          created_at: new Date(2026, 0, 1, 14, 30, 0),
          person: null,
        }),
      ],
      page: 1,
      limit: 50,
      total: 2,
    });
    (mockLlmClient.generate as jest.Mock).mockResolvedValue(
      'A person was detected at the front door this morning.',
    );

    const result = await service.generateDailySummary('2026-01-01');

    const [firstEventTime, secondEventTime] = [
      new Date(2026, 0, 1, 10, 0, 0).toLocaleTimeString(),
      new Date(2026, 0, 1, 14, 30, 0).toLocaleTimeString(),
    ];
    expect(mockLlmClient.generate).toHaveBeenCalledWith({
      system: expect.stringContaining('home security assistant') as string,
      prompt:
        `Today's detected events:\n` +
        `- ${firstEventTime}: person in front_door (known visitor, visit #3)\n` +
        `- ${secondEventTime}: cat`,
    });
    expect(result.content).toBe(
      'A person was detected at the front door this morning.',
    );
    expect(mockNotificationsService.sendText).toHaveBeenCalledWith(
      'A person was detected at the front door this morning.',
      org,
    );
  });

  it('saves a failure notice and still notifies when the LLM call fails', async () => {
    mockEventsService.findAll.mockResolvedValue({
      events: [makeEventSummary()],
      page: 1,
      limit: 50,
      total: 1,
    });
    (mockLlmClient.generate as jest.Mock).mockRejectedValue(
      new Error('rate limited'),
    );

    const result = await service.generateDailySummary('2026-01-01');

    expect(result.content).toBe('Summary generation failed — see logs.');
    expect(mockNotificationsService.sendText).toHaveBeenCalledWith(
      'Summary generation failed — see logs.',
      org,
    );
  });

  it('defaults to today when no date is given', async () => {
    mockEventsService.findAll.mockResolvedValue({ events: [], page: 1, limit: 50, total: 0 });

    await service.generateDailySummary();

    const callArg = mockEventsService.findAll.mock.calls[0][0] as {
      date: string;
    };
    expect(callArg.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('findByPeriodAndDate defaults period to daily and date to today', async () => {
    mockSummariesRepo.find.mockResolvedValue([]);

    await service.findByPeriodAndDate();

    expect(mockSummariesRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ period: 'daily' }),
      }),
    );
  });

  it('updates an existing row instead of creating a duplicate when a summary already exists for the date', async () => {
    mockEventsService.findAll.mockResolvedValue({
      events: [],
      page: 1,
      limit: 50,
      total: 0,
    });
    const existing = {
      id: 'sum-1',
      organization: org,
      period: 'daily',
      date: '2026-01-01',
      content: 'old content',
    };
    mockSummariesRepo.findOne.mockResolvedValue(existing);

    const result = await service.generateDailySummary('2026-01-01');

    expect(mockSummariesRepo.create).not.toHaveBeenCalled();
    expect(mockSummariesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sum-1', content: 'No activity detected.' }),
    );
    expect(result.content).toBe('No activity detected.');
  });

  it('falls back to a fixed message when the LLM returns empty content', async () => {
    mockEventsService.findAll.mockResolvedValue({
      events: [makeEventSummary()],
      page: 1,
      limit: 50,
      total: 1,
    });
    (mockLlmClient.generate as jest.Mock).mockResolvedValue('   ');

    const result = await service.generateDailySummary('2026-01-01');

    expect(result.content).toBe('Summary generation returned empty content.');
  });

  it('throws InternalServerErrorException when no organization is configured', async () => {
    mockOrgRepo.findOneOrFail.mockRejectedValue(new Error('no rows'));

    await expect(service.generateDailySummary('2026-01-01')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
