import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetentionService } from './retention.service';
import { Event } from '../common/entities/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  providers: [RetentionService],
})
export class RetentionModule {}
