import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';

import { JwtService } from '@nestjs/jwt';

import {
  Server,
  Socket,
} from 'socket.io';

import { PrismaService } from '../prisma/prisma.service';
import { VisitorsService } from '../visitors/visitors.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly visitorsService: VisitorsService,
  ) {}

  /*
   * =========================================================
   * VISITOR
   * =========================================================
   *
   * El Visitor ya NO envía visitorId.
   *
   * Su identidad se obtiene exclusivamente desde
   * visitorToken, firmado con VISITOR_JWT_SECRET.
   */
  @SubscribeMessage('conversation:join:visitor')
  async joinVisitorConversation(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    data: {
      workspaceSlug: string;
      conversationId: string;
    },
  ) {
    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          slug: data.workspaceSlug
            .trim()
            .toLowerCase(),
        },
      });

    if (!workspace) {
      throw new WsException(
        'Workspace no encontrado',
      );
    }

    if (
      workspace.status !== 'ACTIVE'
    ) {
      throw new WsException(
        'El workspace está inactivo',
      );
    }

    const visitorToken =
      this.getVisitorSocketToken(
        client,
      );

    let visitor;

    try {
      visitor =
        await this.visitorsService
          .verifyVisitorToken(
            visitorToken,
            workspace.id,
          );
    } catch (error: any) {
      throw new WsException(
        error?.message ||
          'Token de visitante inválido',
      );
    }

    /*
     * Además de validar el token,
     * comprobamos que la conversación
     * pertenece realmente a ese Visitor.
     */
    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: data.conversationId,

          workspaceId:
            workspace.id,

          visitorId:
            visitor.id,

          status: {
            in: [
              'OPEN',
              'PENDING',
            ],
          },
        },
      });

    if (!conversation) {
      throw new WsException(
        'Conversación no encontrada o no autorizada',
      );
    }

    await client.join(
      `conversation:${conversation.id}`,
    );

    await this.prisma.visitor.update({
      where: {
        id: visitor.id,
      },

      data: {
        lastSeenAt: new Date(),
      },
    });

    return {
      event:
        'conversation:joined',

      data: {
        conversationId:
          conversation.id,
      },
    };
  }

  /*
   * =========================================================
   * AGENT → CONVERSACIÓN
   * =========================================================
   */
  @SubscribeMessage('conversation:join:agent')
  async joinAgentConversation(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    data: {
      workspaceId: string;
      conversationId: string;
    },
  ) {
    const user =
      await this.getAuthenticatedUser(
        client,
      );

    if (user.role !== 'AGENT') {
      throw new WsException(
        'Rol no autorizado',
      );
    }

    if (
      user.workspaceId !==
      data.workspaceId
    ) {
      throw new WsException(
        'No tienes acceso a este workspace',
      );
    }

    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id:
            data.conversationId,

          workspaceId:
            data.workspaceId,

          assignedAgentId:
            user.id,

          status: {
            in: [
              'OPEN',
              'PENDING',
            ],
          },
        },
      });

    if (!conversation) {
      throw new WsException(
        'Conversación no encontrada o no autorizada',
      );
    }

    await client.join(
      `conversation:${conversation.id}`,
    );

    return {
      event:
        'conversation:joined',

      data: {
        conversationId:
          conversation.id,

        role:
          'AGENT',
      },
    };
  }

  /*
   * =========================================================
   * WORKSPACE / BANDEJAS
   * =========================================================
   */
  @SubscribeMessage('workspace:join')
  async joinWorkspace(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    data: {
      workspaceId: string;
    },
  ) {
    const user =
      await this.getAuthenticatedUser(
        client,
      );

    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          id: data.workspaceId,
        },
      });

    if (!workspace) {
      throw new WsException(
        'Workspace no encontrado',
      );
    }

    /*
     * PLATFORM_ADMIN puede entrar a
     * cualquier Workspace.
     */
    if (
      user.role ===
      'PLATFORM_ADMIN'
    ) {
      await client.join(
        `workspace:${workspace.id}`,
      );

      return {
        event:
          'workspace:joined',

        data: {
          workspaceId:
            workspace.id,

          room:
            `workspace:${workspace.id}`,

          role:
            user.role,
        },
      };
    }

    /*
     * OWNER / ADMIN / AGENT solamente
     * pueden usar su propio Workspace.
     */
    if (
      user.workspaceId !==
      workspace.id
    ) {
      throw new WsException(
        'No tienes acceso a este workspace',
      );
    }

    if (
      workspace.status !== 'ACTIVE'
    ) {
      throw new WsException(
        'El workspace está inactivo',
      );
    }

    /*
     * AGENT NO entra a la room general.
     *
     * Cada Agent tiene su propia room,
     * evitando recibir conversaciones
     * asignadas a otros agentes.
     */
    if (user.role === 'AGENT') {
      await client.join(
        `user:${user.id}`,
      );

      return {
        event:
          'workspace:joined',

        data: {
          workspaceId:
            workspace.id,

          room:
            `user:${user.id}`,

          role:
            user.role,
        },
      };
    }

    /*
     * OWNER y ADMIN sí reciben la
     * bandeja general del Workspace.
     */
    if (
      user.role === 'OWNER' ||
      user.role === 'ADMIN'
    ) {
      await client.join(
        `workspace:${workspace.id}`,
      );

      return {
        event:
          'workspace:joined',

        data: {
          workspaceId:
            workspace.id,

          room:
            `workspace:${workspace.id}`,

          role:
            user.role,
        },
      };
    }

    throw new WsException(
      'Rol no autorizado',
    );
  }

  /*
   * =========================================================
   * AUTENTICACIÓN DE USUARIOS INTERNOS
   * =========================================================
   *
   * AGENT / ADMIN / OWNER / PLATFORM_ADMIN
   * usan JWT_SECRET.
   */
  private async getAuthenticatedUser(
    client: Socket,
  ) {
    const token =
      this.getSocketToken(
        client,
      );

    if (!token) {
      throw new WsException(
        'Token no proporcionado',
      );
    }

    let payload: {
      sub: string;
    };

    try {
      payload =
        await this.jwtService
          .verifyAsync<{
            sub: string;
          }>(
            token,
          );
    } catch {
      throw new WsException(
        'Token inválido o expirado',
      );
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: payload.sub,
        },

        include: {
          workspace: true,
        },
      });

    if (!user) {
      throw new WsException(
        'Usuario no encontrado',
      );
    }

    if (
      user.status !== 'ACTIVE'
    ) {
      throw new WsException(
        'Usuario inactivo',
      );
    }

    if (
      user.mustChangePassword
    ) {
      throw new WsException(
        'Debes cambiar tu contraseña antes de continuar',
      );
    }

    /*
     * PLATFORM_ADMIN no pertenece
     * a ningún Workspace.
     */
    if (
      user.role !==
      'PLATFORM_ADMIN'
    ) {
      if (!user.workspace) {
        throw new WsException(
          'Usuario sin workspace',
        );
      }

      if (
        user.workspace.status !==
        'ACTIVE'
      ) {
        throw new WsException(
          'El workspace está inactivo',
        );
      }
    }

    /*
     * OWNER temporal.
     */
    if (
      user.role === 'OWNER' &&
      user.ownerType ===
        'TEMPORARY'
    ) {
      if (!user.expiresAt) {
        throw new WsException(
          'Owner temporal sin fecha de expiración',
        );
      }

      if (
        user.expiresAt.getTime() <=
        Date.now()
      ) {
        throw new WsException(
          'El acceso temporal ha expirado',
        );
      }
    }

    return user;
  }

  /*
   * =========================================================
   * TOKEN DEL VISITOR
   * =========================================================
   *
   * Se envía mediante:
   *
   * socket.auth.visitorToken
   */
  private getVisitorSocketToken(
    client: Socket,
  ): string | undefined {
    const visitorToken =
      client.handshake.auth
        ?.visitorToken;

    if (
      typeof visitorToken ===
        'string' &&
      visitorToken.trim()
    ) {
      return visitorToken
        .replace(
          /^Bearer\s+/i,
          '',
        )
        .trim();
    }

    return undefined;
  }

  /*
   * =========================================================
   * TOKEN DE USUARIOS INTERNOS
   * =========================================================
   *
   * Normalmente:
   *
   * socket.auth.token
   */
  private getSocketToken(
    client: Socket,
  ): string | null {
    const authToken =
      client.handshake.auth
        ?.token;

    if (
      typeof authToken ===
        'string' &&
      authToken.trim()
    ) {
      return authToken
        .replace(
          /^Bearer\s+/i,
          '',
        )
        .trim();
    }

    /*
     * También permitimos Authorization
     * en los headers del handshake.
     */
    const authorization =
      client.handshake.headers
        .authorization;

    if (
      typeof authorization ===
        'string'
    ) {
      return authorization
        .replace(
          /^Bearer\s+/i,
          '',
        )
        .trim();
    }

    return null;
  }

  /*
   * =========================================================
   * EMISIONES
   * =========================================================
   */

  emitToConversation(
    conversationId: string,
    event: string,
    data: unknown,
  ) {
    this.server
      .to(
        `conversation:${conversationId}`,
      )
      .emit(
        event,
        data,
      );
  }

  emitToWorkspace(
    workspaceId: string,
    event: string,
    data: unknown,
  ) {
    this.server
      .to(
        `workspace:${workspaceId}`,
      )
      .emit(
        event,
        data,
      );
  }

  emitToUser(
    userId: string,
    event: string,
    data: unknown,
  ) {
    this.server
      .to(
        `user:${userId}`,
      )
      .emit(
        event,
        data,
      );
  }
}