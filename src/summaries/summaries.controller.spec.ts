import { Test, TestingModule } from '@nestjs/testing';
import { SummariesController } from './summaries.controller';
import { SummariesService } from './summaries.service';

describe('SummariesController', () => {
  let controller: SummariesController;
  const mockService = {
    findByPeriodAndDate: jest.fn(),
    generateDailySummary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SummariesController],
      providers: [{ provide: SummariesService, useValue: mockService }],
    }).compile();
    controller = module.get<SummariesController>(SummariesController);
  });

  it('GET /summaries passes period and date through to the service', async () => {
    mockService.findByPeriodAndDate.mockResolvedValue([]);

    await controller.findAll({ period: 'daily', date: '2026-01-01' });

    expect(mockService.findByPeriodAndDate).toHaveBeenCalledWith(
      'daily',
      '2026-01-01',
    );
  });

  it('POST /summaries/generate passes the date through to the service', async () => {
    mockService.generateDailySummary.mockResolvedValue({ id: 'sum-1' });

    const result = await controller.generate({ date: '2026-01-01' });

    expect(mockService.generateDailySummary).toHaveBeenCalledWith(
      '2026-01-01',
    );
    expect(result).toEqual({ id: 'sum-1' });
  });
});
