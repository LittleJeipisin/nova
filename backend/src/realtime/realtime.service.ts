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
     * Esta room sigue reservada para el Visitor.
     */
    this.realtimeGateway.emitToConversation(
      conversationId,
      'message:new',
      message,
    );

    /*
     * Los usuarios internos reciben el mensaje
     * según la audiencia real de la conversación:
     *
     * asignada:
     *   user:{agentId}
     *
     * sin asignar:
     *   site:{siteId}:unassigned
     */
    void this.emitNewMessageToInternalAudience(conversationId, message).catch(
      () => {
        /*
         * REST sigue siendo la fuente autoritativa.
         * Un reconnect/refetch recuperará el estado.
         */
      },
    );
  }

  emitConversationUpdatedToWorkspace(
    workspaceId: string,
    conversation: unknown,
  ) {
    /*
     * OWNER / PLATFORM_ADMIN.
     */
    this.realtimeGateway.emitToWorkspace(
      workspaceId,
      'conversation:updated',
      conversation,
    );

    /*
     * ADMIN.
     *
     * El ADMIN ya no está en la room general
     * del Workspace. Está únicamente en:
     *
     * site:{siteId}
     */
    const siteId = this.getConversationSiteId(conversation);

    if (siteId) {
      this.realtimeGateway.emitToSite(
        siteId,
        'conversation:updated',
        conversation,
      );
    }
  }

  emitConversationUpdatedToUnassigned(
    _workspaceId: string,
    conversation: unknown,
  ) {
    const siteId = this.getConversationSiteId(conversation);

    if (!siteId) {
      return;
    }

    this.realtimeGateway.emitToSiteUnassigned(
      siteId,
      'conversation:updated',
      conversation,
    );
  }

  emitConversationRemovedFromUnassigned(
    _workspaceId: string,
    conversationId: string,
  ) {
    /*
     * Los callers antiguos solo entregan
     * workspaceId + conversationId.
     *
     * Consultamos la conversación para obtener
     * su siteId sin romper las firmas actuales.
     */
    void this.emitConversationRemovedFromUnassignedSite(conversationId).catch(
      () => {
        /*
         * Si realtime falla, REST sigue siendo
         * la fuente autoritativa.
         */
      },
    );
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

  private async emitConversationRemovedFromUnassignedSite(
    conversationId: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },

      select: {
        siteId: true,
      },
    });

    if (!conversation?.siteId) {
      return;
    }

    this.realtimeGateway.emitToSiteUnassigned(
      conversation.siteId,
      'conversation:removed',
      {
        conversationId,
      },
    );
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
        siteId: true,
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

    if (!conversation.siteId) {
      return;
    }

    this.realtimeGateway.emitToSiteUnassigned(
      conversation.siteId,
      'message:new',
      message,
    );
  }

  private getConversationSiteId(conversation: unknown): string | null {
    if (
      typeof conversation !== 'object' ||
      conversation === null ||
      !('siteId' in conversation)
    ) {
      return null;
    }

    const siteId = conversation.siteId;

    if (typeof siteId !== 'string' || !siteId.trim()) {
      return null;
    }

    return siteId;
  }
}
