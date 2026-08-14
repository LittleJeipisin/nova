import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { VisitorsService } from '../visitors/visitors.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly visitorsService: VisitorsService,
  ) {}

  private async getVisitorContext(
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
      throw new ForbiddenException('El visitante no tiene una página asignada');
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: visitor.siteId,
        workspaceId: workspace.id,
        status: 'ACTIVE',
      },
    });

    if (!site) {
      throw new ForbiddenException(
        'La página del visitante no está disponible',
      );
    }

    return {
      workspace,
      visitor,
      site,
    };
  }

  private async getAgentContext(workspaceId: string, userId: string) {
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

    if (!agent.siteId) {
      throw new ForbiddenException('El agente no tiene una página asignada');
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: agent.siteId,
        workspaceId,
        status: 'ACTIVE',
      },
    });

    if (!site) {
      throw new ForbiddenException('La página del agente no está disponible');
    }

    return {
      agent,
      site,
    };
  }

  async getVisitorMessages(
    workspaceSlug: string,
    conversationId: string,
    visitorToken: string | undefined,
  ) {
    const { workspace, visitor, site } = await this.getVisitorContext(
      workspaceSlug,
      visitorToken,
    );

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId: workspace.id,
        siteId: site.id,
        visitorId: visitor.id,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    await this.prisma.visitor.update({
      where: {
        id: visitor.id,
      },

      data: {
        lastSeenAt: new Date(),
      },
    });

    return this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },

      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async createVisitorMessage(
    workspaceSlug: string,
    conversationId: string,
    visitorToken: string | undefined,
    content: string,
  ) {
    const cleanContent = content?.trim();

    if (!cleanContent) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }

    const { workspace, visitor, site } = await this.getVisitorContext(
      workspaceSlug,
      visitorToken,
    );

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId: workspace.id,
        siteId: site.id,
        visitorId: visitor.id,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException('La conversación está cerrada');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,

        senderType: 'VISITOR',

        senderVisitorId: visitor.id,

        type: 'TEXT',

        content: cleanContent,
      },
    });

    await this.prisma.conversation.update({
      where: {
        id: conversation.id,
      },

      data:
        conversation.status === 'PENDING'
          ? {
              status: 'OPEN',
              updatedAt: new Date(),
            }
          : {
              updatedAt: new Date(),
            },
    });

    await this.prisma.visitor.update({
      where: {
        id: visitor.id,
      },

      data: {
        lastSeenAt: new Date(),
      },
    });

    this.realtimeService.emitNewMessage(conversation.id, message);

    await this.emitConversationUpdated(conversation.id);

    return message;
  }

  async createAgentMessage(
    workspaceId: string,
    conversationId: string,
    userId: string,
    content: string,
  ) {
    const cleanContent = content?.trim();

    if (!cleanContent) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }

    const { agent, site } = await this.getAgentContext(workspaceId, userId);

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
        siteId: site.id,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException('La conversación está cerrada');
    }

    if (conversation.assignedAgentId !== agent.id) {
      throw new UnauthorizedException(
        'La conversación está asignada a otro agente',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,

        senderType: 'USER',

        senderUserId: agent.id,

        type: 'TEXT',

        content: cleanContent,
      },
    });

    await this.prisma.conversation.update({
      where: {
        id: conversation.id,
      },

      data: {
        updatedAt: new Date(),
      },
    });

    this.realtimeService.emitNewMessage(conversation.id, message);

    await this.emitConversationUpdated(conversation.id);

    return message;
  }

  async createVisitorImageMessage(
    workspaceSlug: string,
    conversationId: string,
    visitorToken: string | undefined,
    file: Express.Multer.File,
    content?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar una imagen');
    }

    const allowedTypes: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };

    const extension = allowedTypes[file.mimetype];

    if (!extension) {
      throw new BadRequestException('Tipo de imagen no permitido');
    }

    const { workspace, visitor, site } = await this.getVisitorContext(
      workspaceSlug,
      visitorToken,
    );

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId: workspace.id,
        siteId: site.id,
        visitorId: visitor.id,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException('La conversación está cerrada');
    }

    const filename = `${randomUUID()}${extension}`;

    const uploadDirectory = join(process.cwd(), 'uploads', 'messages');

    await fs.mkdir(uploadDirectory, {
      recursive: true,
    });

    const filePath = join(uploadDirectory, filename);

    await fs.writeFile(filePath, file.buffer);

    const mediaUrl = `/uploads/messages/${filename}`;

    const cleanContent = content?.trim() || null;

    try {
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,

          senderType: 'VISITOR',

          senderVisitorId: visitor.id,

          type: 'IMAGE',

          content: cleanContent,

          mediaUrl,
        },
      });

      await this.prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data:
          conversation.status === 'PENDING'
            ? {
                status: 'OPEN',
                updatedAt: new Date(),
              }
            : {
                updatedAt: new Date(),
              },
      });

      await this.prisma.visitor.update({
        where: {
          id: visitor.id,
        },

        data: {
          lastSeenAt: new Date(),
        },
      });

      this.realtimeService.emitNewMessage(conversation.id, message);

      await this.emitConversationUpdated(conversation.id);

      return message;
    } catch (error) {
      await fs.unlink(filePath).catch(() => {});

      throw error;
    }
  }

  async createAgentImageMessage(
    workspaceId: string,
    conversationId: string,
    userId: string,
    file: Express.Multer.File,
    content?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar una imagen');
    }

    const allowedTypes: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };

    const extension = allowedTypes[file.mimetype];

    if (!extension) {
      throw new BadRequestException('Tipo de imagen no permitido');
    }

    const { agent, site } = await this.getAgentContext(workspaceId, userId);

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
        siteId: site.id,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException('La conversación está cerrada');
    }

    if (conversation.assignedAgentId !== agent.id) {
      throw new UnauthorizedException(
        'La conversación está asignada a otro agente',
      );
    }

    const filename = `${randomUUID()}${extension}`;

    const uploadDirectory = join(process.cwd(), 'uploads', 'messages');

    await fs.mkdir(uploadDirectory, {
      recursive: true,
    });

    const filePath = join(uploadDirectory, filename);

    await fs.writeFile(filePath, file.buffer);

    const mediaUrl = `/uploads/messages/${filename}`;

    const cleanContent = content?.trim() || null;

    try {
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,

          senderType: 'USER',

          senderUserId: agent.id,

          type: 'IMAGE',

          content: cleanContent,

          mediaUrl,
        },
      });

      await this.prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          updatedAt: new Date(),
        },
      });

      this.realtimeService.emitNewMessage(conversation.id, message);

      await this.emitConversationUpdated(conversation.id);

      return message;
    } catch (error) {
      await fs.unlink(filePath).catch(() => {});

      throw error;
    }
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
     * RealtimeService ahora divide:
     *
     * OWNER / PLATFORM_ADMIN -> Workspace
     * ADMIN                  -> Site
     */
    this.realtimeService.emitConversationUpdatedToWorkspace(
      conversation.workspaceId,
      conversation,
    );

    /*
     * AGENT:
     *
     * asignada -> room privada
     * sin asignar -> room unassigned del Site
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
