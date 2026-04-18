import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { initiateStudentVerificationSchema } from './schemas/initiate-verification.schema';
import { StudentVerificationService } from './student-verification.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('student-verifications')
export class StudentVerificationController {
  constructor(private readonly service: StudentVerificationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  initiate(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.service.initiateForUser(
      user.id,
      initiateStudentVerificationSchema.parse(body),
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getCurrentForUser(user.id);
  }

  @Post(':id/verification-id')
  @UseGuards(JwtAuthGuard)
  attachVerificationId(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { verificationId?: string },
  ) {
    if (!body?.verificationId || typeof body.verificationId !== 'string') {
      throw new BadRequestException('verificationId is required');
    }
    return this.service.attachVerificationId(user.id, id, body.verificationId.trim());
  }

  @Post(':verificationId/refresh')
  @UseGuards(JwtAuthGuard)
  refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Param('verificationId') verificationId: string,
  ) {
    return this.service.refreshFromProvider(user.id, verificationId);
  }

  @Post('webhooks/sheerid')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() request: RequestWithRawBody,
    @Headers('x-sheerid-signature') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    const rawBody = request.rawBody;
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing raw request body');
    }
    await this.service.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
