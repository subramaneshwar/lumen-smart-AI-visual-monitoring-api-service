import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';

describe('IngestionController', () => {
  let controller: IngestionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
    }).compile();
    controller = module.get<IngestionController>(IngestionController);
  });

  it('responds 501 Not Implemented until Phase 1 logic is built', () => {
    try {
      controller.findAll();
      throw new Error('expected findAll to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  });
});
