import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(name: string) {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return this.prisma.workspace.create({
      data: {
        name,
        slug,
      },
    });
  }

  async findAll() {
    const workspaces =
      await this.prisma.workspace.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

    return workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      userCount: workspace._count.users,
    }));
  }

  async findOne(workspaceId: string) {
    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace no encontrado',
      );
    }

    const usersByRole =
      await this.prisma.user.groupBy({
        by: ['role'],
        where: {
          workspaceId,
        },
        _count: {
          _all: true,
        },
      });

    let owners = 0;
    let admins = 0;
    let agents = 0;

    for (const group of usersByRole) {
      if (group.role === 'OWNER') {
        owners = group._count._all;
      }

      if (group.role === 'ADMIN') {
        admins = group._count._all;
      }

      if (group.role === 'AGENT') {
        agents = group._count._all;
      }
    }

    return {
      ...workspace,
      userCounts: {
        owners,
        admins,
        agents,
        total: owners + admins + agents,
      },
    };
  }

  async deactivate(workspaceId: string) {
    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace no encontrado',
      );
    }

  return this.prisma.workspace.update({
    where: {
      id: workspaceId,
    },
    data: {
      status: 'INACTIVE',
    },
  });
}

  async activate(workspaceId: string) {
    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace no encontrado',
      );
    }

    return this.prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  async update(
    workspaceId: string,
    name: string,
  ) {
    const cleanName = name?.trim();

    if (!cleanName) {
      throw new BadRequestException(
        'El nombre del workspace es obligatorio',
      );
    }

    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace no encontrado',
      );
    }

    const slug = cleanName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    if (!slug) {
      throw new BadRequestException(
        'El nombre no permite generar un slug válido',
      );
    }

    const existingWorkspace =
      await this.prisma.workspace.findFirst({
        where: {
          slug,
          id: {
            not: workspaceId,
          },
        },
      });

    if (existingWorkspace) {
      throw new ConflictException(
        'Ya existe un workspace con ese nombre',
      );
    }

    return this.prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        name: cleanName,
        slug,
      },
    });
  }
}