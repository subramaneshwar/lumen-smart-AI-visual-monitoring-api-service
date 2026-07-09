import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SummariesController } from './summaries.controller';

describe('SummariesController', () => {
  let controller: SummariesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SummariesController],
    }).compile();
    controller = module.get<SummariesController>(SummariesController);
  });

  it('responds 501 Not Implemented until Phase 1 logic is built', () => {
    try {
      controller.findAll();
      throw new Error('expected findAll to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_IMPLEMENTED);
    }
  });
});
