import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmbeddingService } from './embedding.service';
import { Event } from '../common/entities/event.entity';
import {
  EMBEDDING_CLIENT,
  EmbeddingClient,
} from '../llm/embedding-client.interface';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  const mockEventsRepo = { manager: { query: jest.fn() } };
  const mockEmbeddingClient: EmbeddingClient = { embed: jest.fn() };

  const makeEvent = (overrides: Partial<Event> = {}): Event =>
    ({
      id: 'evt-1',
      event_type: 'person',
      zone: 'front_door',
      created_at: new Date(2026, 0, 1, 10, 15, 0),
      person: null,
      ...overrides,
    }) as Event;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
        { provide: EMBEDDING_CLIENT, useValue: mockEmbeddingClient },
      ],
    }).compile();
    service = module.get<EmbeddingService>(EmbeddingService);
  });

  const expectedTime = new Date(2026, 0, 1, 10, 15, 0).toLocaleTimeString();

  it('builds a description with a zone and no person, and writes it via raw UPDATE', async () => {
    (mockEmbeddingClient.embed as jest.Mock).mockResolvedValue([0.1, 0.2]);

    await service.embedEvent(makeEvent());

    expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
      `person detected in front_door at ${expectedTime}`,
    );
    expect(mockEventsRepo.manager.query).toHaveBeenCalledWith(
      'UPDATE events SET description = $1, description_embedding = $2 WHERE id = $3',
      [
        `person detected in front_door at ${expectedTime}`,
        '[0.1,0.2]',
        'evt-1',
      ],
    );
  });

  it('appends the known-visitor clause when a zone and a person are both present', async () => {
    (mockEmbeddingClient.embed as jest.Mock).mockResolvedValue([0.1]);

    await service.embedEvent(
      makeEvent({ person: { id: 'p-1', visit_count: 3 } as Event['person'] }),
    );

    expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
      `person detected in front_door at ${expectedTime} (known visitor, visit #3)`,
    );
  });

  it('omits the zone clause when the event has no zone and no person', async () => {
    (mockEmbeddingClient.embed as jest.Mock).mockResolvedValue([0.1]);

    await service.embedEvent(makeEvent({ zone: null }));

    expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
      `person detected at ${expectedTime}`,
    );
  });

  it('omits the zone clause but appends the known-visitor clause when there is no zone but a person is matched', async () => {
    (mockEmbeddingClient.embed as jest.Mock).mockResolvedValue([0.1]);

    await service.embedEvent(
      makeEvent({
        zone: null,
        person: { id: 'p-1', visit_count: 3 } as Event['person'],
      }),
    );

    expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
      `person detected at ${expectedTime} (known visitor, visit #3)`,
    );
  });

  it('propagates an embed() rejection to the caller (EventsService is responsible for catching it)', async () => {
    (mockEmbeddingClient.embed as jest.Mock).mockRejectedValue(
      new Error('rate limited'),
    );

    await expect(service.embedEvent(makeEvent())).rejects.toThrow(
      'rate limited',
    );
  });
});
