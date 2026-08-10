import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOwner(
    workspaceId: string,
    username: string,
  ) {
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
      throw new Error(
        'Username already exists in this workspace',
      );
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
      throw new Error(
        'Username already exists in this workspace',
      );
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
      expiresAt: user.expiresAt,
      password,
    };
  }

  async createAdmin(
    workspaceId: string,
    username: string,
    requester: {
      userId: string;
      role: string;
      workspaceId: string | null;
      ownerType?: string | null;
    },
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (
      requester.role === 'OWNER' &&
      requester.ownerType === 'TEMPORARY'
    ) {
      throw new ForbiddenException(
        'Temporary owners cannot create admins',
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
      throw new Error(
        'Username already exists in this workspace',
      );
    }

    const password = randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'ADMIN',
        workspaceId,
      },
    });

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      workspaceId: user.workspaceId,
      password,
    };
  }

  async createAgent(
    workspaceId: string,
    username: string,
  ) {
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
      throw new Error(
        'Username already exists in this workspace',
      );
    }

    const password = randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'AGENT',
        workspaceId,
      },
    });

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      workspaceId: user.workspaceId,
      password,
    };
  }

  async findAll(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return this.prisma.user.findMany({
      where: {
        workspaceId,
      },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        ownerType: true,
        expiresAt: true,
        workspaceId: true,
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
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        workspaceId,
      },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        ownerType: true,
        expiresAt: true,
        workspaceId: true,
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
    requester: {
      userId: string;
      role: string;
      workspaceId: string | null;
      ownerType?: string | null;
    },
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
      throw new ForbiddenException(
        'You cannot deactivate yourself',
      );
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
        },
      });
    }

    if (
      requester.role === 'OWNER' &&
      requester.ownerType === 'TEMPORARY'
    ) {
      throw new ForbiddenException(
        'Temporary owners cannot manage users',
      );
    }

    if (requester.role === 'OWNER') {
      if (
        targetUser.role !== 'ADMIN' &&
        targetUser.role !== 'AGENT'
      ) {
        throw new ForbiddenException(
          'Owners can only manage admins and agents',
        );
      }
    }

    if (requester.role === 'ADMIN') {
      if (targetUser.role !== 'AGENT') {
        throw new ForbiddenException(
          'Admins can only manage agents',
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
      },
    });
  }

  async activate(
    workspaceId: string,
    userId: string,
    requester: {
      userId: string;
      role: string;
      workspaceId: string | null;
      ownerType?: string | null;
    },
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
      throw new ForbiddenException(
        'You cannot activate yourself',
      );
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
        },
      });
    }

    if (
      requester.role === 'OWNER' &&
      requester.ownerType === 'TEMPORARY'
    ) {
      throw new ForbiddenException(
        'Temporary owners cannot manage users',
      );
    }

    if (requester.role === 'OWNER') {
      if (
        targetUser.role !== 'ADMIN' &&
        targetUser.role !== 'AGENT'
      ) {
        throw new ForbiddenException(
          'Owners can only manage admins and agents',
        );
      }
    }

    if (requester.role === 'ADMIN') {
      if (targetUser.role !== 'AGENT') {
        throw new ForbiddenException(
          'Admins can only manage agents',
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
      },
    });
  }
}
