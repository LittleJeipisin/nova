import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { CookieOptions, Request, Response } from 'express';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const REFRESH_COOKIE_NAME = 'nova_refresh_token';

type AuthenticatedUser = {
  userId: string;
  username: string;
  role: string;
  ownerType: string | null;
  workspaceId: string | null;
  mustChangePassword: boolean;
};

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

function getRefreshCookieBaseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth',
  };
}

function getRefreshTokenFromCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return undefined;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const trimmedCookie = cookie.trim();

    const prefix = `${REFRESH_COOKIE_NAME}=`;

    if (!trimmedCookie.startsWith(prefix)) {
      continue;
    }

    const value = trimmedCookie.slice(prefix.length);

    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body('username')
    username: string,

    @Body('password')
    password: string,

    @Body('workspaceSlug')
    workspaceSlug: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    const result = await this.authService.login(
      username,
      password,
      workspaceSlug,
    );

    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...getRefreshCookieBaseOptions(),

      expires: result.refreshExpiresAt,
    });

    return {
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  async refresh(
    @Headers('cookie')
    cookieHeader: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    const refreshToken = getRefreshTokenFromCookie(cookieHeader);

    const result = await this.authService.refresh(refreshToken);

    /*
     * Rotamos también la cookie.
     */
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...getRefreshCookieBaseOptions(),

      expires: result.refreshExpiresAt,
    });

    return {
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  async logout(
    @Headers('cookie')
    cookieHeader: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    const refreshToken = getRefreshTokenFromCookie(cookieHeader);

    const result = await this.authService.logout(refreshToken);

    response.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieBaseOptions());

    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return request.user;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req()
    request: AuthenticatedRequest,

    @Body('currentPassword')
    currentPassword: string,

    @Body('newPassword')
    newPassword: string,
  ) {
    return this.authService.changePassword(
      request.user.userId,
      currentPassword,
      newPassword,
    );
  }
}
