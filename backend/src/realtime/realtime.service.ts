import { Injectable } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  emitNewMessage(
    conversationId: string,
    message: unknown,
  ) {
    this.realtimeGateway.emitToConversation(
      conversationId,
      'message:new',
      message,
    );
  }

  emitConversationUpdatedToWorkspace(
    workspaceId: string,
    conversation: unknown,
  ) {
    this.realtimeGateway.emitToWorkspace(
      workspaceId,
      'conversation:updated',
      conversation,
    );
  }

  emitConversationUpdatedToUser(
    userId: string,
    conversation: unknown,
  ) {
    this.realtimeGateway.emitToUser(
      userId,
      'conversation:updated',
      conversation,
    );
  }

  emitConversationRemovedFromUser(
    userId: string,
    conversationId: string,
  ) {
    this.realtimeGateway.emitToUser(
      userId,
      'conversation:removed',
      {
        conversationId,
      },
    );
  }
}