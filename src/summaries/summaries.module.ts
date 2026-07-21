import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummariesController } from './summaries.controller';
import { SummariesService } from './summaries.service';
import { Summary } from '../common/entities/summary.entity';
import { Organization } from '../common/entities/organization.entity';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Summary, Organization]),
    EventsModule,
    NotificationsModule,
    LlmModule,
  ],
  controllers: [SummariesController],
  providers: [SummariesService],
})
export class SummariesModule {}
