import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('ingestion')
export class IngestionController {
  @Get()
  findAll(): never {
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }
}
