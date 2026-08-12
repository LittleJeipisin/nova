import { Module } from '@nestjs/common';

import { WorkspaceMessagesController } from './workspace-messages.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

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
    MessagesController,
    WorkspaceMessagesController,
  ],

  providers: [
    MessagesService,
  ],

  exports: [
    MessagesService,
  ],
})
export class MessagesModule {}