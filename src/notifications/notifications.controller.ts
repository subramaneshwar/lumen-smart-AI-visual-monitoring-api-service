import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('notifications')
export class NotificationsController {
  @Get()
  findAll(): never {
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }
}
