import { Controller, Get, Param, Post } from '@nestjs/common';

import { VisitorsService } from './visitors.service';

@Controller('widget')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get(':workspaceSlug/config')
  async getConfig(
    @Param('workspaceSlug')
    workspaceSlug: string,
  ) {
    return this.visitorsService.getConfig(workspaceSlug);
  }

  @Post(':workspaceSlug/visitors')
  async create(
    @Param('workspaceSlug')
    workspaceSlug: string,
  ) {
    return this.visitorsService.create(workspaceSlug);
  }
}
