import { Test, type TestingModule } from '@nestjs/testing';
import { FormattingWorkerService } from '../src/modules/formatting/formatting.worker';
import { FormattingService } from '../src/modules/formatting/formatting.service';
import { DocxOutputGeneratorService } from '../src/modules/formatting/docx-output-generator.service';
import { PdfOutputGeneratorService } from '../src/modules/formatting/pdf-output-generator.service';
import { QueueService } from '../src/modules/queue/queue.service';
import { PrismaService } from '../src/prisma.service';
import { StorageService } from '../src/modules/storage/storage.service';

describe('FormattingWorkerService', () => {
  it('generates DOCX/PDF outputs and persists the formatted version', async () => {
    let processor: (job: {
      data: {
        documentId: string;
        documentVersionId: string;
        templateId: string;
        requestedBy: string;
      };
      attemptsMade: number;
      id: string;
      updateProgress: (value: number) => Promise<void>;
    }) => Promise<void> = () => Promise.resolve(undefined);

    const mockQueueService = {
      createFormattingWorker: jest.fn((handler) => {
        processor = handler as typeof processor;
        return {
          close: jest.fn().mockResolvedValue(undefined),
        };
      }),
    };

    const mockFormattingService = {
      applyFormatting: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
        warnings: [],
        infos: [],
        formattedBlocks: [
          {
            orderIndex: 0,
            blockType: 'HEADING',
            appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY', 'HEADING_STYLE'],
            text: 'Abstract',
            metadata: { heading: { level: 1 } },
          },
          {
            orderIndex: 1,
            blockType: 'PARAGRAPH',
            appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
            text: 'Body text for the document.',
            metadata: {},
          },
        ],
        generatedPages: [],
        documentId: 'document_1',
        documentVersionId: 'version_1',
        durationMs: 12,
      }),
    };

    const documentVersionCreateMock = jest.fn<
      Promise<{ id: string }>,
      [
        {
          data: {
            id: string;
            documentId: string;
            type: string;
            label: string;
            storageKey: string;
            contentType: string;
            sizeBytes: number;
            metadata: Record<string, unknown>;
          };
        },
      ]
    >().mockResolvedValue({
      id: 'formatted_version_1',
    });

    const mockPrisma = {
      template: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'template_1',
          templateParameters: {
            typography: { fontFamily: 'Times New Roman', fontSizePt: 12 },
          },
        }),
      },
      documentVersion: {
        create: documentVersionCreateMock,
      },
    };

    const mockStorage = {
      uploadObject: jest.fn().mockResolvedValue({
        bucket: 'formatedit',
        key: 'key',
        provider: 'minio',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormattingWorkerService,
        { provide: QueueService, useValue: mockQueueService },
        { provide: FormattingService, useValue: mockFormattingService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        {
          provide: DocxOutputGeneratorService,
          useValue: {
            generateDocx: jest.fn().mockResolvedValue(Buffer.from('docx-buffer')),
          },
        },
        {
          provide: PdfOutputGeneratorService,
          useValue: {
            generatePdf: jest.fn().mockReturnValue(Buffer.from('%PDF-1.4 test')),
          },
        },
      ],
    }).compile();

    const worker = module.get(FormattingWorkerService);
    worker.onModuleInit();

    await processor({
      data: {
        documentId: 'document_1',
        documentVersionId: 'version_1',
        templateId: 'template_1',
        requestedBy: 'user_1',
      },
      attemptsMade: 0,
      id: 'job_1',
      updateProgress: jest.fn().mockResolvedValue(undefined),
    });

    expect(mockFormattingService.applyFormatting).toHaveBeenCalledWith(
      'document_1',
      'version_1',
      {
        typography: { fontFamily: 'Times New Roman', fontSizePt: 12 },
      },
      {},
    );
    expect(mockStorage.uploadObject).toHaveBeenCalledTimes(2);
    const createArgs = documentVersionCreateMock.mock.calls[0]?.[0];
    expect(createArgs?.data.documentId).toBe('document_1');
    expect(createArgs?.data.type).toBe('FORMATTED');
    expect(createArgs?.data.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(createArgs?.data.sizeBytes).toBe(Buffer.byteLength('docx-buffer'));
  });
});

describe('PdfOutputGeneratorService', () => {
  it('creates a valid PDF buffer from formatted blocks', () => {
    const service = new PdfOutputGeneratorService();
    const buffer = service.generatePdf(
      [
        {
          orderIndex: 0,
          blockType: 'HEADING',
          appliedRules: [],
          text: 'Abstract',
          metadata: {},
        },
        {
          orderIndex: 1,
          blockType: 'PARAGRAPH',
          appliedRules: [],
          text: 'This is a sample paragraph for the PDF output generator.',
          metadata: {},
        },
      ],
      {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
      },
    );

    const pdfText = buffer.toString('utf8');
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('Abstract');
  });
});
