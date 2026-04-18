import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('googleClientId') || 'google-client-id-not-configured',
      clientSecret:
        configService.get<string>('googleClientSecret') || 'google-client-secret-not-configured',
      callbackURL:
        configService.get<string>('googleCallbackUrl') || 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const session = await this.authService.handleGoogleLogin({
        accessToken,
        refreshToken,
        profile,
      });

      done(null, session);
    } catch (error) {
      done(error as Error, false);
    }
  }
}
