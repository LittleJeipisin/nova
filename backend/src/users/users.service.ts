import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type WorkspaceRequester = {
  userId: string;
  role: string;
  workspaceId: string | null;
  ownerType?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOwner(workspaceId: string, username: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        workspaceId_username: {
          workspaceId,
          username,
        },
      },
    });

    if (existingUser) {
      throw new Error('Username already exists in this workspace');
    }

    const password = randomBytes(6).toString('base64url');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'OWNER',
        workspaceId,
      },
    });

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      workspaceId: user.workspaceId,
      siteId: user.siteId,
      password,
    };
  }

  async createTemporaryOwner(
    workspaceId: string,
    username: string,
    expiresAt: Date,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (expiresAt <= new Date()) {
      throw new ForbiddenException(
        'Temporary owner expiration date must be in the future',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        workspaceId_username: {
          workspaceId,
          username,
        },
      },
    });

    if (existingUser) {
      throw new Error('Username already exists in this workspace');
    }

    const password = randomBytes(6).toString('base64url');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'OWNER',
        ownerType: 'TEMPORARY',
        expiresAt,
        workspaceId,
      },
    });

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      ownerType: user.ownerType,
      workspaceId: user.workspaceId,
      siteId: user.siteId,
      expiresAt: user.expiresAt,
      password,
    };
  }

  async createAdmin(
    workspaceId: string,
    username: string,
    siteId: string,
    requester: WorkspaceRequester,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (requester.role === 'OWNER' && requester.ownerType === 'TEMPORARY') {
      throw new ForbiddenException('Temporary owners cannot create admins');
    }

    if (!siteId) {
      throw new BadRequestException('Debes seleccionar una página');
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        workspaceId,
        status: 'ACTIVE',
      },
    });

    if (!site) {
      throw new NotFoundException('Página no encontrada o inactiva');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        workspaceId_username: {
          workspaceId,
          username,
        },
      },
    });

    if (existingUser) {
      throw new Error('Username already exists in this workspace');
    }

    const password = randomBytes(6).toString('base64url');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'ADMIN',
        workspaceId,
        siteId: site.id,
      },
    });

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      workspaceId: user.workspaceId,
      siteId: user.siteId,
      password,
    };
  }

  async createAgent(
    workspaceId: string,
    username: string,
    requester: WorkspaceRequester,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const admin = await this.prisma.user.findFirst({
      where: {
        id: requester.userId,
        workspaceId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    if (!admin || !admin.siteId) {
      throw new ForbiddenException(
        'El administrador no tiene una página asignada',
      );
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: admin.siteId,
        workspaceId,
        status: 'ACTIVE',
      },
    });

    if (!site) {
      throw new ForbiddenException(
        'La página del administrador no está disponible',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        workspaceId_username: {
          workspaceId,
          username,
        },
      },
    });

    if (existingUser) {
      throw new Error('Username already exists in this workspace');
    }

    const password = randomBytes(6).toString('base64url');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'AGENT',
        workspaceId,
        siteId: admin.siteId,
      },
    });

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      workspaceId: user.workspaceId,
      siteId: user.siteId,
      password,
    };
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

    const where: {
      workspaceId: string;
      siteId?: string;
    } = {
      workspaceId,
    };

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

      where.siteId = admin.siteId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        ownerType: true,
        expiresAt: true,
        workspaceId: true,
        siteId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOne(
    workspaceId: string,
    userId: string,
    requester: WorkspaceRequester,
  ) {
    const where: {
      id: string;
      workspaceId: string;
      siteId?: string;
    } = {
      id: userId,
      workspaceId,
    };

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

      where.siteId = admin.siteId;
    }

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        ownerType: true,
        expiresAt: true,
        workspaceId: true,
        siteId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deactivate(
    workspaceId: string,
    userId: string,
    requester: WorkspaceRequester,
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        workspaceId,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.id === requester.userId) {
      throw new ForbiddenException('You cannot deactivate yourself');
    }

    if (requester.role === 'PLATFORM_ADMIN') {
      return this.prisma.user.update({
        where: {
          id: targetUser.id,
        },
        data: {
          status: 'INACTIVE',
        },
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          ownerType: true,
          expiresAt: true,
          workspaceId: true,
          siteId: true,
        },
      });
    }

    if (requester.role === 'OWNER' && requester.ownerType === 'TEMPORARY') {
      throw new ForbiddenException('Temporary owners cannot manage users');
    }

    if (requester.role === 'OWNER') {
      if (targetUser.role !== 'ADMIN' && targetUser.role !== 'AGENT') {
        throw new ForbiddenException(
          'Owners can only manage admins and agents',
        );
      }
    }

    if (requester.role === 'ADMIN') {
      if (targetUser.role !== 'AGENT') {
        throw new ForbiddenException('Admins can only manage agents');
      }

      const admin = await this.prisma.user.findFirst({
        where: {
          id: requester.userId,
          workspaceId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (!admin?.siteId || targetUser.siteId !== admin.siteId) {
        throw new ForbiddenException(
          'Admins can only manage agents from their site',
        );
      }
    }

    return this.prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        status: 'INACTIVE',
      },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        ownerType: true,
        expiresAt: true,
        workspaceId: true,
        siteId: true,
      },
    });
  }

  async activate(
    workspaceId: string,
    userId: string,
    requester: WorkspaceRequester,
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        workspaceId,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.id === requester.userId) {
      throw new ForbiddenException('You cannot activate yourself');
    }

    if (requester.role === 'PLATFORM_ADMIN') {
      return this.prisma.user.update({
        where: {
          id: targetUser.id,
        },
        data: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          ownerType: true,
          expiresAt: true,
          workspaceId: true,
          siteId: true,
        },
      });
    }

    if (requester.role === 'OWNER' && requester.ownerType === 'TEMPORARY') {
      throw new ForbiddenException('Temporary owners cannot manage users');
    }

    if (requester.role === 'OWNER') {
      if (targetUser.role !== 'ADMIN' && targetUser.role !== 'AGENT') {
        throw new ForbiddenException(
          'Owners can only manage admins and agents',
        );
      }
    }

    if (requester.role === 'ADMIN') {
      if (targetUser.role !== 'AGENT') {
        throw new ForbiddenException('Admins can only manage agents');
      }

      const admin = await this.prisma.user.findFirst({
        where: {
          id: requester.userId,
          workspaceId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (!admin?.siteId || targetUser.siteId !== admin.siteId) {
        throw new ForbiddenException(
          'Admins can only manage agents from their site',
        );
      }
    }

    return this.prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        ownerType: true,
        expiresAt: true,
        workspaceId: true,
        siteId: true,
      },
    });
  }
}
