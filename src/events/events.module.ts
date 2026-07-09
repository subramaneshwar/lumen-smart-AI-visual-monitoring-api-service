import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event } from '../common/entities/event.entity';
import { Camera } from '../common/entities/camera.entity';
import { Organization } from '../common/entities/organization.entity';
import { Person } from '../common/entities/person.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Camera, Organization, Person])],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
