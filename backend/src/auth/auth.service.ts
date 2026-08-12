import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

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
    let user;

    // Si viene workspaceSlug, buscamos al usuario
    // exclusivamente dentro de ese Workspace.
    if (workspaceSlug) {
      const normalizedWorkspaceSlug = workspaceSlug
        .trim()
        .toLowerCase();

      const workspace =
        await this.prisma.workspace.findUnique({
          where: {
            slug: normalizedWorkspaceSlug,
          },
        });

      if (
        !workspace ||
        workspace.status !== 'ACTIVE'
      ) {
        throw new UnauthorizedException(
          'Credenciales inválidas',
        );
      }

      user = await this.prisma.user.findUnique({
        where: {
          workspaceId_username: {
            workspaceId: workspace.id,
            username,
          },
        },
      });

      // PLATFORM_ADMIN no inicia sesión mediante Workspace.
      if (
        !user ||
        user.role === 'PLATFORM_ADMIN' ||
        user.status !== 'ACTIVE'
      ) {
        throw new UnauthorizedException(
          'Credenciales inválidas',
        );
      }
    } else {
      // Sin workspaceSlug solamente permitimos
      // login de PLATFORM_ADMIN.
      user = await this.prisma.user.findFirst({
        where: {
          username,
          role: 'PLATFORM_ADMIN',
          status: 'ACTIVE',
          workspaceId: null,
        },
      });

      if (!user) {
        throw new UnauthorizedException(
          'Credenciales inválidas',
        );
      }
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException(
        'Credenciales inválidas',
      );
    }

    // Validar expiración de Owners temporales.
    if (
      user.role === 'OWNER' &&
      user.ownerType === 'TEMPORARY'
    ) {
      if (!user.expiresAt) {
        throw new UnauthorizedException(
          'La cuenta temporal no tiene fecha de expiración',
        );
      }

      if (user.expiresAt <= new Date()) {
        throw new UnauthorizedException(
          'La cuenta temporal ha expirado',
        );
      }
    }

    return user;
  }

  async login(
    username: string,
    password: string,
    workspaceSlug?: string,
  ) {
    const user = await this.validateUser(
      username,
      password,
      workspaceSlug,
    );

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      workspaceId: user.workspaceId,
    };

    const signOptions: {
      expiresIn?: number;
    } = {};

    // El JWT de un Owner temporal nunca debe durar
    // más que la propia cuenta.
    if (
      user.role === 'OWNER' &&
      user.ownerType === 'TEMPORARY' &&
      user.expiresAt
    ) {
      const remainingSeconds = Math.floor(
        (user.expiresAt.getTime() - Date.now()) /
          1000,
      );

      signOptions.expiresIn = remainingSeconds;
    }

    return {
      accessToken:
        await this.jwtService.signAsync(
          payload,
          signOptions,
        ),
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      throw new UnauthorizedException(
        'Usuario no encontrado',
      );
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException(
        'La contraseña actual es incorrecta',
      );
    }

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      10,
    );

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
      message:
        'Contraseña actualizada correctamente',
    };
  }
}