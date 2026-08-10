import { Controller, Get, Post, Req, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './decorators/roles.decorators';
import { RolesGuard } from './guards/roles.guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    return this.authService.login(username, password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() request: any) {
    return request.user;
  }
}