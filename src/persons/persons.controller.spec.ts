import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PersonsController } from './persons.controller';

describe('PersonsController', () => {
  let controller: PersonsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonsController],
    }).compile();
    controller = module.get<PersonsController>(PersonsController);
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
