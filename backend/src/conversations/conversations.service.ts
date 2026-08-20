import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { VisitorsService } from '../visitors/visitors.service';

type ConversationStatusValue = 'OPEN' | 'PENDING' | 'CLOSED';

type ConversationWhereFilter = {
  workspaceId: string;
  siteId?: string;

  OR?: Array<{
    assignedAgentId: string | null;
  }>;

  status?: ConversationStatusValue;
};

type ConversationRequester = {
  userId: string;
  role: string;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly realtimeService: RealtimeService,

    private readonly visitorsService: VisitorsService,
  ) {}

  private async getRequesterSiteId(
    workspaceId: string,
    requester: ConversationRequester,
  ) {
    if (requester.role !== 'ADMIN' && requester.role !== 'AGENT') {
      return null;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: requester.userId,

        workspaceId,

        status: 'ACTIVE',
      },
    });

    if (!user || user.role !== requester.role) {
      throw new ForbiddenException('Usuario no autorizado');
    }

    if (!user.siteId) {
      throw new ForbiddenException('El usuario no tiene una página asignada');
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: user.siteId,

        workspaceId,

        status: 'ACTIVE',
      },
    });

    if (!site) {
      throw new ForbiddenException('La página del usuario no está disponible');
    }

    return site.id;
  }

  private async ensureActiveSite(workspaceId: string, siteId: string | null) {
    if (!siteId) {
      throw new BadRequestException(
        'La conversación no tiene una página asignada',
      );
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,

        workspaceId,

        status: 'ACTIVE',
      },
    });

    if (!site) {
      throw new BadRequestException(
        'La página de la conversación no está disponible',
      );
    }

    return site;
  }

  async create(workspaceSlug: string, visitorToken: string | undefined) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        slug: workspaceSlug.trim().toLowerCase(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace no encontrado');
    }

    if (workspace.status !== 'ACTIVE') {
      throw new UnauthorizedException('El workspace está inactivo');
    }

    const visitor = await this.visitorsService.verifyVisitorToken(
      visitorToken,
      workspace.id,
    );

    if (!visitor.siteId) {
      throw new BadRequestException(
        'El visitante no tiene una página asignada',
      );
    }

    await this.ensureActiveSite(workspace.id, visitor.siteId);

    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        workspaceId: workspace.id,

        siteId: visitor.siteId,

        visitorId: visitor.id,

        status: {
          in: ['OPEN', 'PENDING'],
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingConversation) {
      return existingConversation;
    }

    /*
     * Crear la Conversation NO la publica
     * todavía en realtime.
     *
     * Recién cuando exista un Message,
     * MessagesService emitirá:
     *
     * message:new
     * conversation:updated
     */
    return this.prisma.conversation.create({
      data: {
        workspaceId: workspace.id,

        siteId: visitor.siteId,

        visitorId: visitor.id,

        status: 'OPEN',
      },
    });
  }

  async findActiveForVisitor(
    workspaceSlug: string,
    visitorToken: string | undefined,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        slug: workspaceSlug.trim().toLowerCase(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace no encontrado');
    }

    if (workspace.status !== 'ACTIVE') {
      throw new UnauthorizedException('El workspace está inactivo');
    }

    const visitor = await this.visitorsService.verifyVisitorToken(
      visitorToken,
      workspace.id,
    );

    if (!visitor.siteId) {
      throw new BadRequestException(
        'El visitante no tiene una página asignada',
      );
    }

    await this.ensureActiveSite(workspace.id, visitor.siteId);

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        workspaceId: workspace.id,

        siteId: visitor.siteId,

        visitorId: visitor.id,

        status: {
          in: ['OPEN', 'PENDING'],
        },

        /*
         * Una conversación sin mensajes
         * todavía no se considera iniciada.
         */
        messages: {
          some: {},
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      conversation,
    };
  }

  async findAllForWorkspace(
    workspaceId: string,
    requester: ConversationRequester,
    status?: string,
  ) {
    const where: ConversationWhereFilter = {
      workspaceId,
    };

    const requesterSiteId = await this.getRequesterSiteId(
      workspaceId,
      requester,
    );

    /*
     * OWNER / PLATFORM_ADMIN:
     * todas las páginas del Workspace.
     *
     * ADMIN:
     * solamente su página.
     *
     * AGENT:
     * solamente su página y además:
     * - sin asignar;
     * - asignadas a él.
     */
    if (requesterSiteId) {
      where.siteId = requesterSiteId;
    }

    if (requester.role === 'AGENT') {
      where.OR = [
        {
          assignedAgentId: null,
        },
        {
          assignedAgentId: requester.userId,
        },
      ];
    }

    if (status) {
      const candidate = status.trim().toUpperCase();

      if (
        candidate !== 'OPEN' &&
        candidate !== 'PENDING' &&
        candidate !== 'CLOSED'
      ) {
        throw new BadRequestException('Estado de conversación inválido');
      }

      where.status = candidate;
    }

    return this.prisma.conversation.findMany({
      where: {
        ...where,

        /*
         * Una conversación solamente aparece
         * en las bandejas internas cuando ya
         * existe al menos un mensaje.
         */
        messages: {
          some: {},
        },
      },

      include: {
        visitor: true,

        assignedAgent: {
          select: {
            id: true,

            username: true,

            role: true,

            status: true,

            siteId: true,
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
    requester: ConversationRequester,
  ) {
    const requesterSiteId = await this.getRequesterSiteId(
      workspaceId,
      requester,
    );

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,

        workspaceId,

        ...(requesterSiteId
          ? {
              siteId: requesterSiteId,
            }
          : {}),
      },

      include: {
        visitor: true,

        assignedAgent: {
          select: {
            id: true,

            username: true,

            role: true,

            status: true,

            siteId: true,
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
      throw new NotFoundException('Conversación no encontrada');
    }

    if (
      requester.role === 'AGENT' &&
      conversation.assignedAgentId &&
      conversation.assignedAgentId !== requester.userId
    ) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    return conversation;
  }

  async assignAgent(
    workspaceId: string,
    conversationId: string,
    agentId: string,
    requester: ConversationRequester,
  ) {
    const requesterSiteId = await this.getRequesterSiteId(
      workspaceId,
      requester,
    );

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,

        workspaceId,

        ...(requesterSiteId
          ? {
              siteId: requesterSiteId,
            }
          : {}),
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede asignar una conversación cerrada',
      );
    }

    await this.ensureActiveSite(workspaceId, conversation.siteId);

    const agent = await this.prisma.user.findFirst({
      where: {
        id: agentId,

        workspaceId,

        role: 'AGENT',

        status: 'ACTIVE',

        siteId: conversation.siteId,
      },
    });

    if (!agent) {
      throw new NotFoundException(
        'Agente no encontrado, no disponible o pertenece a otra página',
      );
    }

    const previousAgentId = conversation.assignedAgentId;

    const updatedConversation = await this.prisma.conversation.update({
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

            siteId: true,
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

    this.realtimeService.emitConversationUpdatedToWorkspace(
      workspaceId,
      updatedConversation,
    );

    /*
     * Primero avisamos al nuevo agente
     * que la conversación ahora le pertenece.
     *
     * Después la retiramos de la bandeja
     * de conversaciones sin asignar.
     */
    this.realtimeService.emitConversationUpdatedToUser(
      agent.id,
      updatedConversation,
    );

    if (!previousAgentId) {
      this.realtimeService.emitConversationRemovedFromUnassigned(
        workspaceId,
        conversation.id,
      );
    }

    if (previousAgentId && previousAgentId !== agent.id) {
      this.realtimeService.emitConversationRemovedFromUser(
        previousAgentId,
        conversation.id,
      );
    }

    return updatedConversation;
  }

  async claim(workspaceId: string, conversationId: string, userId: string) {
    const agentSiteId = await this.getRequesterSiteId(workspaceId, {
      userId,
      role: 'AGENT',
    });

    if (!agentSiteId) {
      throw new UnauthorizedException('Agente no autorizado');
    }

    /*
     * Toma atómica.
     *
     * Además de assignedAgentId = null,
     * exigimos que la conversación
     * pertenezca al mismo Site.
     */
    const claimed = await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,

        workspaceId,

        siteId: agentSiteId,

        assignedAgentId: null,

        status: {
          in: ['OPEN', 'PENDING'],
        },
      },

      data: {
        assignedAgentId: userId,

        updatedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,

          workspaceId,

          siteId: agentSiteId,
        },
      });

      if (!conversation) {
        throw new NotFoundException('Conversación no encontrada');
      }

      if (conversation.status === 'CLOSED') {
        throw new BadRequestException('La conversación está cerrada');
      }

      /*
       * Si el mismo agente ya la tomó,
       * hacemos el endpoint idempotente.
       */
      if (conversation.assignedAgentId === userId) {
        return this.findOneForWorkspace(workspaceId, conversationId, {
          userId,
          role: 'AGENT',
        });
      }

      throw new ConflictException(
        'Esta conversación ya fue tomada por otro agente',
      );
    }

    const updatedConversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,

        workspaceId,

        siteId: agentSiteId,

        assignedAgentId: userId,
      },

      include: {
        visitor: true,

        assignedAgent: {
          select: {
            id: true,

            username: true,

            role: true,

            status: true,

            siteId: true,
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

    if (!updatedConversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    this.realtimeService.emitConversationUpdatedToWorkspace(
      workspaceId,
      updatedConversation,
    );

    this.realtimeService.emitConversationRemovedFromUnassigned(
      workspaceId,
      conversationId,
    );

    this.realtimeService.emitConversationUpdatedToUser(
      userId,
      updatedConversation,
    );

    return updatedConversation;
  }

  async close(workspaceId: string, conversationId: string, userId: string) {
    const agentSiteId = await this.getRequesterSiteId(workspaceId, {
      userId,

      role: 'AGENT',
    });

    if (!agentSiteId) {
      throw new BadRequestException('Agente no válido');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,

        workspaceId,

        siteId: agentSiteId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException('La conversación ya está cerrada');
    }

    if (conversation.assignedAgentId !== userId) {
      throw new BadRequestException(
        'Solo el agente asignado puede cerrar la conversación',
      );
    }

    const updatedConversation = await this.prisma.conversation.update({
      where: {
        id: conversation.id,
      },

      data: {
        status: 'CLOSED',

        closedAt: new Date(),

        updatedAt: new Date(),
      },
    });

    /*
     * Aquí se notificará también
     * al Visitor mediante:
     *
     * conversation:updated
     */
    await this.emitConversationUpdated(updatedConversation.id);

    return updatedConversation;
  }

  async updateStatus(
    workspaceId: string,
    conversationId: string,
    userId: string,
    status: string,
  ) {
    const normalizedStatus = status.trim().toUpperCase();

    if (normalizedStatus !== 'OPEN' && normalizedStatus !== 'PENDING') {
      throw new BadRequestException(
        'Solo se permite cambiar el estado a OPEN o PENDING',
      );
    }

    const agentSiteId = await this.getRequesterSiteId(workspaceId, {
      userId,

      role: 'AGENT',
    });

    if (!agentSiteId) {
      throw new ForbiddenException('Agente no autorizado');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,

        workspaceId,

        siteId: agentSiteId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede modificar una conversación cerrada',
      );
    }

    if (conversation.assignedAgentId !== userId) {
      throw new ForbiddenException(
        'Solo el agente asignado puede cambiar el estado',
      );
    }

    const updatedConversation = await this.prisma.conversation.update({
      where: {
        id: conversation.id,
      },

      data: {
        status: normalizedStatus,

        updatedAt: new Date(),
      },
    });

    await this.emitConversationUpdated(updatedConversation.id);

    return updatedConversation;
  }

  private async emitConversationUpdated(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
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

            siteId: true,
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
     * IMPORTANTE:
     *
     * La room conversation:{id}
     * pertenece exclusivamente al Visitor.
     *
     * Con esto el widget recibe CLOSED
     * inmediatamente cuando el agente
     * finaliza la conversación.
     */
    this.realtimeService.emitConversationUpdatedToVisitor(
      conversation.id,
      conversation,
    );

    /*
     * OWNER + ADMIN.
     */
    this.realtimeService.emitConversationUpdatedToWorkspace(
      conversation.workspaceId,
      conversation,
    );

    /*
     * AGENT.
     */
    if (conversation.assignedAgentId) {
      this.realtimeService.emitConversationUpdatedToUser(
        conversation.assignedAgentId,
        conversation,
      );
    } else {
      this.realtimeService.emitConversationUpdatedToUnassigned(
        conversation.workspaceId,
        conversation,
      );
    }
  }
}
