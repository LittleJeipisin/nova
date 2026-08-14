import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SitesService } from './sites.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PasswordChangedGuard } from '../auth/guards/password.guards';
import { RolesGuard } from '../auth/guards/roles.guards';
import { WorkspaceGuard } from '../auth/guards/workspace.guards';
import { Roles } from '../auth/decorators/roles.decorators';

type AuthenticatedRequest = {
  user: {
    userId: string;
    role: string;
    workspaceId: string | null;
    ownerType?: string | null;
  };
};

@Controller('workspaces')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post(':workspaceId/sites')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('PLATFORM_ADMIN', 'OWNER')
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body('name') name: string,
    @Body('slug') slug: string | undefined,
    @Body('domain') domain: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sitesService.create(
      workspaceId,
      name,
      slug,
      domain,
      request.user,
    );
  }

  @Get(':workspaceId/sites')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('PLATFORM_ADMIN', 'OWNER', 'ADMIN')
  async findAll(
    @Param('workspaceId') workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sitesService.findAll(workspaceId, request.user);
  }

  @Get(':workspaceId/sites/:siteId')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('PLATFORM_ADMIN', 'OWNER', 'ADMIN')
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('siteId') siteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sitesService.findOne(workspaceId, siteId, request.user);
  }

  @Patch(':workspaceId/sites/:siteId/deactivate')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('PLATFORM_ADMIN', 'OWNER')
  async deactivate(
    @Param('workspaceId') workspaceId: string,
    @Param('siteId') siteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sitesService.deactivate(workspaceId, siteId, request.user);
  }

  @Patch(':workspaceId/sites/:siteId/activate')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('PLATFORM_ADMIN', 'OWNER')
  async activate(
    @Param('workspaceId') workspaceId: string,
    @Param('siteId') siteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sitesService.activate(workspaceId, siteId, request.user);
  }
}
