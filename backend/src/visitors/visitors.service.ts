import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';

type VisitorTokenPayload = {
  sub: string;
  type: string;
  workspaceId: string;
  siteId?: string;
};

@Injectable()
export class VisitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeSiteSlug(siteSlug: string | undefined) {
    const normalized = siteSlug?.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException('Debes indicar la página');
    }

    return normalized;
  }

  private async getActiveSite(workspaceId: string, siteSlug: string) {
    const site = await this.prisma.site.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: siteSlug,
        },
      },
    });

    if (!site || site.status !== 'ACTIVE') {
      throw new NotFoundException('Página no disponible');
    }

    return site;
  }

  async getConfig(workspaceSlug: string, siteSlug: string | undefined) {
    const normalizedSiteSlug = this.normalizeSiteSlug(siteSlug);

    const workspace = await this.prisma.workspace.findUnique({
      where: {
        slug: workspaceSlug.trim().toLowerCase(),
      },

      select: {
        id: true,
        status: true,
        widgetEnabled: true,
        widgetTitle: true,
        widgetSubtitle: true,
        widgetWelcomeMessage: true,
        widgetPosition: true,
      },
    });

    if (
      !workspace ||
      workspace.status !== 'ACTIVE' ||
      !workspace.widgetEnabled
    ) {
      throw new NotFoundException('Widget no disponible');
    }

    const site = await this.getActiveSite(workspace.id, normalizedSiteSlug);

    return {
      title: workspace.widgetTitle,

      subtitle: workspace.widgetSubtitle,

      welcomeMessage: workspace.widgetWelcomeMessage,

      position: workspace.widgetPosition,

      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
      },
    };
  }

  async create(workspaceSlug: string, siteSlug: string | undefined) {
    const normalizedSiteSlug = this.normalizeSiteSlug(siteSlug);

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

    if (!workspace.widgetEnabled) {
      throw new NotFoundException('Widget no disponible');
    }

    const site = await this.getActiveSite(workspace.id, normalizedSiteSlug);

    const visitor = await this.prisma.visitor.create({
      data: {
        workspaceId: workspace.id,
        siteId: site.id,
      },
    });

    const visitorToken = await this.jwtService.signAsync(
      {
        sub: visitor.id,
        type: 'VISITOR',
        workspaceId: workspace.id,
        siteId: site.id,
      },
      {
        expiresIn: '30d',
      },
    );

    return {
      visitorId: visitor.id,

      visitorToken,

      visitor: {
        id: visitor.id,

        workspaceId: visitor.workspaceId,

        siteId: visitor.siteId,

        createdAt: visitor.createdAt,

        updatedAt: visitor.updatedAt,

        lastSeenAt: visitor.lastSeenAt,
      },
    };
  }

  async verifyVisitorToken(token: string | undefined, workspaceId: string) {
    if (!token) {
      throw new UnauthorizedException('Token de visitante no proporcionado');
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

    if (!cleanToken) {
      throw new UnauthorizedException('Token de visitante no proporcionado');
    }

    let payload: VisitorTokenPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<VisitorTokenPayload>(cleanToken);
    } catch {
      throw new UnauthorizedException('Token de visitante inválido o expirado');
    }

    if (payload.type !== 'VISITOR') {
      throw new UnauthorizedException('Token de visitante inválido');
    }

    if (payload.workspaceId !== workspaceId) {
      throw new UnauthorizedException('El token no pertenece a este workspace');
    }

    const visitor = await this.prisma.visitor.findFirst({
      where: {
        id: payload.sub,
        workspaceId,
      },
    });

    if (!visitor) {
      throw new UnauthorizedException('Visitor no válido');
    }

    if (!visitor.siteId) {
      throw new UnauthorizedException('Visitor sin página asignada');
    }

    /*
     * Tokens nuevos incluyen siteId.
     *
     * Los tokens antiguos creados antes
     * de la migración pueden no incluirlo;
     * en ese caso la DB sigue siendo
     * la fuente autoritativa.
     */
    if (payload.siteId && payload.siteId !== visitor.siteId) {
      throw new UnauthorizedException('El token no pertenece a esta página');
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: visitor.siteId,
        workspaceId,
        status: 'ACTIVE',
      },
    });

    if (!site) {
      throw new UnauthorizedException(
        'La página del visitante no está disponible',
      );
    }

    return visitor;
  }
}
