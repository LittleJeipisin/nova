import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';

import { JwtService } from '@nestjs/jwt';

import { Server, Socket } from 'socket.io';

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
   * El Visitor entra realmente en:
   *
   * conversation:{conversationId}
   *
   * Esta room queda reservada para el Visitor.
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
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        slug: data.workspaceSlug.trim().toLowerCase(),
      },
    });

    if (!workspace) {
      throw new WsException('Workspace no encontrado');
    }

    if (workspace.status !== 'ACTIVE') {
      throw new WsException('El workspace está inactivo');
    }

    const visitorToken = this.getVisitorSocketToken(client);

    let verifiedVisitor: unknown;

    try {
      verifiedVisitor = await this.visitorsService.verifyVisitorToken(
        visitorToken,
        workspace.id,
      );
    } catch (error: unknown) {
      throw new WsException(
        this.getErrorMessage(error, 'Token de visitante inválido'),
      );
    }

    const visitorId = this.getVerifiedVisitorId(verifiedVisitor);

    /*
     * No confiamos en que el token por sí solo
     * nos entregue la página actual.
     *
     * Volvemos a DB para comprobar:
     *
     * - mismo Workspace;
     * - siteId presente;
     * - Site ACTIVE.
     */
    const visitor = await this.prisma.visitor.findFirst({
      where: {
        id: visitorId,
        workspaceId: workspace.id,
      },

      select: {
        id: true,
        siteId: true,
      },
    });

    if (!visitor || !visitor.siteId) {
      throw new WsException('Visitante sin página asignada');
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: visitor.siteId,
        workspaceId: workspace.id,
        status: 'ACTIVE',
      },
    });

    if (!site) {
      throw new WsException('La página no está disponible');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: data.conversationId,

        workspaceId: workspace.id,

        siteId: site.id,

        visitorId: visitor.id,

        status: {
          in: ['OPEN', 'PENDING'],
        },
      },
    });

    if (!conversation) {
      throw new WsException('Conversación no encontrada o no autorizada');
    }

    /*
     * Solo el Visitor entra realmente
     * en la room de conversación.
     */
    await client.join(`conversation:${conversation.id}`);

    await this.prisma.visitor.update({
      where: {
        id: visitor.id,
      },

      data: {
        lastSeenAt: new Date(),
      },
    });

    return {
      event: 'conversation:joined',

      data: {
        conversationId: conversation.id,
      },
    };
  }

  /*
   * =========================================================
   * AGENT -> CONVERSACIÓN
   * =========================================================
   *
   * El AGENT NO entra en:
   *
   * conversation:{conversationId}
   *
   * Los mensajes internos se distribuyen por:
   *
   * user:{userId}
   * site:{siteId}:unassigned
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
    const user = await this.getAuthenticatedUser(client);

    if (user.role !== 'AGENT') {
      throw new WsException('Rol no autorizado');
    }

    if (user.workspaceId !== data.workspaceId) {
      throw new WsException('No tienes acceso a este workspace');
    }

    if (!user.siteId) {
      throw new WsException('Agente sin página asignada');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: data.conversationId,

        workspaceId: data.workspaceId,

        siteId: user.siteId,

        OR: [
          {
            assignedAgentId: null,
          },
          {
            assignedAgentId: user.id,
          },
        ],

        status: {
          in: ['OPEN', 'PENDING'],
        },
      },
    });

    if (!conversation) {
      throw new WsException('Conversación no encontrada o no autorizada');
    }

    /*
     * NO hacemos join a conversation:{id}.
     *
     * Así un Agent no conserva acceso
     * realtime después de una toma o
     * reasignación.
     */
    return {
      event: 'conversation:joined',

      data: {
        conversationId: conversation.id,

        role: 'AGENT',
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
    const user = await this.getAuthenticatedUser(client);

    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: data.workspaceId,
      },
    });

    if (!workspace) {
      throw new WsException('Workspace no encontrado');
    }

    /*
     * PLATFORM_ADMIN puede entrar
     * a cualquier Workspace.
     */
    if (user.role === 'PLATFORM_ADMIN') {
      const room = `workspace:${workspace.id}`;

      await client.join(room);

      return {
        event: 'workspace:joined',

        data: {
          workspaceId: workspace.id,

          room,

          role: user.role,
        },
      };
    }

    /*
     * OWNER / ADMIN / AGENT solamente
     * pueden usar su propio Workspace.
     */
    if (user.workspaceId !== workspace.id) {
      throw new WsException('No tienes acceso a este workspace');
    }

    if (workspace.status !== 'ACTIVE') {
      throw new WsException('El workspace está inactivo');
    }

    /*
     * OWNER:
     *
     * workspace:{workspaceId}
     *
     * Recibe todas las páginas de
     * su empresa.
     */
    if (user.role === 'OWNER') {
      const room = `workspace:${workspace.id}`;

      await client.join(room);

      return {
        event: 'workspace:joined',

        data: {
          workspaceId: workspace.id,

          room,

          role: user.role,
        },
      };
    }

    /*
     * ADMIN:
     *
     * site:{siteId}
     *
     * Nunca entra en la room general
     * del Workspace.
     */
    if (user.role === 'ADMIN') {
      if (!user.siteId) {
        throw new WsException('Administrador sin página asignada');
      }

      const room = `site:${user.siteId}`;

      await client.join(room);

      return {
        event: 'workspace:joined',

        data: {
          workspaceId: workspace.id,

          siteId: user.siteId,

          room,

          role: user.role,
        },
      };
    }

    /*
     * AGENT entra en DOS rooms:
     *
     * user:{userId}
     *   conversaciones asignadas a él.
     *
     * site:{siteId}:unassigned
     *   conversaciones sin asignar
     *   solamente de su página.
     *
     * Nunca entra en:
     *
     * workspace:{workspaceId}
     * site:{siteId}
     */
    if (user.role === 'AGENT') {
      if (!user.siteId) {
        throw new WsException('Agente sin página asignada');
      }

      const userRoom = `user:${user.id}`;

      const unassignedRoom = `site:${user.siteId}:unassigned`;

      await client.join(userRoom);

      await client.join(unassignedRoom);

      return {
        event: 'workspace:joined',

        data: {
          workspaceId: workspace.id,

          siteId: user.siteId,

          room: userRoom,

          unassignedRoom,

          role: user.role,
        },
      };
    }

    throw new WsException('Rol no autorizado');
  }

  /*
   * =========================================================
   * AUTENTICACIÓN DE USUARIOS INTERNOS
   * =========================================================
   */
  private async getAuthenticatedUser(client: Socket) {
    const token = this.getSocketToken(client);

    if (!token) {
      throw new WsException('Token no proporcionado');
    }

    let payload: {
      sub: string;
    };

    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
      }>(token);
    } catch {
      throw new WsException('Token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },

      include: {
        workspace: true,
        site: true,
      },
    });

    if (!user) {
      throw new WsException('Usuario no encontrado');
    }

    if (user.status !== 'ACTIVE') {
      throw new WsException('Usuario inactivo');
    }

    if (user.mustChangePassword) {
      throw new WsException('Debes cambiar tu contraseña antes de continuar');
    }

    /*
     * PLATFORM_ADMIN no pertenece
     * a un Workspace.
     */
    if (user.role !== 'PLATFORM_ADMIN') {
      if (!user.workspace) {
        throw new WsException('Usuario sin workspace');
      }

      if (user.workspace.status !== 'ACTIVE') {
        throw new WsException('El workspace está inactivo');
      }
    }

    /*
     * ADMIN y AGENT deben pertenecer
     * a un Site activo del mismo Workspace.
     */
    if (user.role === 'ADMIN' || user.role === 'AGENT') {
      if (!user.siteId || !user.site) {
        throw new WsException('Usuario sin página asignada');
      }

      if (user.site.workspaceId !== user.workspaceId) {
        throw new WsException(
          'La página no pertenece al workspace del usuario',
        );
      }

      if (user.site.status !== 'ACTIVE') {
        throw new WsException('La página está inactiva');
      }
    }

    /*
     * OWNER temporal.
     */
    if (user.role === 'OWNER' && user.ownerType === 'TEMPORARY') {
      if (!user.expiresAt) {
        throw new WsException('Owner temporal sin fecha de expiración');
      }

      if (user.expiresAt.getTime() <= Date.now()) {
        throw new WsException('El acceso temporal ha expirado');
      }
    }

    return user;
  }

  /*
   * =========================================================
   * VISITOR VERIFICADO
   * =========================================================
   */
  private getVerifiedVisitorId(visitor: unknown): string {
    if (typeof visitor !== 'object' || visitor === null || !('id' in visitor)) {
      throw new WsException('Visitante inválido');
    }

    const id = visitor.id;

    if (typeof id !== 'string' || !id.trim()) {
      throw new WsException('Visitante inválido');
    }

    return id;
  }

  /*
   * =========================================================
   * TOKEN DEL VISITOR
   * =========================================================
   */
  private getVisitorSocketToken(client: Socket): string | undefined {
    const auth: unknown = client.handshake.auth;

    if (
      typeof auth !== 'object' ||
      auth === null ||
      !('visitorToken' in auth)
    ) {
      return undefined;
    }

    const visitorToken = auth.visitorToken;

    if (typeof visitorToken === 'string' && visitorToken.trim()) {
      return visitorToken.replace(/^Bearer\s+/i, '').trim();
    }

    return undefined;
  }

  /*
   * =========================================================
   * TOKEN DE USUARIOS INTERNOS
   * =========================================================
   */
  private getSocketToken(client: Socket): string | null {
    const auth: unknown = client.handshake.auth;

    if (typeof auth === 'object' && auth !== null && 'token' in auth) {
      const authToken = auth.token;

      if (typeof authToken === 'string' && authToken.trim()) {
        return authToken.replace(/^Bearer\s+/i, '').trim();
      }
    }

    const authorization = client.handshake.headers.authorization;

    if (typeof authorization === 'string') {
      return authorization.replace(/^Bearer\s+/i, '').trim();
    }

    return null;
  }

  private getErrorMessage(error: unknown, fallbackMessage: string) {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = error.message;

      if (typeof message === 'string') {
        return message;
      }
    }

    return fallbackMessage;
  }

  /*
   * =========================================================
   * EMISIONES
   * =========================================================
   */

  /*
   * Room exclusiva del Visitor.
   */
  emitToConversation(conversationId: string, event: string, data: unknown) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  /*
   * OWNER / PLATFORM_ADMIN.
   */
  emitToWorkspace(workspaceId: string, event: string, data: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
  }

  /*
   * ADMIN.
   */
  emitToSite(siteId: string, event: string, data: unknown) {
    this.server.to(`site:${siteId}`).emit(event, data);
  }

  /*
   * AGENT - conversaciones sin asignar
   * únicamente de su página.
   */
  emitToSiteUnassigned(siteId: string, event: string, data: unknown) {
    this.server.to(`site:${siteId}:unassigned`).emit(event, data);
  }

  /*
   * Alias seguro para código que todavía
   * utilice el nombre anterior.
   *
   * El argumento ahora representa siteId,
   * NO workspaceId.
   */
  emitToUnassigned(siteId: string, event: string, data: unknown) {
    this.emitToSiteUnassigned(siteId, event, data);
  }

  /*
   * AGENT privado.
   */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
