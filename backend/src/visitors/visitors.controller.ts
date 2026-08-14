import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { VisitorsService } from './visitors.service';

@Controller('widget')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get(':workspaceSlug/config')
  async getConfig(
    @Param('workspaceSlug')
    workspaceSlug: string,

    @Query('site')
    siteSlug: string | undefined,
  ) {
    return this.visitorsService.getConfig(workspaceSlug, siteSlug);
  }

  @Post(':workspaceSlug/visitors')
  async create(
    @Param('workspaceSlug')
    workspaceSlug: string,

    @Body('site')
    siteSlug: string | undefined,
  ) {
    return this.visitorsService.create(workspaceSlug, siteSlug);
  }
}
