import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('rules')
export class RulesController {
  @Get()
  findAll(): never {
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }
}
