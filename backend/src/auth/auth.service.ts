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

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        status: 'ACTIVE',
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Validar expiración de Owners temporales
    if (user.role === 'OWNER' && user.ownerType === 'TEMPORARY') {
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

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);

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
        (user.expiresAt.getTime() - Date.now()) / 1000,
      );

      signOptions.expiresIn = remainingSeconds;
    }

    return {
      accessToken: await this.jwtService.signAsync(
        payload,
        signOptions,
      ),
    };
  }
}