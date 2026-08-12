import { Module } from '@nestjs/common';

import { ConversationsController } from './conversations.controller';
import { WorkspaceConversationsController } from './workspace-conversations.controller';
import { ConversationsService } from './conversations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { VisitorsModule } from '../visitors/visitors.module';

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    VisitorsModule,
  ],
  controllers: [
    ConversationsController,
    WorkspaceConversationsController,
  ],
  providers: [
    ConversationsService,
  ],
  exports: [
    ConversationsService,
  ],
})
export class ConversationsModule {}