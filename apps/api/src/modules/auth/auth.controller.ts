import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SendTwoFactorCodeDto } from './dto/send-two-factor-code.dto';
import { SetupAuthenticatorDto } from './dto/setup-authenticator.dto';
import { StartImpersonationDto } from './dto/start-impersonation.dto';
import { StopImpersonationDto } from './dto/stop-impersonation.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { GoogleOAuthGuard } from './google-oauth.guard';
import { TwoFactorService } from './two-factor.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshSession(dto);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.id);
  }

  @Get('admin/check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'EXPERT')
  adminCheck(@CurrentUser() user: AuthenticatedUser) {
    return {
      status: 'ok' as const,
      role: user.role,
    };
  }

  @Post('2fa/whatsapp/send')
  @UseGuards(JwtAuthGuard)
  sendWhatsAppCode(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendTwoFactorCodeDto) {
    return this.twoFactorService.sendWhatsAppCode(user.id, dto);
  }

  @Post('2fa/telegram/send')
  @UseGuards(JwtAuthGuard)
  sendTelegramCode(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendTwoFactorCodeDto) {
    return this.twoFactorService.sendTelegramCode(user.id, dto);
  }

  @Post('2fa/authenticator/setup')
  @UseGuards(JwtAuthGuard)
  setupAuthenticator(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetupAuthenticatorDto) {
    return this.twoFactorService.setupAuthenticator(user.id, dto);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  verifyTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyTwoFactorDto) {
    return this.twoFactorService.verify(user.id, dto);
  }

  @Post('impersonate/stop')
  @UseGuards(JwtAuthGuard)
  stopImpersonation(@CurrentUser() user: AuthenticatedUser, @Body() dto: StopImpersonationDto) {
    return this.authService.stopImpersonation(
      user.impersonatedByUserId ?? user.id,
      dto,
      user.impersonationSessionId,
    );
  }

  @Post('impersonate/:targetUserId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  impersonate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: StartImpersonationDto,
  ) {
    return this.authService.startImpersonation(user.id, targetUserId, dto);
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleLogin(): void {}

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  googleCallback(@Req() request: Request & { user: unknown }) {
    return request.user;
  }
}
