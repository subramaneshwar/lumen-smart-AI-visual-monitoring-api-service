import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ChatController } from './chat.controller';

describe('ChatController', () => {
  let controller: ChatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
    }).compile();
    controller = module.get<ChatController>(ChatController);
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
