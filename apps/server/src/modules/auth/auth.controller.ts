import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { SkipEnvelope } from '../../common/response/skip-envelope.decorator';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  getCurrentUser(@CurrentUser() currentUser?: RequestUserContext | null) {
    return this.authService.getCurrentUser(currentUser);
  }

  @Post('auth/login')
  @HttpCode(200)
  login(@Body() body: Record<string, unknown>, @Res({ passthrough: true }) response: Response) {
    return this.authService.loginWithPassword(response, String(body.email ?? ''), String(body.password ?? ''));
  }

  @Get('auth/sso/authorize')
  @SkipEnvelope()
  authorize(@Res() response: Response, @Query('redirect_uri') redirectUri?: string) {
    return this.authService.authorize(response, redirectUri);
  }

  @Get('auth/sso/callback')
  @SkipEnvelope()
  callback(@Res() response: Response, @Query('code') code?: string, @Query('state') state?: string) {
    return this.authService.callback(response, String(code ?? ''), String(state ?? ''));
  }

  @Get('auth/linuxdo/authorize')
  @SkipEnvelope()
  authorizeLinuxDo(@Res() response: Response, @Query('redirect_uri') redirectUri?: string) {
    return this.authService.authorizeLinuxDo(response, redirectUri);
  }

  @Get('auth/linuxdo/callback')
  @SkipEnvelope()
  callbackLinuxDo(@Res() response: Response, @Query('code') code?: string, @Query('state') state?: string) {
    return this.authService.callbackLinuxDo(response, String(code ?? ''), String(state ?? ''));
  }

  @Post('auth/register')
  @HttpCode(200)
  register(@Body() body: Record<string, unknown>) {
    return this.authService.registerWithEmail(
      String(body.email ?? ''),
      String(body.password ?? ''),
      String(body.displayName ?? ''),
    );
  }

  @Post('auth/forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() body: Record<string, unknown>) {
    return this.authService.requestPasswordReset(String(body.email ?? ''));
  }

  @Post('auth/reset-password')
  @HttpCode(200)
  resetPassword(@Body() body: Record<string, unknown>) {
    return this.authService.resetPassword(
      String(body.token ?? ''),
      String(body.newPassword ?? ''),
    );
  }

  @Get('auth/verify-email')
  @SkipEnvelope()
  async verifyEmail(@Res() response: Response, @Query('token') token?: string) {
    try {
      await this.authService.verifyEmailToken(String(token ?? ''));
      response.redirect(302, '/login?verified=true');
    } catch {
      response.redirect(302, '/login?verify_error=invalid_or_expired');
    }
  }

  @Post('auth/refresh')
  @HttpCode(200)
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.refresh(request, response);
  }

  @Post('auth/change-password')
  @HttpCode(200)
  changePassword(@CurrentUser() currentUser: RequestUserContext, @Body() body: Record<string, unknown>) {
    return this.authService.changePassword(currentUser, String(body.oldPassword ?? ''), String(body.newPassword ?? ''));
  }

  @Post('auth/logout')
  @HttpCode(200)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request, response);
  }

  @Post('ws/ticket')
  @HttpCode(200)
  issueWsTicket(@CurrentUser() currentUser: RequestUserContext) {
    return this.authService.issueWsTicket(currentUser);
  }
}
