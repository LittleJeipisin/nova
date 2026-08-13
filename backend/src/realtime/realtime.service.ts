import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {}

  emitNewMessage(conversationId: string, message: unknown) {
    /*
     * conversation:{conversationId}
     *
     * A partir de ahora esta room queda
     * reservada para el Visitor.
     *
     * Así el Visitor recibe tanto sus propios
     * mensajes como los enviados por el Agent.
     */
    this.realtimeGateway.emitToConversation(
      conversationId,
      'message:new',
      message,
    );

    /*
     * Los usuarios internos reciben el mensaje
     * por su room de bandeja:
     *
     * asignada:
     *   user:{agentId}
     *
     * sin asignar:
     *   workspace:{workspaceId}:unassigned
     */
    void this.emitNewMessageToInternalAudience(conversationId, message).catch(
      () => {
        /*
         * REST continúa siendo la fuente
         * autoritativa.
         *
         * Si realtime falla, un reconnect/refetch
         * recuperará el estado.
         */
      },
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

  emitConversationUpdatedToUnassigned(
    workspaceId: string,
    conversation: unknown,
  ) {
    this.realtimeGateway.emitToUnassigned(
      workspaceId,
      'conversation:updated',
      conversation,
    );
  }

  emitConversationRemovedFromUnassigned(
    workspaceId: string,
    conversationId: string,
  ) {
    this.realtimeGateway.emitToUnassigned(workspaceId, 'conversation:removed', {
      conversationId,
    });
  }

  emitConversationUpdatedToUser(userId: string, conversation: unknown) {
    this.realtimeGateway.emitToUser(
      userId,
      'conversation:updated',
      conversation,
    );
  }

  emitConversationRemovedFromUser(userId: string, conversationId: string) {
    this.realtimeGateway.emitToUser(userId, 'conversation:removed', {
      conversationId,
    });
  }

  private async emitNewMessageToInternalAudience(
    conversationId: string,
    message: unknown,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },

      select: {
        workspaceId: true,
        assignedAgentId: true,
      },
    });

    if (!conversation) {
      return;
    }

    if (conversation.assignedAgentId) {
      this.realtimeGateway.emitToUser(
        conversation.assignedAgentId,
        'message:new',
        message,
      );

      return;
    }

    this.realtimeGateway.emitToUnassigned(
      conversation.workspaceId,
      'message:new',
      message,
    );
  }
}
