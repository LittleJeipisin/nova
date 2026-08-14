import {
  Body,
  Controller,
  Param,
  ParseFilePipeBuilder,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import type { Request } from 'express';

import { FileInterceptor } from '@nestjs/platform-express';

import { MessagesService } from './messages.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PasswordChangedGuard } from '../auth/guards/password.guards';
import { RolesGuard } from '../auth/guards/roles.guards';
import { WorkspaceGuard } from '../auth/guards/workspace.guards';
import { Roles } from '../auth/decorators/roles.decorators';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    role: string;
  };
};

@Controller('workspaces')
export class WorkspaceMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post(':workspaceId/conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('AGENT')
  async createAgentMessage(
    @Param('workspaceId')
    workspaceId: string,

    @Param('conversationId')
    conversationId: string,

    @Body('content')
    content: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.messagesService.createAgentMessage(
      workspaceId,
      conversationId,
      request.user.userId,
      content,
    );
  }

  @Post(':workspaceId/conversations/:conversationId/images')
  @UseGuards(JwtAuthGuard, PasswordChangedGuard, RolesGuard, WorkspaceGuard)
  @Roles('AGENT')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async createAgentImageMessage(
    @Param('workspaceId')
    workspaceId: string,

    @Param('conversationId')
    conversationId: string,

    @Body('content')
    content: string | undefined,

    @Req()
    request: AuthenticatedRequest,

    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /^image\/(jpeg|png|webp|gif)$/,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024,
        })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.messagesService.createAgentImageMessage(
      workspaceId,
      conversationId,
      request.user.userId,
      file,
      content,
    );
  }
}
