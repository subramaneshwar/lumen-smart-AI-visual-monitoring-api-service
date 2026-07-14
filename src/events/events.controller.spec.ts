import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

describe('EventsController', () => {
  let controller: EventsController;
  const mockEventsService = { findAll: jest.fn(), ingest: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: mockEventsService }],
    }).compile();
    controller = module.get<EventsController>(EventsController);
  });

  it('delegates to EventsService.findAll with parsed numeric page/limit', async () => {
    mockEventsService.findAll.mockResolvedValue({
      events: [],
      page: 2,
      limit: 10,
      total: 0,
    });

    const result = await controller.findAll({
      date: '2026-07-01',
      type: 'person',
      zone: 'front_door',
      page: '2',
      limit: '10',
    });

    expect(mockEventsService.findAll).toHaveBeenCalledWith({
      date: '2026-07-01',
      type: 'person',
      zone: 'front_door',
      page: 2,
      limit: 10,
    });
    expect(result).toEqual({ events: [], page: 2, limit: 10, total: 0 });
  });

  it('passes undefined page/limit when omitted', async () => {
    mockEventsService.findAll.mockResolvedValue({
      events: [],
      page: 1,
      limit: 50,
      total: 0,
    });

    await controller.findAll({});

    expect(mockEventsService.findAll).toHaveBeenCalledWith({
      date: undefined,
      type: undefined,
      zone: undefined,
      page: undefined,
      limit: undefined,
    });
  });
});
