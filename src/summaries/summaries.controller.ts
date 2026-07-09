import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('summaries')
export class SummariesController {
  @Get()
  findAll(): never {
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }
}
