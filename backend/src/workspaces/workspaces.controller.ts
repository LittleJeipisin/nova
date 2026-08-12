import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { WorkspacesService } from './workspaces.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PasswordChangedGuard } from '../auth/guards/password.guards';
import { RolesGuard } from '../auth/guards/roles.guards';
import { Roles } from '../auth/decorators/roles.decorators';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Post()
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
  )
  @Roles('PLATFORM_ADMIN')
  async create(@Body('name') name: string) {
    return this.workspacesService.create(name);
  }

  @Get()
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
  )
  @Roles('PLATFORM_ADMIN')
  async findAll() {
    return this.workspacesService.findAll();
  }

  @Get(':workspaceId')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
  )
  @Roles('PLATFORM_ADMIN')
  async findOne(
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspacesService.findOne(
      workspaceId,
    );
  }
  @Patch(':workspaceId/deactivate')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
  )
  @Roles('PLATFORM_ADMIN')
  async deactivate(
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspacesService.deactivate(
      workspaceId,
    );
  }

  @Patch(':workspaceId/activate')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
  )
  @Roles('PLATFORM_ADMIN')
  async activate(
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspacesService.activate(
      workspaceId,
    );
  }
  @Patch(':workspaceId')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
  )
  @Roles('PLATFORM_ADMIN')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Body('name') name: string,
  ) {
    return this.workspacesService.update(
      workspaceId,
      name,
    );
  }
}