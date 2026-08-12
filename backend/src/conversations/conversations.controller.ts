import {
  Controller,
  Headers,
  Param,
  Post,
} from '@nestjs/common';

import { ConversationsService } from './conversations.service';

@Controller('widget')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  @Post(':workspaceSlug/conversations')
  async create(
    @Param('workspaceSlug')
    workspaceSlug: string,

    @Headers('authorization')
    authorization: string | undefined,
  ) {
    return this.conversationsService.create(
      workspaceSlug,
      authorization,
    );
  }
}