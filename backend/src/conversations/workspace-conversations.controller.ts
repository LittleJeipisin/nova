import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ConversationsService } from './conversations.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PasswordChangedGuard } from '../auth/guards/password.guards';
import { RolesGuard } from '../auth/guards/roles.guards';
import { WorkspaceGuard } from '../auth/guards/workspace.guards';
import { Roles } from '../auth/decorators/roles.decorators';

@Controller('workspaces')
export class WorkspaceConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get(':workspaceId/conversations')
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
    'AGENT',
  )
  async findAll(
    @Param('workspaceId') workspaceId: string,
    @Req() request: any,
    @Query('status') status?: string,
  ) {
    return this.conversationsService.findAllForWorkspace(
      workspaceId,
      request.user,
      status,
    );
  }

  @Get(':workspaceId/conversations/:conversationId')
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
    'AGENT',
  )
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Req() request: any,
  ) {
    return this.conversationsService.findOneForWorkspace(
      workspaceId,
      conversationId,
      request.user,
    );
  }

  @Patch(':workspaceId/conversations/:conversationId/assign')
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
  async assignAgent(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body('agentId') agentId: string,
  ) {
    return this.conversationsService.assignAgent(
      workspaceId,
      conversationId,
      agentId,
    );
  }

  @Patch(':workspaceId/conversations/:conversationId/close')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
    WorkspaceGuard,
  )
  @Roles('AGENT')
  async close(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Req() request: any,
  ) {
    return this.conversationsService.close(
      workspaceId,
      conversationId,
      request.user.userId,
    );
  }
  @Patch(':workspaceId/conversations/:conversationId/status')
  @UseGuards(
    JwtAuthGuard,
    PasswordChangedGuard,
    RolesGuard,
    WorkspaceGuard,
  )
  @Roles('AGENT')
  async updateStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body('status') status: string,
    @Req() request: any,
  ) {
    return this.conversationsService.updateStatus(
      workspaceId,
      conversationId,
      request.user.userId,
      status,
    );
  }
}