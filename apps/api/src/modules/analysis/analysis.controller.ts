import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { analysisTicketUploadFieldMap } from './analysis.constants';
import { createTicketNdaSchema } from './schemas/create-ticket-nda.schema';
import { createAnalysisTicketSchema } from './schemas/create-analysis-ticket.schema';
import { rateTicketSchema } from './schemas/rate-ticket.schema';
import { requestRevisionSchema } from './schemas/request-revision.schema';
import { sendTicketMessageSchema } from './schemas/send-ticket-message.schema';
import { submitQuoteSchema } from './schemas/submit-quote.schema';
import { upsertAnalysisAddOnSchema } from './schemas/upsert-analysis-add-on.schema';
import { upsertAnalysisCategorySchema } from './schemas/upsert-analysis-category.schema';
import { AnalysisService } from './analysis.service';

@Controller()
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  // ───────── Public catalog ─────────

  @Get('analysis-categories')
  @UseGuards(JwtAuthGuard)
  listCategories() {
    return this.analysisService.listActiveCategories();
  }

  // ───────── Ticket CRUD ─────────

  @Post('analysis/tickets')
  @UseGuards(JwtAuthGuard)
  createTicket(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.analysisService.createTicket(user.id, createAnalysisTicketSchema.parse(body));
  }

  @Get('analysis/tickets')
  @UseGuards(JwtAuthGuard)
  listMyTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('deliveryMode') deliveryMode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analysisService.listCustomerTickets(user.id, {
      status,
      categorySlug,
      deliveryMode,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('analysis/tickets/:ticketId')
  @UseGuards(JwtAuthGuard)
  getTicketDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.getTicketDetail(user.id, ticketId, 'CUSTOMER');
  }

  @Get('analysis/tickets/:ticketId/files')
  @UseGuards(JwtAuthGuard)
  getTicketFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.getTicketFiles(user.id, ticketId, 'CUSTOMER');
  }

  @Delete('analysis/tickets/:ticketId')
  @UseGuards(JwtAuthGuard)
  cancelTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.cancelTicket(user.id, ticketId);
  }

  // ───────── File uploads ─────────

  @Post('analysis/tickets/:ticketId/files/data')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor(analysisTicketUploadFieldMap.DATA, {
      storage: memoryStorage(),
    }),
  )
  uploadDataFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.analysisService.uploadTicketFile(user.id, ticketId, 'DATA', file);
  }

  @Post('analysis/tickets/:ticketId/files/description')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor(analysisTicketUploadFieldMap.DESCRIPTION, {
      storage: memoryStorage(),
    }),
  )
  uploadDescriptionFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.analysisService.uploadTicketFile(user.id, ticketId, 'DESCRIPTION', file);
  }

  @Post('analysis/tickets/:ticketId/files/sample')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor(analysisTicketUploadFieldMap.SAMPLE, {
      storage: memoryStorage(),
    }),
  )
  uploadSampleFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.analysisService.uploadTicketFile(user.id, ticketId, 'SAMPLE', file);
  }

  // ───────── Quote flow ─────────

  @Post('analysis/tickets/:ticketId/approve')
  @UseGuards(JwtAuthGuard)
  approveQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.approveQuote(user.id, ticketId);
  }

  @Post('analysis/tickets/:ticketId/reject')
  @UseGuards(JwtAuthGuard)
  rejectQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.rejectQuote(user.id, ticketId);
  }

  // ───────── Revision ─────────

  @Post('analysis/tickets/:ticketId/revision')
  @UseGuards(JwtAuthGuard)
  requestRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    return this.analysisService.requestRevision(
      user.id,
      ticketId,
      requestRevisionSchema.parse(body),
    );
  }

  // ───────── Express upgrade ─────────

  @Post('analysis/tickets/:ticketId/express')
  @UseGuards(JwtAuthGuard)
  upgradeToExpress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.upgradeToExpress(user.id, ticketId);
  }

  // ───────── Rating ─────────

  @Post('analysis/tickets/:ticketId/rate')
  @UseGuards(JwtAuthGuard)
  rateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    return this.analysisService.rateTicket(user.id, ticketId, rateTicketSchema.parse(body));
  }

  // ───────── Close ─────────

  @Post('analysis/tickets/:ticketId/close')
  @UseGuards(JwtAuthGuard)
  closeTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.closeTicket(user.id, ticketId);
  }

  // ───────── Messaging ─────────

  @Post('analysis/tickets/:ticketId/messages')
  @UseGuards(JwtAuthGuard)
  sendCustomerMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    return this.analysisService.sendMessage(
      user.id,
      ticketId,
      'CUSTOMER',
      sendTicketMessageSchema.parse(body),
    );
  }

  @Get('analysis/tickets/:ticketId/messages')
  @UseGuards(JwtAuthGuard)
  listCustomerMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.listMessages(user.id, ticketId, 'CUSTOMER');
  }

  // ───────── NDA ─────────

  @Post('analysis/tickets/:ticketId/nda/agree')
  @UseGuards(JwtAuthGuard)
  agreeToTicketNda(@CurrentUser() user: AuthenticatedUser, @Param('ticketId') ticketId: string) {
    return this.analysisService.agreeToTicketNda(user.id, ticketId);
  }

  // ───────── Expert endpoints ─────────

  @Get('expert/tickets')
  @UseGuards(JwtAuthGuard)
  listExpertTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analysisService.listExpertTickets(user.id, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('expert/tickets/:ticketId')
  @UseGuards(JwtAuthGuard)
  getExpertTicketDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.getTicketDetail(user.id, ticketId, 'EXPERT');
  }

  @Get('expert/tickets/:ticketId/files')
  @UseGuards(JwtAuthGuard)
  getExpertTicketFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.getTicketFiles(user.id, ticketId, 'EXPERT');
  }

  @Post('expert/tickets/:ticketId/quote')
  @UseGuards(JwtAuthGuard)
  submitQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    return this.analysisService.submitQuote(user.id, ticketId, submitQuoteSchema.parse(body));
  }

  @Post('expert/tickets/:ticketId/deliver')
  @UseGuards(JwtAuthGuard)
  markDelivered(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.markDelivered(user.id, ticketId);
  }

  @Post('expert/tickets/:ticketId/files/result')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('resultFile', { storage: memoryStorage() }),
  )
  uploadResultFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.analysisService.uploadResultFile(user.id, ticketId, file);
  }

  @Post('expert/tickets/:ticketId/messages')
  @UseGuards(JwtAuthGuard)
  sendExpertMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    return this.analysisService.sendMessage(
      user.id,
      ticketId,
      'EXPERT',
      sendTicketMessageSchema.parse(body),
    );
  }

  @Get('expert/tickets/:ticketId/messages')
  @UseGuards(JwtAuthGuard)
  listExpertMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.listMessages(user.id, ticketId, 'EXPERT');
  }

  @Get('expert/profile')
  @UseGuards(JwtAuthGuard)
  getMyExpertProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.analysisService.getExpertProfile(user.id);
  }

  // ───────── Admin endpoints ─────────

  @Get('admin/analysis/tickets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminListTickets(
    @Query('status') status?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('deliveryMode') deliveryMode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analysisService.adminListTickets({
      status,
      categorySlug,
      deliveryMode,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('admin/analysis/tickets/:ticketId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminGetTicketDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.getTicketDetail(user.id, ticketId, 'ADMIN');
  }

  @Get('admin/analysis/tickets/:ticketId/files')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminGetTicketFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.getTicketFiles(user.id, ticketId, 'ADMIN');
  }

  @Get('admin/analysis/tickets/:ticketId/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminListMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.analysisService.listMessages(user.id, ticketId, 'ADMIN');
  }

  @Patch('admin/analysis/tickets/:ticketId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminForceStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body('status') newStatus: string,
  ) {
    return this.analysisService.adminForceStatus(user.id, ticketId, newStatus);
  }

  @Post('admin/analysis/tickets/:ticketId/nda')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminCreateTicketNda(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    return this.analysisService.adminCreateTicketNda(user.id, ticketId, createTicketNdaSchema.parse(body));
  }

  @Get('admin/analysis/experts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminListExperts() {
    return this.analysisService.adminListExperts();
  }

  @Get('admin/analysis-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminListCategories() {
    return this.analysisService.adminListCategories();
  }

  @Post('admin/analysis-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminCreateCategory(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.analysisService.adminCreateCategory(user.id, upsertAnalysisCategorySchema.parse(body));
  }

  @Patch('admin/analysis-categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminUpdateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId') categoryId: string,
    @Body() body: unknown,
  ) {
    return this.analysisService.adminUpdateCategory(
      user.id,
      categoryId,
      upsertAnalysisCategorySchema.parse(body),
    );
  }

  @Delete('admin/analysis-categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminDeleteCategory(@CurrentUser() user: AuthenticatedUser, @Param('categoryId') categoryId: string) {
    return this.analysisService.adminDeleteCategory(user.id, categoryId);
  }

  @Get('admin/analysis-add-ons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminListAddOns() {
    return this.analysisService.adminListAddOns();
  }

  @Post('admin/analysis-add-ons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminCreateAddOn(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.analysisService.adminCreateAddOn(user.id, upsertAnalysisAddOnSchema.parse(body));
  }

  @Patch('admin/analysis-add-ons/:addOnId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminUpdateAddOn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addOnId') addOnId: string,
    @Body() body: unknown,
  ) {
    return this.analysisService.adminUpdateAddOn(
      user.id,
      addOnId,
      upsertAnalysisAddOnSchema.parse(body),
    );
  }

  @Delete('admin/analysis-add-ons/:addOnId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminDeleteAddOn(@CurrentUser() user: AuthenticatedUser, @Param('addOnId') addOnId: string) {
    return this.analysisService.adminDeleteAddOn(user.id, addOnId);
  }
}
