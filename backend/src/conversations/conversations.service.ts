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

    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        workspaceId: workspace.id,

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
     * IMPORTANTE:
     *
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

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        workspaceId: workspace.id,

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

    /*
     * Un AGENT puede ver:
     *
     * - conversaciones sin asignar;
     * - conversaciones asignadas a él.
     *
     * No puede ver conversaciones asignadas
     * a otro AGENT.
     */
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
         *
         * Esto evita chats vacíos provocados
         * únicamente por abrir el widget.
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
    const conversation = await this.prisma.conversation.findFirst({
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
      throw new NotFoundException('Conversación no encontrada');
    }

    /*
     * El AGENT puede abrir:
     *
     * - una conversación sin asignar;
     * - una conversación asignada a él.
     *
     * Si pertenece a otro agente,
     * se bloquea.
     */
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
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
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

    const agent = await this.prisma.user.findFirst({
      where: {
        id: agentId,
        workspaceId,
        role: 'AGENT',
        status: 'ACTIVE',
      },
    });

    if (!agent) {
      throw new NotFoundException('Agente no encontrado o no disponible');
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
     * OWNER / ADMIN / PLATFORM_ADMIN.
     */
    this.realtimeService.emitConversationUpdatedToWorkspace(
      workspaceId,
      updatedConversation,
    );

    /*
     * Si estaba sin asignar y un ADMIN/OWNER
     * acaba de asignarla, debe desaparecer de
     * "Sin asignar" para todos los AGENT.
     */
    if (!previousAgentId) {
      this.realtimeService.emitConversationRemovedFromUnassigned(
        workspaceId,
        conversation.id,
      );
    }

    /*
     * Nuevo agente asignado.
     */
    this.realtimeService.emitConversationUpdatedToUser(
      agent.id,
      updatedConversation,
    );

    /*
     * Si hubo reasignación entre agentes,
     * quitamos la conversación de la bandeja
     * privada del agente anterior.
     */
    if (previousAgentId && previousAgentId !== agent.id) {
      this.realtimeService.emitConversationRemovedFromUser(
        previousAgentId,
        conversation.id,
      );
    }

    return updatedConversation;
  }

  async claim(workspaceId: string, conversationId: string, userId: string) {
    const agent = await this.prisma.user.findFirst({
      where: {
        id: userId,
        workspaceId,
        role: 'AGENT',
        status: 'ACTIVE',
      },
    });

    if (!agent) {
      throw new UnauthorizedException('Agente no autorizado');
    }

    /*
     * El updateMany actúa como una toma atómica.
     *
     * Solo puede actualizar si la conversación
     * todavía tiene assignedAgentId = null.
     *
     * Si dos agentes pulsan "Tomar" al mismo
     * tiempo, solo uno obtiene count = 1.
     */
    const claimed = await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,
        workspaceId,
        assignedAgentId: null,
        status: {
          in: ['OPEN', 'PENDING'],
        },
      },
      data: {
        assignedAgentId: agent.id,
        updatedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          workspaceId,
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
      if (conversation.assignedAgentId === agent.id) {
        return this.findOneForWorkspace(workspaceId, conversationId, {
          userId: agent.id,
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
        assignedAgentId: agent.id,
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

    if (!updatedConversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    /*
     * OWNER / ADMIN reciben la actualización
     * normal del Workspace.
     */
    this.realtimeService.emitConversationUpdatedToWorkspace(
      workspaceId,
      updatedConversation,
    );

    /*
     * Ya dejó de estar sin asignar.
     *
     * Todos los agentes deben quitarla
     * de su bandeja "Sin asignar".
     */
    this.realtimeService.emitConversationRemovedFromUnassigned(
      workspaceId,
      conversationId,
    );

    /*
     * El agente que consiguió tomarla
     * la recibe en su room privada.
     */
    this.realtimeService.emitConversationUpdatedToUser(
      agent.id,
      updatedConversation,
    );

    return updatedConversation;
  }

  async close(workspaceId: string, conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException('La conversación ya está cerrada');
    }

    const agent = await this.prisma.user.findFirst({
      where: {
        id: userId,
        workspaceId,
        role: 'AGENT',
        status: 'ACTIVE',
      },
    });

    if (!agent) {
      throw new BadRequestException('Agente no válido');
    }

    if (conversation.assignedAgentId !== agent.id) {
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

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
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
     * OWNER / ADMIN / PLATFORM_ADMIN.
     */
    this.realtimeService.emitConversationUpdatedToWorkspace(
      conversation.workspaceId,
      conversation,
    );

    /*
     * Si está asignada:
     * actualizamos la bandeja privada
     * del agente correspondiente.
     *
     * Si NO está asignada:
     * actualizamos la bandeja compartida
     * de conversaciones sin asignar.
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
