import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RulesService } from './rules.service';
import { Rule } from '../common/entities/rule.entity';
import { Event } from '../common/entities/event.entity';

describe('RulesService', () => {
  let service: RulesService;
  const mockRulesRepo = { find: jest.fn() };

  const makeEvent = (overrides: Partial<Event> = {}): Event =>
    ({
      id: 'evt-1',
      organization: { id: 'org-1' },
      event_type: 'person',
      created_at: new Date(2026, 0, 1, 10, 0, 0),
      ...overrides,
    }) as Event;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        { provide: getRepositoryToken(Rule), useValue: mockRulesRepo },
      ],
    }).compile();
    service = module.get<RulesService>(RulesService);
  });

  it('returns record_only when there are no active rules', async () => {
    mockRulesRepo.find.mockResolvedValue([]);
    const result = await service.evaluate(makeEvent());
    expect(result).toBe('record_only');
  });

  it('returns critical_alert when detected_type matches', async () => {
    mockRulesRepo.find.mockResolvedValue([
      {
        id: 'rule-1',
        config: {
          conditions: { detected_type: 'person' },
          action: 'critical_alert',
        },
      },
    ]);
    const result = await service.evaluate(makeEvent({ event_type: 'person' }));
    expect(result).toBe('critical_alert');
  });

  it('returns record_only when detected_type does not match', async () => {
    mockRulesRepo.find.mockResolvedValue([
      {
        id: 'rule-1',
        config: {
          conditions: { detected_type: 'person' },
          action: 'critical_alert',
        },
      },
    ]);
    const result = await service.evaluate(makeEvent({ event_type: 'dog' }));
    expect(result).toBe('record_only');
  });

  it('matches a time_range within a normal (non-wrapping) window', async () => {
    mockRulesRepo.find.mockResolvedValue([
      {
        id: 'rule-1',
        config: {
          conditions: { time_range: { start: '09:00', end: '17:00' } },
          action: 'critical_alert',
        },
      },
    ]);
    const result = await service.evaluate(
      makeEvent({ created_at: new Date(2026, 0, 1, 10, 0, 0) }),
    );
    expect(result).toBe('critical_alert');
  });

  it('does not match a time_range outside a normal window', async () => {
    mockRulesRepo.find.mockResolvedValue([
      {
        id: 'rule-1',
        config: {
          conditions: { time_range: { start: '09:00', end: '17:00' } },
          action: 'critical_alert',
        },
      },
    ]);
    const result = await service.evaluate(
      makeEvent({ created_at: new Date(2026, 0, 1, 20, 0, 0) }),
    );
    expect(result).toBe('record_only');
  });

  it('matches a time_range that wraps midnight, for a time inside the wrapped window', async () => {
    mockRulesRepo.find.mockResolvedValue([
      {
        id: 'rule-1',
        config: {
          conditions: { time_range: { start: '23:00', end: '06:00' } },
          action: 'critical_alert',
        },
      },
    ]);
    const result = await service.evaluate(
      makeEvent({ created_at: new Date(2026, 0, 1, 2, 0, 0) }),
    );
    expect(result).toBe('critical_alert');
  });

  it('does not match a time_range that wraps midnight, for a time outside the wrapped window', async () => {
    mockRulesRepo.find.mockResolvedValue([
      {
        id: 'rule-1',
        config: {
          conditions: { time_range: { start: '23:00', end: '06:00' } },
          action: 'critical_alert',
        },
      },
    ]);
    const result = await service.evaluate(
      makeEvent({ created_at: new Date(2026, 0, 1, 12, 0, 0) }),
    );
    expect(result).toBe('record_only');
  });

  it('skips a rule with malformed config and falls through to the default', async () => {
    mockRulesRepo.find.mockResolvedValue([
      { id: 'rule-1', config: { foo: 'bar' } },
    ]);
    const result = await service.evaluate(makeEvent());
    expect(result).toBe('record_only');
  });
});
