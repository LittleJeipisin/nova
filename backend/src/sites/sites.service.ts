import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

type WorkspaceRequester = {
  userId: string;
  role: string;
  workspaceId: string | null;
  ownerType?: string | null;
};

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private ensureCanManageSites(requester: WorkspaceRequester) {
    if (requester.role === 'OWNER' && requester.ownerType === 'TEMPORARY') {
      throw new ForbiddenException('Temporary owners cannot manage sites');
    }
  }

  async create(
    workspaceId: string,
    name: string,
    slug: string | undefined,
    domain: string | undefined,
    requester: WorkspaceRequester,
  ) {
    this.ensureCanManageSites(requester);

    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const cleanName = name?.trim();

    if (!cleanName) {
      throw new BadRequestException('El nombre de la página es obligatorio');
    }

    const cleanSlug = this.normalizeSlug(slug?.trim() || cleanName);

    if (!cleanSlug) {
      throw new BadRequestException('El slug de la página no es válido');
    }

    const existingSite = await this.prisma.site.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: cleanSlug,
        },
      },
    });

    if (existingSite) {
      throw new ConflictException('Ya existe una página con ese slug');
    }

    const cleanDomain = domain?.trim() || null;

    return this.prisma.site.create({
      data: {
        workspaceId,
        name: cleanName,
        slug: cleanSlug,
        domain: cleanDomain,
        status: 'ACTIVE',
      },
    });
  }

  async findAll(workspaceId: string, requester: WorkspaceRequester) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (requester.role === 'ADMIN') {
      const admin = await this.prisma.user.findFirst({
        where: {
          id: requester.userId,
          workspaceId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (!admin?.siteId) {
        throw new ForbiddenException(
          'El administrador no tiene una página asignada',
        );
      }

      return this.prisma.site.findMany({
        where: {
          workspaceId,
          id: admin.siteId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    }

    return this.prisma.site.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOne(
    workspaceId: string,
    siteId: string,
    requester: WorkspaceRequester,
  ) {
    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        workspaceId,
      },
    });

    if (!site) {
      throw new NotFoundException('Página no encontrada');
    }

    if (requester.role === 'ADMIN') {
      const admin = await this.prisma.user.findFirst({
        where: {
          id: requester.userId,
          workspaceId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (!admin?.siteId || admin.siteId !== site.id) {
        throw new ForbiddenException('No tienes acceso a esta página');
      }
    }

    return site;
  }

  async deactivate(
    workspaceId: string,
    siteId: string,
    requester: WorkspaceRequester,
  ) {
    this.ensureCanManageSites(requester);

    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        workspaceId,
      },
    });

    if (!site) {
      throw new NotFoundException('Página no encontrada');
    }

    return this.prisma.site.update({
      where: {
        id: site.id,
      },
      data: {
        status: 'INACTIVE',
      },
    });
  }

  async activate(
    workspaceId: string,
    siteId: string,
    requester: WorkspaceRequester,
  ) {
    this.ensureCanManageSites(requester);

    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        workspaceId,
      },
    });

    if (!site) {
      throw new NotFoundException('Página no encontrada');
    }

    return this.prisma.site.update({
      where: {
        id: site.id,
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }
}
