import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('persons')
export class PersonsController {
  @Get()
  findAll(): never {
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }
}
