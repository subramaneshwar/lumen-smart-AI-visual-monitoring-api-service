import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EmbeddingService } from './embedding.service';
import { Event } from '../common/entities/event.entity';
import { Camera } from '../common/entities/camera.entity';
import { Organization } from '../common/entities/organization.entity';
import { Person } from '../common/entities/person.entity';
import { RulesModule } from '../rules/rules.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonsModule } from '../persons/persons.module';
import { EmbeddingModule } from '../llm/embedding.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Camera, Organization, Person]),
    RulesModule,
    NotificationsModule,
    PersonsModule,
    EmbeddingModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, EmbeddingService],
  exports: [EventsService],
})
export class EventsModule {}
