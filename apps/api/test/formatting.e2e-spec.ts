import { Test, TestingModule } from '@nestjs/testing';
import { FormattingService } from '../src/modules/formatting/formatting.service';
import { SequenceNumberingApplierService } from '../src/modules/formatting/sequence-numbering-applier.service';
import { ValidationCheckerService } from '../src/modules/formatting/validation-checker.service';
import { PrismaService } from '../src/prisma.service';
import type { FormattedBlock } from '../src/modules/formatting/formatting.types';

describe('FormattingService', () => {
  let service: FormattingService;

  const mockPrisma = {
    documentSection: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormattingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FormattingService>(FormattingService);
  });

  describe('validateDocument', () => {
    it('returns error for empty document', () => {
      const result = service.validateDocument([]);
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('EMPTY_DOCUMENT');
      expect(result[0].severity).toBe('ERROR');
    });

    it('returns errors for invalid blocks', () => {
      const blocks = [null, 'not-an-object', 42] as unknown[];
      const result = service.validateDocument(blocks);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((e) => e.code === 'INVALID_BLOCK')).toBe(true);
    });

    it('returns warnings for blocks missing text', () => {
      const blocks = [{ blockType: 'PARAGRAPH' }];
      const result = service.validateDocument(blocks);
      expect(result.some((e) => e.code === 'MISSING_BLOCK_TEXT')).toBe(true);
    });

    it('passes valid blocks', () => {
      const blocks = [
        { blockType: 'HEADING', text: 'Introduction', level: 1 },
        { blockType: 'PARAGRAPH', text: 'Body text here' },
      ];
      const result = service.validateDocument(blocks);
      expect(result).toHaveLength(0);
    });
  });

  describe('getWordCount', () => {
    it('counts words correctly', () => {
      const blocks = [
        { blockType: 'PARAGRAPH', text: 'Hello world' },
        { blockType: 'PARAGRAPH', text: 'This is a test' },
      ];
      const result = service.getWordCount(blocks);
      expect(result).toBe(6);
    });

    it('ignores empty blocks', () => {
      const blocks = [
        { blockType: 'PARAGRAPH', text: '' },
        { blockType: 'PARAGRAPH', text: '   ' },
        { blockType: 'PARAGRAPH', text: 'One' },
      ];
      const result = service.getWordCount(blocks);
      expect(result).toBe(1);
    });

    it('handles null blocks', () => {
      const blocks = [
        null,
        undefined,
        { blockType: 'PARAGRAPH', text: 'Test' },
      ];
      const result = service.getWordCount(blocks as unknown[]);
      expect(result).toBe(1);
    });
  });
});

describe('SequenceNumberingApplierService', () => {
  let service: SequenceNumberingApplierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequenceNumberingApplierService],
    }).compile();

    service = module.get<SequenceNumberingApplierService>(
      SequenceNumberingApplierService,
    );
  });

  it('numbers tables sequentially', () => {
    const blocks: FormattedBlock[] = [
      {
        orderIndex: 0,
        blockType: 'TABLE',
        appliedRules: [],
        text: 'Sample data',
      },
      {
        orderIndex: 1,
        blockType: 'TABLE',
        appliedRules: [],
        text: 'More data',
      },
    ];

    const result = service.applySequenceNumbering(blocks, {
      tableStart: 1,
      figureStart: 1,
      equationStart: 1,
    });

    expect(result[0].metadata?.sequenceNumber).toBe(1);
    expect(result[1].metadata?.sequenceNumber).toBe(2);
    expect(result[0].metadata?.sequenceType).toBe('table');
  });

  it('numbers figures sequentially', () => {
    const blocks: FormattedBlock[] = [
      { orderIndex: 0, blockType: 'FIGURE', appliedRules: [], text: 'Chart' },
    ];

    const result = service.applySequenceNumbering(blocks, {
      tableStart: 1,
      figureStart: 5,
      equationStart: 1,
    });

    expect(result[0].metadata?.sequenceNumber).toBe(5);
    expect(result[0].metadata?.sequenceType).toBe('figure');
  });

  it('numbers equations sequentially', () => {
    const blocks: FormattedBlock[] = [
      {
        orderIndex: 0,
        blockType: 'EQUATION',
        appliedRules: [],
        text: 'E = mc^2',
      },
    ];

    const result = service.applySequenceNumbering(blocks, {
      tableStart: 1,
      figureStart: 1,
      equationStart: 10,
    });

    expect(result[0].metadata?.sequenceNumber).toBe(10);
  });

  it('respects manual overrides', () => {
    const blocks: FormattedBlock[] = [
      {
        orderIndex: 0,
        blockType: 'TABLE',
        appliedRules: [],
        text: 'Custom table',
        metadata: { manualSequenceNumber: 42 },
      },
    ];

    const result = service.applySequenceNumbering(blocks, {
      tableStart: 1,
      figureStart: 1,
      equationStart: 1,
    });

    expect(result[0].metadata?.sequenceNumber).toBe(42);
  });

  it('leaves non-sequence blocks unchanged', () => {
    const blocks: FormattedBlock[] = [
      {
        orderIndex: 0,
        blockType: 'PARAGRAPH',
        appliedRules: [],
        text: 'Regular text',
      },
    ];

    const result = service.applySequenceNumbering(blocks, {
      tableStart: 1,
      figureStart: 1,
      equationStart: 1,
    });

    expect(result[0]).toEqual(blocks[0]);
  });
});

describe('ValidationCheckerService', () => {
  let service: ValidationCheckerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationCheckerService],
    }).compile();

    service = module.get<ValidationCheckerService>(ValidationCheckerService);
  });

  describe('word count checks', () => {
    it('returns warning when below minimum word count', () => {
      const blocks: FormattedBlock[] = [
        {
          orderIndex: 0,
          blockType: 'PARAGRAPH',
          appliedRules: [],
          text: 'Short text',
        },
      ];

      const result = service.runValidationChecks(blocks, {
        restrictions: { minWordCount: 100, maxWordCount: 1000 },
      });

      expect(result.some((e) => e.code === 'WORD_COUNT_BELOW_MINIMUM')).toBe(
        true,
      );
    });

    it('returns error when exceeding maximum word count', () => {
      const longText = 'word '.repeat(500);
      const blocks: FormattedBlock[] = [
        {
          orderIndex: 0,
          blockType: 'PARAGRAPH',
          appliedRules: [],
          text: longText,
        },
      ];

      const result = service.runValidationChecks(blocks, {
        restrictions: { minWordCount: 1, maxWordCount: 100 },
      });

      expect(result.some((e) => e.code === 'WORD_COUNT_EXCEEDS_MAXIMUM')).toBe(
        true,
      );
    });
  });

  describe('number consistency checks', () => {
    it('detects duplicate table numbers', () => {
      const blocks: FormattedBlock[] = [
        {
          orderIndex: 0,
          blockType: 'TABLE',
          appliedRules: [],
          text: 'Table 1',
          metadata: { sequenceNumber: 1, sequenceType: 'table' },
        },
        {
          orderIndex: 1,
          blockType: 'TABLE',
          appliedRules: [],
          text: 'Table 1 again',
          metadata: { sequenceNumber: 1, sequenceType: 'table' },
        },
      ];

      const result = service.runValidationChecks(blocks, {});

      expect(result.some((e) => e.code === 'DUPLICATE_TABLE_NUMBER')).toBe(
        true,
      );
    });

    it('detects sequence gaps', () => {
      const blocks: FormattedBlock[] = [
        {
          orderIndex: 0,
          blockType: 'FIGURE',
          appliedRules: [],
          text: 'Figure 1',
          metadata: { sequenceNumber: 1, sequenceType: 'figure' },
        },
        {
          orderIndex: 1,
          blockType: 'FIGURE',
          appliedRules: [],
          text: 'Figure 3',
          metadata: { sequenceNumber: 3, sequenceType: 'figure' },
        },
      ];

      const result = service.runValidationChecks(blocks, {});

      expect(result.some((e) => e.code === 'SEQUENCE_GAP')).toBe(true);
    });
  });

  describe('missing section checks', () => {
    it('warns when required section is missing', () => {
      const blocks: FormattedBlock[] = [
        {
          orderIndex: 0,
          blockType: 'HEADING',
          appliedRules: [],
          text: 'Introduction',
          metadata: { semanticSectionType: 'INTRODUCTION' },
        },
      ];

      const result = service.runValidationChecks(blocks, {
        fixedPages: { abstract: true },
        sectionOrdering: { items: ['references'] },
      });

      expect(result.some((e) => e.code === 'MISSING_SECTION')).toBe(true);
    });

    it('passes when all required sections are present', () => {
      const blocks: FormattedBlock[] = [
        {
          orderIndex: 0,
          blockType: 'HEADING',
          appliedRules: [],
          text: 'Abstract',
          metadata: { semanticSectionType: 'ABSTRACT' },
        },
      ];

      const result = service.runValidationChecks(blocks, {
        fixedPages: { abstract: true },
        sectionOrdering: { items: [] },
      });

      expect(result.some((e) => e.code === 'MISSING_SECTION')).toBe(false);
    });
  });
});
