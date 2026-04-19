import { Test, TestingModule } from '@nestjs/testing';
import { FormattingService } from '../src/modules/formatting/formatting.service';
import { SequenceNumberingApplierService } from '../src/modules/formatting/sequence-numbering-applier.service';
import { ValidationCheckerService } from '../src/modules/formatting/validation-checker.service';
import { PrismaService } from '../src/prisma.service';
import { PageLayoutApplierService } from '../src/modules/formatting/page-layout-applier.service';
import { TypographyApplierService } from '../src/modules/formatting/typography-applier.service';
import { HeadingStyleApplierService } from '../src/modules/formatting/heading-style-applier.service';
import { CrossReferenceUpdaterService } from '../src/modules/formatting/cross-reference-updater.service';
import { SectionOrderApplierService } from '../src/modules/formatting/section-order-applier.service';
import { PageNumberingApplierService } from '../src/modules/formatting/page-numbering-applier.service';
import { CoverPageGeneratorService } from '../src/modules/formatting/cover-page-generator.service';
import { ApprovalPageGeneratorService } from '../src/modules/formatting/approval-page-generator.service';
import { DeclarationGeneratorService } from '../src/modules/formatting/declaration-generator.service';
import { AbstractPageGeneratorService } from '../src/modules/formatting/abstract-page-generator.service';
import { TableOfContentsGeneratorService } from '../src/modules/formatting/table-of-contents-generator.service';
import { TableListGeneratorService } from '../src/modules/formatting/table-list-generator.service';
import { FigureListGeneratorService } from '../src/modules/formatting/figure-list-generator.service';
import { AbbreviationsGeneratorService } from '../src/modules/formatting/abbreviations-generator.service';
import { CVGeneratorService } from '../src/modules/formatting/cv-generator.service';
import type { FormattedBlock, SequenceNumberingSettings } from '../src/modules/formatting/formatting.types';

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
        PageLayoutApplierService,
        TypographyApplierService,
        HeadingStyleApplierService,
        SequenceNumberingApplierService,
        CrossReferenceUpdaterService,
        SectionOrderApplierService,
        PageNumberingApplierService,
        ValidationCheckerService,
        CoverPageGeneratorService,
        ApprovalPageGeneratorService,
        DeclarationGeneratorService,
        AbstractPageGeneratorService,
        TableOfContentsGeneratorService,
        TableListGeneratorService,
        FigureListGeneratorService,
        AbbreviationsGeneratorService,
        CVGeneratorService,
      ],
    }).compile();

    service = module.get<FormattingService>(FormattingService);
  });

  describe('preValidate', () => {
    it('returns error for empty document', () => {
      const result = service.preValidate([]);
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('EMPTY_DOCUMENT');
      expect(result[0].severity).toBe('ERROR');
    });

    it('returns errors for invalid blocks', () => {
      const blocks = [null, 'not-an-object', 42] as unknown[];
      const result = service.preValidate(blocks);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((e) => e.code === 'INVALID_BLOCK')).toBe(true);
    });

    it('returns warnings for blocks missing text', () => {
      const blocks = [{ blockType: 'PARAGRAPH' }];
      const result = service.preValidate(blocks);
      expect(result.some((e) => e.code === 'MISSING_BLOCK_TEXT')).toBe(true);
    });

    it('passes valid blocks', () => {
      const blocks = [
        { blockType: 'HEADING', text: 'Introduction', level: 1 },
        { blockType: 'PARAGRAPH', text: 'Body text here' },
      ];
      const result = service.preValidate(blocks);
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

  const defaultSettings: SequenceNumberingSettings = {
    mode: 'sequential',
    tableStart: 1,
    figureStart: 1,
    equationStart: 1,
    chapterSeparator: '.',
  };

  it('numbers tables sequentially', () => {
    const blocks: FormattedBlock[] = [
      {
        orderIndex: 0,
        blockType: 'TABLE',
        appliedRules: [],
        text: 'Sample data',
        metadata: {},
      },
      {
        orderIndex: 1,
        blockType: 'TABLE',
        appliedRules: [],
        text: 'More data',
        metadata: {},
      },
    ];

    const result = service.applySequenceNumbering(blocks, defaultSettings);

    expect(result[0].metadata?.sequence?.sequenceNumber).toBe(1);
    expect(result[1].metadata?.sequence?.sequenceNumber).toBe(2);
    expect(result[0].metadata?.sequence?.sequenceType).toBe('table');
  });

  it('numbers figures with custom start', () => {
    const blocks: FormattedBlock[] = [
      { orderIndex: 0, blockType: 'FIGURE', appliedRules: [], text: 'Chart', metadata: {} },
    ];

    const result = service.applySequenceNumbering(blocks, {
      ...defaultSettings,
      figureStart: 5,
    });

    expect(result[0].metadata?.sequence?.sequenceNumber).toBe(5);
    expect(result[0].metadata?.sequence?.sequenceType).toBe('figure');
  });

  it('numbers equations with custom start', () => {
    const blocks: FormattedBlock[] = [
      {
        orderIndex: 0,
        blockType: 'EQUATION',
        appliedRules: [],
        text: 'E = mc^2',
        metadata: {},
      },
    ];

    const result = service.applySequenceNumbering(blocks, {
      ...defaultSettings,
      equationStart: 10,
    });

    expect(result[0].metadata?.sequence?.sequenceNumber).toBe(10);
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

    const result = service.applySequenceNumbering(blocks, defaultSettings);

    expect(result[0].metadata?.sequence?.sequenceNumber).toBe(42);
  });

  it('leaves non-sequence blocks unchanged', () => {
    const blocks: FormattedBlock[] = [
      {
        orderIndex: 0,
        blockType: 'PARAGRAPH',
        appliedRules: [],
        text: 'Regular text',
        metadata: {},
      },
    ];

    const result = service.applySequenceNumbering(blocks, defaultSettings);

    expect(result[0].text).toBe('Regular text');
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
          metadata: {},
        },
      ];

      const result = service.runValidationChecks(blocks, {
        restrictions: { mainTextWordLimitMin: 100, mainTextWordLimitMax: 1000 },
      }, {
        mainTextWordLimitMin: 100,
        mainTextWordLimitMax: 1000,
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
          metadata: {},
        },
      ];

      const result = service.runValidationChecks(blocks, {
        restrictions: { mainTextWordLimitMin: 1, mainTextWordLimitMax: 100 },
      }, {
        mainTextWordLimitMin: 1,
        mainTextWordLimitMax: 100,
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
          metadata: { sequence: { sequenceNumber: 1, sequenceType: 'table', chapterNumber: null, formattedLabel: 'Tablo 1' } },
        },
        {
          orderIndex: 1,
          blockType: 'TABLE',
          appliedRules: [],
          text: 'Table 1 again',
          metadata: { sequence: { sequenceNumber: 1, sequenceType: 'table', chapterNumber: null, formattedLabel: 'Tablo 1' } },
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
          metadata: { sequence: { sequenceNumber: 1, sequenceType: 'figure', chapterNumber: null, formattedLabel: 'Şekil 1' } },
        },
        {
          orderIndex: 1,
          blockType: 'FIGURE',
          appliedRules: [],
          text: 'Figure 3',
          metadata: { sequence: { sequenceNumber: 3, sequenceType: 'figure', chapterNumber: null, formattedLabel: 'Şekil 3' } },
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
        fixedPages: { abstractTr: true },
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
          metadata: { semanticSectionType: 'ABSTRACT_TR' },
        },
      ];

      const result = service.runValidationChecks(blocks, {
        fixedPages: { abstractTr: true },
        sectionOrdering: { items: [] },
      });

      expect(result.some((e) => e.code === 'MISSING_SECTION')).toBe(false);
    });
  });
});
