import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

import type { User } from '../../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const ACCESS_TOKEN_SECONDS = 30 * 60;

const REFRESH_TOKEN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type RefreshUser = User & {
  workspace: {
    status: string;
  } | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    username: string,
    password: string,
    workspaceSlug?: string,
  ) {
    let user: User | null;

    /*
     * Si viene workspaceSlug, buscamos
     * exclusivamente dentro del Workspace.
     */
    if (workspaceSlug) {
      const normalizedWorkspaceSlug = workspaceSlug.trim().toLowerCase();

      const workspace = await this.prisma.workspace.findUnique({
        where: {
          slug: normalizedWorkspaceSlug,
        },
      });

      if (!workspace || workspace.status !== 'ACTIVE') {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      user = await this.prisma.user.findUnique({
        where: {
          workspaceId_username: {
            workspaceId: workspace.id,
            username,
          },
        },
      });

      /*
       * PLATFORM_ADMIN no inicia sesión
       * mediante Workspace.
       */
      if (!user || user.role === 'PLATFORM_ADMIN' || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Credenciales inválidas');
      }
    } else {
      /*
       * Sin workspaceSlug solamente
       * permitimos PLATFORM_ADMIN.
       */
      user = await this.prisma.user.findFirst({
        where: {
          username,
          role: 'PLATFORM_ADMIN',
          status: 'ACTIVE',
          workspaceId: null,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Credenciales inválidas');
      }
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.validateTemporaryOwner(user);

    return user;
  }

  async login(username: string, password: string, workspaceSlug?: string) {
    const user = await this.validateUser(username, password, workspaceSlug);

    const accessToken = await this.createAccessToken(user);

    const refreshToken = this.generateRefreshToken();

    const refreshExpiresAt = this.getRefreshExpiration(user);

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,

        tokenHash: this.hashRefreshToken(refreshToken),

        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }

  async refresh(refreshToken: string | undefined) {
    const cleanRefreshToken = refreshToken?.trim();

    if (!cleanRefreshToken) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    const now = new Date();

    const tokenHash = this.hashRefreshToken(cleanRefreshToken);

    const session = await this.prisma.refreshSession.findUnique({
      where: {
        tokenHash,
      },

      include: {
        user: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user: RefreshUser = session.user;

    this.validateRefreshUser(user);

    /*
     * Generamos el refresh nuevo antes
     * de revocar el anterior.
     */
    const newRefreshToken = this.generateRefreshToken();

    const newRefreshTokenHash = this.hashRefreshToken(newRefreshToken);

    const newRefreshExpiresAt = this.getRefreshExpiration(user);

    /*
     * Rotación atómica.
     *
     * El refresh anterior solamente puede
     * consumirse una vez.
     */
    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },

        data: {
          revokedAt: now,
        },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      await transaction.refreshSession.create({
        data: {
          userId: user.id,

          tokenHash: newRefreshTokenHash,

          expiresAt: newRefreshExpiresAt,
        },
      });
    });

    const accessToken = await this.createAccessToken(user);

    return {
      accessToken,

      refreshToken: newRefreshToken,

      refreshExpiresAt: newRefreshExpiresAt,
    };
  }

  async logout(refreshToken: string | undefined) {
    const cleanRefreshToken = refreshToken?.trim();

    /*
     * Logout es idempotente.
     *
     * Aunque no exista cookie,
     * devolvemos éxito.
     */
    if (cleanRefreshToken) {
      const tokenHash = this.hashRefreshToken(cleanRefreshToken);

      await this.prisma.refreshSession.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      });
    }

    return {
      message: 'Sesión cerrada correctamente',
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        passwordHash: newPasswordHash,

        mustChangePassword: false,
      },
    });

    return {
      message: 'Contraseña actualizada correctamente',
    };
  }

  private async createAccessToken(user: User) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      workspaceId: user.workspaceId,
    };

    let expiresIn = ACCESS_TOKEN_SECONDS;

    /*
     * Un OWNER temporal nunca puede
     * recibir un Access Token que viva
     * más que su propia cuenta.
     */
    if (
      user.role === 'OWNER' &&
      user.ownerType === 'TEMPORARY' &&
      user.expiresAt
    ) {
      const remainingSeconds = Math.floor(
        (user.expiresAt.getTime() - Date.now()) / 1000,
      );

      if (remainingSeconds <= 0) {
        throw new UnauthorizedException('La cuenta temporal ha expirado');
      }

      expiresIn = Math.min(ACCESS_TOKEN_SECONDS, remainingSeconds);
    }

    return this.jwtService.signAsync(payload, {
      expiresIn,
    });
  }

  private getRefreshExpiration(user: User) {
    const normalExpiration = new Date(Date.now() + REFRESH_TOKEN_DURATION_MS);

    /*
     * El refresh de un OWNER temporal
     * tampoco puede superar expiresAt.
     */
    if (
      user.role === 'OWNER' &&
      user.ownerType === 'TEMPORARY' &&
      user.expiresAt
    ) {
      if (user.expiresAt <= new Date()) {
        throw new UnauthorizedException('La cuenta temporal ha expirado');
      }

      if (user.expiresAt < normalExpiration) {
        return user.expiresAt;
      }
    }

    return normalExpiration;
  }

  private validateTemporaryOwner(user: User) {
    if (user.role !== 'OWNER' || user.ownerType !== 'TEMPORARY') {
      return;
    }

    if (!user.expiresAt) {
      throw new UnauthorizedException(
        'La cuenta temporal no tiene fecha de expiración',
      );
    }

    if (user.expiresAt <= new Date()) {
      throw new UnauthorizedException('La cuenta temporal ha expirado');
    }
  }

  private validateRefreshUser(user: RefreshUser) {
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario inactivo');
    }

    /*
     * PLATFORM_ADMIN no pertenece
     * a ningún Workspace.
     */
    if (user.role !== 'PLATFORM_ADMIN') {
      if (!user.workspace) {
        throw new UnauthorizedException(
          'El usuario no tiene un workspace asociado',
        );
      }

      if (user.workspace.status !== 'ACTIVE') {
        throw new UnauthorizedException('El workspace está inactivo');
      }
    }

    this.validateTemporaryOwner(user);
  }

  private generateRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
