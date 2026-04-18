import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { InvoicesService } from '../src/modules/payments/invoices.service';
import { PrismaService } from '../src/prisma.service';

interface InvoiceRow {
  invoiceNumber: string;
}

/**
 * Task 267: Invoice number allocation. Verifies the `INV-{YYYY}-{6-digit}`
 * format and monotonically incrementing sequence per year.
 */
describe('InvoicesService.allocateInvoiceNumber (Task 267)', () => {
  let service: InvoicesService;
  let findFirst: jest.Mock;

  beforeEach(async () => {
    findFirst = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: PrismaService,
          useValue: { invoice: { findFirst } },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('FormatEdit Test') },
        },
      ],
    }).compile();
    service = module.get(InvoicesService);
  });

  it('starts at 000001 when there are no prior invoices for the year', async () => {
    findFirst.mockResolvedValue(null);
    const allocate = (
      service as unknown as { allocateInvoiceNumber(): Promise<string> }
    ).allocateInvoiceNumber.bind(service);
    const result = await allocate();
    const year = new Date().getUTCFullYear();
    expect(result).toBe(`INV-${year}-000001`);
  });

  it('increments from the latest invoice for the same year', async () => {
    const year = new Date().getUTCFullYear();
    const last: InvoiceRow = { invoiceNumber: `INV-${year}-000042` };
    findFirst.mockResolvedValue(last);
    const allocate = (
      service as unknown as { allocateInvoiceNumber(): Promise<string> }
    ).allocateInvoiceNumber.bind(service);
    const result = await allocate();
    expect(result).toBe(`INV-${year}-000043`);
  });

  it('falls back to 1 when the trailing sequence is unparseable', async () => {
    const year = new Date().getUTCFullYear();
    findFirst.mockResolvedValue({ invoiceNumber: `INV-${year}-XXXXXX` });
    const allocate = (
      service as unknown as { allocateInvoiceNumber(): Promise<string> }
    ).allocateInvoiceNumber.bind(service);
    const result = await allocate();
    expect(result).toBe(`INV-${year}-000001`);
  });
});
