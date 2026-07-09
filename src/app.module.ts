import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { EventsModule } from './events/events.module';
import { RulesModule } from './rules/rules.module';
import { PersonsModule } from './persons/persons.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SummariesModule } from './summaries/summaries.module';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    CommonModule,
    HealthModule,
    IngestionModule,
    EventsModule,
    RulesModule,
    PersonsModule,
    NotificationsModule,
    SummariesModule,
    ChatModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
