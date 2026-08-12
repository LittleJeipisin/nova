import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
    @Body('workspaceSlug') workspaceSlug?: string,
  ) {
    return this.authService.login(
      username,
      password,
      workspaceSlug,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() request: any) {
    return request.user;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() request: any,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.changePassword(
      request.user.userId,
      currentPassword,
      newPassword,
    );
  }
}