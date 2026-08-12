import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { VisitorsService } from '../visitors/visitors.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly visitorsService: VisitorsService,
  ) {}

  async create(
    workspaceSlug: string,
    visitorToken: string | undefined,
  ) {
    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          slug: workspaceSlug
            .trim()
            .toLowerCase(),
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace no encontrado',
      );
    }

    if (workspace.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'El workspace está inactivo',
      );
    }

    /*
    * Ya no confiamos en un visitorId recibido
    * desde el navegador.
    *
    * La identidad sale del JWT firmado por Nova.
    */
    const visitor =
      await this.visitorsService.verifyVisitorToken(
        visitorToken,
        workspace.id,
      );

    const existingConversation =
      await this.prisma.conversation.findFirst({
        where: {
          workspaceId: workspace.id,
          visitorId: visitor.id,
          status: {
            in: [
              'OPEN',
              'PENDING',
            ],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (existingConversation) {
      return existingConversation;
    }

    const conversation =
      await this.prisma.conversation.create({
        data: {
          workspaceId: workspace.id,
          visitorId: visitor.id,
          status: 'OPEN',
        },
      });

    await this.emitConversationUpdated(
      conversation.id,
    );

    return conversation;
  }
  async findAllForWorkspace(
    workspaceId: string,
    requester: {
      userId: string;
      role: string;
    },
    status?: string,
  ) {
    const where: any = {
      workspaceId,
    };

    // Un AGENT solo puede ver sus propias conversaciones.
    if (requester.role === 'AGENT') {
      where.assignedAgentId = requester.userId;
    }

  // Filtro opcional por estado.
    if (status) {
      const normalizedStatus = status
        .trim()
        .toUpperCase();

      const validStatuses = [
        'OPEN',
        'PENDING',
        'CLOSED',
      ];

      if (!validStatuses.includes(normalizedStatus)) {
        throw new BadRequestException(
          'Estado de conversación inválido',
        );
      }

      where.status = normalizedStatus;
    }

    return this.prisma.conversation.findMany({
      where,
      include: {
        visitor: true,
        assignedAgent: {
          select: {
            id: true,
            username: true,
            role: true,
            status: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }
  async findOneForWorkspace(
    workspaceId: string,
    conversationId: string,
    requester: {
      userId: string;
      role: string;
    },
  ) {
    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          workspaceId,
        },
        include: {
          visitor: true,
          assignedAgent: {
            select: {
              id: true,
              username: true,
              role: true,
              status: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
            include: {
              senderUser: {
                select: {
                  id: true,
                  username: true,
                  role: true,
                },
              },
            },
          },
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversación no encontrada',
      );
    }

    if (
      requester.role === 'AGENT' &&
      conversation.assignedAgentId !== requester.userId
    ) {
      throw new ForbiddenException(
        'No tienes acceso a esta conversación',
      );
    }

    return conversation;
  }
  async assignAgent(
    workspaceId: string,
    conversationId: string,
    agentId: string,
  ) {
    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          workspaceId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversación no encontrada',
      );
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede asignar una conversación cerrada',
      );
    }

    const agent =
      await this.prisma.user.findFirst({
        where: {
          id: agentId,
          workspaceId,
          role: 'AGENT',
          status: 'ACTIVE',
        },
      });

    if (!agent) {
      throw new NotFoundException(
        'Agente no encontrado o no disponible',
      );
    }

    /*
    * Guardamos el agente anterior antes
    * de modificar la conversación.
    */
    const previousAgentId =
      conversation.assignedAgentId;

    const updatedConversation =
      await this.prisma.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          assignedAgentId: agent.id,
          updatedAt: new Date(),
        },
        include: {
          visitor: true,

          assignedAgent: {
            select: {
              id: true,
              username: true,
              role: true,
              status: true,
            },
          },

          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

    /*
    * OWNER / ADMIN / PLATFORM_ADMIN
    */
    this.realtimeService
      .emitConversationUpdatedToWorkspace(
        workspaceId,
        updatedConversation,
      );

    /*
    * Nuevo agente.
    */
    this.realtimeService
      .emitConversationUpdatedToUser(
        agent.id,
        updatedConversation,
      );

    /*
    * Si hubo reasignación a otro agente,
    * avisamos al anterior para que quite
    * la conversación de su bandeja.
    */
    if (
      previousAgentId &&
      previousAgentId !== agent.id
    ) {
      this.realtimeService
        .emitConversationRemovedFromUser(
          previousAgentId,
          conversation.id,
        );
    }

    return updatedConversation;
  }
  async close(
    workspaceId: string,
    conversationId: string,
    userId: string,
  ) {
    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          workspaceId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversación no encontrada',
      );
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException(
        'La conversación ya está cerrada',
      );
    }

    const agent =
      await this.prisma.user.findFirst({
        where: {
          id: userId,
          workspaceId,
          role: 'AGENT',
          status: 'ACTIVE',
        },
      });

    if (!agent) {
      throw new BadRequestException(
        'Agente no válido',
      );
    }

    if (
      conversation.assignedAgentId !== agent.id
    ) {
      throw new BadRequestException(
        'Solo el agente asignado puede cerrar la conversación',
      );
    }

    const updatedConversation =
      await this.prisma.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    await this.emitConversationUpdated(
      updatedConversation.id,
    );

    return updatedConversation;
  }
  async updateStatus(
    workspaceId: string,
    conversationId: string,
    userId: string,
    status: string,
  ) {
    const normalizedStatus = status
      ?.trim()
      .toUpperCase();

    if (
      normalizedStatus !== 'OPEN' &&
      normalizedStatus !== 'PENDING'
    ) {
      throw new BadRequestException(
        'Solo se permite cambiar el estado a OPEN o PENDING',
      );
    }

    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          workspaceId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversación no encontrada',
      );
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede modificar una conversación cerrada',
      );
    }

    if (
      conversation.assignedAgentId !== userId
    ) {
      throw new ForbiddenException(
        'Solo el agente asignado puede cambiar el estado',
      );
    }

    const updatedConversation =
      await this.prisma.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          status: normalizedStatus,
          updatedAt: new Date(),
        },
      });

    await this.emitConversationUpdated(
      updatedConversation.id,
    );

    return updatedConversation;
  }
  private async emitConversationUpdated(
    conversationId: string,
  ) {
    const conversation =
      await this.prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
        include: {
          visitor: true,

          assignedAgent: {
            select: {
              id: true,
              username: true,
              role: true,
              status: true,
            },
          },

          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

    if (!conversation) {
      return;
    }

    /*
    * OWNER / ADMIN / PLATFORM_ADMIN
    */
    this.realtimeService
      .emitConversationUpdatedToWorkspace(
        conversation.workspaceId,
        conversation,
      );

    /*
    * Si tiene agente asignado,
    * actualizamos también su bandeja privada.
    */
    if (conversation.assignedAgentId) {
      this.realtimeService
        .emitConversationUpdatedToUser(
          conversation.assignedAgentId,
          conversation,
        );
    }
  }
}