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

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';
import { WorkspaceGuard } from '../auth/guards/workspace.guards';
import { Roles } from '../auth/decorators/roles.decorators';
import { PasswordChangedGuard } from '../auth/guards/password.guards';

@Controller('workspaces')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Post(':workspaceId/owners')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
  )
  @Roles('PLATFORM_ADMIN')
  async createOwner(
    @Param('workspaceId') workspaceId: string,
    @Body('username') username: string,
  ) {
    return this.usersService.createOwner(
      workspaceId,
      username,
    );
  }

  @Post(':workspaceId/temporary-owners')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
  )
  @Roles('PLATFORM_ADMIN')
  async createTemporaryOwner(
    @Param('workspaceId') workspaceId: string,
    @Body('username') username: string,
    @Body('expiresAt') expiresAt: string,
  ) {
    return this.usersService.createTemporaryOwner(
      workspaceId,
      username,
      new Date(expiresAt),
    );
  }

  @Post(':workspaceId/admins')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
    WorkspaceGuard,
  )
  @Roles('OWNER')
  async createAdmin(
    @Param('workspaceId') workspaceId: string,
    @Body('username') username: string,
    @Req() request: any,
  ) {
    return this.usersService.createAdmin(
      workspaceId,
      username,
      request.user,
    );
  }

  @Post(':workspaceId/agents')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
    WorkspaceGuard,
  )
  @Roles('ADMIN')
  async createAgent(
    @Param('workspaceId') workspaceId: string,
    @Body('username') username: string,
  ) {
    return this.usersService.createAgent(
      workspaceId,
      username,
    );
  }

  @Get(':workspaceId/users')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
    WorkspaceGuard,
  )
  @Roles(
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
  )
  async findAll(
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.usersService.findAll(
      workspaceId,
    );
  }

  @Get(':workspaceId/users/:userId')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
    WorkspaceGuard,
  )
  @Roles(
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
  )
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    return this.usersService.findOne(
      workspaceId,
      userId,
    );
  }

  @Patch(
    ':workspaceId/users/:userId/deactivate',
  )
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
    WorkspaceGuard,
  )
  @Roles(
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
  )
  async deactivate(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Req() request: any,
  ) {
    return this.usersService.deactivate(
      workspaceId,
      userId,
      request.user,
    );
  }

  @Patch(
    ':workspaceId/users/:userId/activate',
  )
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
    WorkspaceGuard,
  )
  @Roles(
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
  )
  async activate(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Req() request: any,
  ) {
    return this.usersService.activate(
      workspaceId,
      userId,
      request.user,
    );
  }
}
