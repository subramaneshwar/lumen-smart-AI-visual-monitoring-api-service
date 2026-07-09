import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('chat')
export class ChatController {
  @Get()
  findAll(): never {
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }
}
