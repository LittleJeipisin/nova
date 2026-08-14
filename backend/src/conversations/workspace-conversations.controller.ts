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

import type { Request } from 'express';

import { ConversationsService } from './conversations.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { PasswordChangedGuard } from '../auth/guards/password.guards';
import { RolesGuard } from '../auth/guards/roles.guards';
import { WorkspaceGuard } from '../auth/guards/workspace.guards';

type AuthenticatedUser = {
  userId: string;
  role: string;
};

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('workspaces')
export class WorkspaceConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get(':workspaceId/conversations')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('PLATFORM_ADMIN', 'OWNER', 'ADMIN', 'AGENT')
  async findAll(
    @Param('workspaceId') workspaceId: string,
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    return this.conversationsService.findAllForWorkspace(
      workspaceId,
      request.user,
      status,
    );
  }

  @Get(':workspaceId/conversations/:conversationId')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('PLATFORM_ADMIN', 'OWNER', 'ADMIN', 'AGENT')
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversationsService.findOneForWorkspace(
      workspaceId,
      conversationId,
      request.user,
    );
  }

  @Patch(':workspaceId/conversations/:conversationId/assign')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('PLATFORM_ADMIN', 'OWNER', 'ADMIN')
  async assignAgent(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body('agentId') agentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversationsService.assignAgent(
      workspaceId,
      conversationId,
      agentId,
      request.user,
    );
  }

  @Patch(':workspaceId/conversations/:conversationId/claim')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('AGENT')
  async claim(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversationsService.claim(
      workspaceId,
      conversationId,
      request.user.userId,
    );
  }

  @Patch(':workspaceId/conversations/:conversationId/close')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('AGENT')
  async close(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversationsService.close(
      workspaceId,
      conversationId,
      request.user.userId,
    );
  }

  @Patch(':workspaceId/conversations/:conversationId/status')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('AGENT')
  async updateStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body('status') status: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversationsService.updateStatus(
      workspaceId,
      conversationId,
      request.user.userId,
      status,
    );
  }
}
