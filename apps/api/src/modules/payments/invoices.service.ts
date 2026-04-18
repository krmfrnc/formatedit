import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { InvoiceRecord } from '@formatedit/shared';
import { PrismaService } from '../../prisma.service';

interface InvoiceLine {
  label: string;
  amountCents: number;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Task 253: Invoice generation.
 *
 * - One invoice per successful payment, idempotent on `paymentId`.
 * - Invoice number format: `INV-{YYYY}-{6-digit sequence}`.
 * - PDF rendered on-demand from the persisted snapshot — no external deps.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get invoiceDelegate(): PrismaClient['invoice'] {
    return (this.prismaService as PrismaClient).invoice;
  }

  async ensureForPaymentForUser(userId: string, paymentId: string): Promise<InvoiceRecord> {
    const payment = await this.prismaService.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== userId) {
      throw new ForbiddenException('Payment belongs to another user');
    }
    return this.ensureForPayment(paymentId);
  }

  async ensureForPayment(paymentId: string): Promise<InvoiceRecord> {
    const payment = await this.prismaService.payment.findUnique({
      where: { id: paymentId },
      include: { user: true, analysisTicket: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Invoice can only be issued for succeeded payments');
    }

    const existing = await this.invoiceDelegate.findUnique({
      where: { paymentId: payment.id },
    });
    if (existing) {
      return this.toRecord(existing);
    }

    const meta = (payment.providerMetadata as Record<string, unknown> | null) ?? {};
    const subtotalCents =
      typeof meta.originalAmountCents === 'number' ? meta.originalAmountCents : payment.amountCents;
    const discountCents =
      typeof meta.couponDiscountCents === 'number' ? meta.couponDiscountCents : 0;

    const invoiceNumber = await this.allocateInvoiceNumber();
    const customerSnapshot: Prisma.InputJsonObject = {
      userId: payment.user.id,
      email: payment.user.email,
      fullName: payment.user.fullName,
    };
    const metadata: Prisma.InputJsonObject = {
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      ticketNumber: payment.analysisTicket?.ticketNumber ?? null,
      ticketTitle: payment.analysisTicket?.title ?? null,
      couponCode: meta.couponCode ?? null,
    };

    const invoice = await this.invoiceDelegate.create({
      data: {
        invoiceNumber,
        userId: payment.user.id,
        paymentId: payment.id,
        currency: payment.currency,
        subtotalCents,
        discountCents,
        totalCents: payment.amountCents,
        customerSnapshot,
        metadata,
      },
    });

    return this.toRecord(invoice);
  }

  async listForUser(userId: string): Promise<InvoiceRecord[]> {
    const invoices = await this.invoiceDelegate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });
    return invoices.map((invoice) => this.toRecord(invoice));
  }

  async renderPdfForUser(userId: string, invoiceId: string): Promise<{ filename: string; pdf: Buffer }> {
    const invoice = await this.invoiceDelegate.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.userId !== userId) {
      throw new ForbiddenException('Invoice belongs to another user');
    }

    const pdf = this.renderPdf(invoice);
    return {
      filename: `${invoice.invoiceNumber}.pdf`,
      pdf,
    };
  }

  private async allocateInvoiceNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `INV-${year}-`;
    const last = await this.invoiceDelegate.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
    });
    const lastSequence = last
      ? Number(last.invoiceNumber.slice(prefix.length)) || 0
      : 0;
    const next = lastSequence + 1;
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  private renderPdf(invoice: {
    invoiceNumber: string;
    currency: string;
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    customerSnapshot: unknown;
    metadata: unknown;
    issuedAt: Date;
  }): Buffer {
    const issuer = this.configService.get<string>('appUrl') ?? 'FormatEdit';
    const customer = (invoice.customerSnapshot as Record<string, unknown> | null) ?? {};
    const metadata = (invoice.metadata as Record<string, unknown> | null) ?? {};

    const lines: string[] = [];
    lines.push(`Invoice ${invoice.invoiceNumber}`);
    lines.push(`Issued: ${invoice.issuedAt.toISOString().slice(0, 10)}`);
    lines.push('');
    lines.push(`Issuer: ${issuer}`);
    lines.push('');
    lines.push('Bill To:');
    lines.push(`  ${(customer.fullName as string | undefined) ?? 'Customer'}`);
    lines.push(`  ${(customer.email as string | undefined) ?? ''}`);
    lines.push('');
    const ticketNumber = stringOrNull(metadata.ticketNumber);
    const ticketTitle = stringOrNull(metadata.ticketTitle);
    const provider = stringOrNull(metadata.provider);
    const providerPaymentId = stringOrNull(metadata.providerPaymentId);
    const couponCode = stringOrNull(metadata.couponCode);

    if (ticketNumber) {
      lines.push(`Ticket: ${ticketNumber}`);
    }
    if (ticketTitle) {
      lines.push(`Subject: ${ticketTitle}`);
    }
    if (provider) {
      lines.push(`Payment Provider: ${provider}`);
    }
    if (providerPaymentId) {
      lines.push(`Provider Payment ID: ${providerPaymentId}`);
    }
    lines.push('');

    const items: InvoiceLine[] = [
      {
        label: ticketTitle ?? 'Service',
        amountCents: invoice.subtotalCents,
      },
    ];
    for (const item of items) {
      lines.push(`${item.label}    ${this.formatMoney(item.amountCents, invoice.currency)}`);
    }
    if (invoice.discountCents > 0) {
      const couponLabel = couponCode ? `Coupon (${couponCode})` : 'Discount';
      lines.push(`${couponLabel}    -${this.formatMoney(invoice.discountCents, invoice.currency)}`);
    }
    lines.push('');
    lines.push(`Subtotal: ${this.formatMoney(invoice.subtotalCents, invoice.currency)}`);
    if (invoice.discountCents > 0) {
      lines.push(`Discount: -${this.formatMoney(invoice.discountCents, invoice.currency)}`);
    }
    lines.push(`Total: ${this.formatMoney(invoice.totalCents, invoice.currency)}`);

    return this.buildPdf(lines);
  }

  private formatMoney(amountCents: number, currency: string): string {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }

  /** Minimal single-page PDF builder mirroring the formatting module's style. */
  private buildPdf(lines: string[]): Buffer {
    const fontSize = 11;
    const leading = 16;
    const marginLeft = 54;
    const startY = 738;

    const operations: string[] = [];
    let cursorY = startY;
    for (const rawLine of lines) {
      const line = this.escape(rawLine || ' ');
      operations.push('BT');
      operations.push(`/F1 ${fontSize} Tf`);
      operations.push(`${marginLeft} ${cursorY} Td`);
      operations.push(`(${line}) Tj`);
      operations.push('ET');
      cursorY -= leading;
    }
    const content = operations.join('\n');

    const objects: string[] = [];
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.push(
      `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
    );
    objects.push('PLACEHOLDER_PAGES');
    objects.push(
      '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 1 0 R >> >> /Contents 2 0 R >>',
    );
    objects[2] = '<< /Type /Pages /Kids [ 4 0 R ] /Count 1 >>';
    objects.push('<< /Type /Catalog /Pages 3 0 R >>');

    const offsets: number[] = [];
    let output = '%PDF-1.4\n';
    for (let index = 0; index < objects.length; index += 1) {
      offsets.push(Buffer.byteLength(output, 'utf8'));
      output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(output, 'utf8');
    output += `xref\n0 ${objects.length + 1}\n`;
    output += '0000000000 65535 f \n';
    for (const offset of offsets) {
      output += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${objects.length} 0 R >>\n`;
    output += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(output, 'utf8');
  }

  private escape(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r?\n/g, ' ');
  }

  private toRecord(invoice: {
    id: string;
    invoiceNumber: string;
    userId: string;
    paymentId: string;
    currency: string;
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    issuedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): InvoiceRecord {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      userId: invoice.userId,
      paymentId: invoice.paymentId,
      currency: invoice.currency,
      subtotalCents: invoice.subtotalCents,
      discountCents: invoice.discountCents,
      totalCents: invoice.totalCents,
      issuedAt: invoice.issuedAt.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }
}
