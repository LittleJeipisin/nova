import {
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
};

@Injectable()
export class VisitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async create(
    workspaceSlug: string,
  ) {
    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          slug: workspaceSlug
            .trim()
            .toLowerCase(),
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace no encontrado',
      );
    }

    if (workspace.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'El workspace está inactivo',
      );
    }

    const visitor =
      await this.prisma.visitor.create({
        data: {
          workspaceId: workspace.id,
        },
      });

    const visitorToken =
      await this.jwtService.signAsync(
        {
          sub: visitor.id,
          type: 'VISITOR',
          workspaceId: workspace.id,
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
        createdAt: visitor.createdAt,
        updatedAt: visitor.updatedAt,
        lastSeenAt: visitor.lastSeenAt,
      },
    };
  }

  async verifyVisitorToken(
    token: string | undefined,
    workspaceId: string,
  ) {
    if (!token) {
      throw new UnauthorizedException(
        'Token de visitante no proporcionado',
      );
    }

    const cleanToken = token
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!cleanToken) {
      throw new UnauthorizedException(
        'Token de visitante no proporcionado',
      );
    }

    let payload: VisitorTokenPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<VisitorTokenPayload>(
          cleanToken,
        );
    } catch {
      throw new UnauthorizedException(
        'Token de visitante inválido o expirado',
      );
    }

    if (payload.type !== 'VISITOR') {
      throw new UnauthorizedException(
        'Token de visitante inválido',
      );
    }

    if (payload.workspaceId !== workspaceId) {
      throw new UnauthorizedException(
        'El token no pertenece a este workspace',
      );
    }

    const visitor =
      await this.prisma.visitor.findFirst({
        where: {
          id: payload.sub,
          workspaceId,
        },
      });

    if (!visitor) {
      throw new UnauthorizedException(
        'Visitor no válido',
      );
    }

    return visitor;
  }
}