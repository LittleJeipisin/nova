import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { MessagesService } from './messages.service';

@Controller('widget')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get(':workspaceSlug/conversations/:conversationId/messages')
  async getVisitorMessages(
    @Param('workspaceSlug')
    workspaceSlug: string,

    @Param('conversationId')
    conversationId: string,

    @Headers('authorization')
    authorization: string | undefined,
  ) {
    return this.messagesService.getVisitorMessages(
      workspaceSlug,
      conversationId,
      authorization,
    );
  }

  @Post(':workspaceSlug/conversations/:conversationId/messages')
  async createVisitorMessage(
    @Param('workspaceSlug')
    workspaceSlug: string,

    @Param('conversationId')
    conversationId: string,

    @Headers('authorization')
    authorization: string | undefined,

    @Body('content')
    content: string,
  ) {
    return this.messagesService.createVisitorMessage(
      workspaceSlug,
      conversationId,
      authorization,
      content,
    );
  }

  @Post(':workspaceSlug/conversations/:conversationId/images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async createVisitorImageMessage(
    @Param('workspaceSlug')
    workspaceSlug: string,

    @Param('conversationId')
    conversationId: string,

    @Headers('authorization')
    authorization: string | undefined,

    @Body('content')
    content: string | undefined,

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
    return this.messagesService.createVisitorImageMessage(
      workspaceSlug,
      conversationId,
      authorization,
      file,
      content,
    );
  }

  /*
   * AUDIO
   *
   * El MIME se valida nuevamente
   * dentro de MessagesService.
   *
   * No usamos FileTypeValidator aquí
   * porque MediaRecorder puede producir:
   *
   * audio/webm;codecs=opus
   *
   * dependiendo del navegador.
   */
  @Post(':workspaceSlug/conversations/:conversationId/audios')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    }),
  )
  async createVisitorAudioMessage(
    @Param('workspaceSlug')
    workspaceSlug: string,

    @Param('conversationId')
    conversationId: string,

    @Headers('authorization')
    authorization: string | undefined,

    @Body('content')
    content: string | undefined,

    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 15 * 1024 * 1024,
        })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.messagesService.createVisitorAudioMessage(
      workspaceSlug,
      conversationId,
      authorization,
      file,
      content,
    );
  }
}
