import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: {
    sub: string;
    username: string;
    role: string;
    workspaceId: string | null;
  }) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Usuario no encontrado',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Usuario inactivo',
      );
    }

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

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      ownerType: user.ownerType,
      workspaceId: user.workspaceId,
    };
  }
}