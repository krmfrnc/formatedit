import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentParserService } from './document-parser.service';
import { DocxAiHeadingService } from './docx-ai-heading.service';
import { SectionMatcherService } from './section-matcher.service';
import { PrismaService } from '../../prisma.service';
import { QueueService } from '../queue/queue.service';

describe('DocumentParserService', () => {
  let service: DocumentParserService;

  const mockPrismaService = {
    document: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    documentVersion: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    documentSection: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockQueueService = {
    enqueueParseJob: jest.fn().mockResolvedValue({ id: '1' }),
    getDocumentPipelineSnapshot: jest.fn().mockResolvedValue({
      parsePending: 0,
      pdfConversionPending: 0,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentParserService,
        DocxAiHeadingService,
        SectionMatcherService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              key ? defaultValue ?? '' : '',
            getOrThrow: (key: string) => key,
          },
        },
      ],
    }).compile();

    service = module.get<DocumentParserService>(DocumentParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseDocxHtml', () => {
    it('parses simple HTML with headings', () => {
      const html = '<h1>Abstract</h1><p>Introduction content</p>';
      const blocks = service.parseDocxHtml(html);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].blockType).toBe('HEADING');
      expect(blocks[0].text).toContain('Abstract');
      expect(blocks[1].blockType).toBe('PARAGRAPH');
    });

    it('detects semantic sections correctly', () => {
      const html = `
        <h1>ABSTRACT</h1>
        <p>Summary here</p>
        <h1>INTRODUCTION</h1>
        <p>Intro content</p>
        <h1>REFERENCES</h1>
        <p>Reference 1</p>
      `;
      const blocks = service.parseDocxHtml(html);

      const abstractBlock = blocks.find(
        (b) => b.semanticSectionType === 'ABSTRACT',
      );
      const introBlock = blocks.find(
        (b) => b.semanticSectionType === 'INTRODUCTION',
      );
      const referencesBlock = blocks.find(
        (b) => b.semanticSectionType === 'REFERENCES',
      );

      expect(abstractBlock).toBeDefined();
      expect(abstractBlock?.semanticSectionType).toBe('ABSTRACT');
      expect(introBlock?.semanticSectionType).toBe('INTRODUCTION');
      expect(referencesBlock?.semanticSectionType).toBe('REFERENCES');
    });

    it('detects table labels', () => {
      const html = '<p>Tablo 1: Sample table content</p>';
      const blocks = service.parseDocxHtml(html);

      expect(blocks[0].blockType).toBe('TABLE');
      expect(blocks[0].tableOrFigureLabel).toContain('Tablo 1');
    });

    it('detects figure labels', () => {
      const html = '<p>Şekil 2: Diagram</p>';
      const blocks = service.parseDocxHtml(html);

      expect(blocks[0].blockType).toBe('FIGURE');
      expect(blocks[0].tableOrFigureLabel).toContain('Şekil 2');
    });

    it('detects citation patterns', () => {
      const html = '<p>According to prior work (Smith, 2020), this is valid.</p>';
      const blocks = service.parseDocxHtml(html);

      expect(blocks[0].hasCitation).toBe(true);
    });

    it('calculates confidence scores', () => {
      const html = '<h1>Chapter 1</h1>';
      const blocks = service.parseDocxHtml(html);

      expect(blocks[0].confidenceScore).toBeGreaterThan(0.5);
    });

    it('handles numbered headings', () => {
      const html = '<p>1. Introduction</p><p>2. Methods</p>';
      const blocks = service.parseDocxHtml(html);

      // `headingPattern` captures only the numeric component; the trailing
      // dot and whitespace are consumed as separators, not part of the group.
      expect(blocks[0].numberingPattern).toBe('1');
      expect(blocks[1].numberingPattern).toBe('2');
    });

    it('extracts runs with bold detection', () => {
      const html = '<p><strong>Important text</strong> normal text</p>';
      const blocks = service.parseDocxHtml(html);

      expect(blocks[0].runs).toHaveLength(1);
      expect(blocks[0].runs[0].isBold).toBe(true);
    });

    it('detects heading levels from numbering', () => {
      const html = '<p>1.2.3 Nested Section</p>';
      const blocks = service.parseDocxHtml(html);

      expect(blocks[0].level).toBeGreaterThanOrEqual(1);
    });

    it('truncates large documents', () => {
      const largeHtml = Array.from(
        { length: 2500 },
        (_, i) => `<p>Paragraph ${i}</p>`,
      ).join('');
      const blocks = service.parseDocxHtml(largeHtml);

      expect(blocks.length).toBeLessThanOrEqual(2000);
    });
  });

    it('handles empty HTML input', () => {
      const blocks = service.parseDocxHtml('');
      expect(blocks).toHaveLength(0);
    });

    it('handles whitespace-only paragraphs', () => {
      const html = '<p>   </p><p>Real content</p>';
      const blocks = service.parseDocxHtml(html);
      // Whitespace-only blocks are still emitted but should be PARAGRAPH
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const realBlock = blocks.find((b) => b.text.includes('Real content'));
      expect(realBlock).toBeDefined();
    });

    it('detects English table labels', () => {
      const html = '<p>Table 3: Comparison results</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].blockType).toBe('TABLE');
      expect(blocks[0].tableOrFigureLabel).toContain('Table 3');
    });

    it('detects English figure labels', () => {
      const html = '<p>Figure 4: Architecture diagram</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].blockType).toBe('FIGURE');
      expect(blocks[0].tableOrFigureLabel).toContain('Figure 4');
    });

    it('detects numeric citation patterns [1]', () => {
      const html = '<p>As shown in prior work [1, 3-5], the model converges.</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].hasCitation).toBe(true);
    });

    it('detects Turkish semantic sections (GIRIŞ, OZET)', () => {
      const html = `
        <h1>OZET</h1>
        <p>Turkish abstract content</p>
        <h1>GIRIŞ</h1>
        <p>Turkish intro content</p>
      `;
      const blocks = service.parseDocxHtml(html);
      const ozet = blocks.find((b) => b.semanticSectionType === 'ABSTRACT');
      const giris = blocks.find((b) => b.semanticSectionType === 'INTRODUCTION');
      expect(ozet).toBeDefined();
      expect(giris).toBeDefined();
    });

    it('detects multi-level numbering patterns', () => {
      const html = '<p>2.3.1 Sub-subsection</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].numberingPattern).toBe('2.3.1');
      expect(blocks[0].level).toBeGreaterThanOrEqual(3);
    });

    it('handles roman numeral headings', () => {
      const html = '<p>IV. Results and Discussion</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].numberingPattern).toBe('IV');
    });

    it('handles alpha headings', () => {
      const html = '<p>A. First Appendix Section</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].numberingPattern).toBe('A');
    });

    it('does not confuse prose capital + space as heading (E = mc2)', () => {
      const html = '<p>E = mc2 is a famous equation</p>';
      const blocks = service.parseDocxHtml(html);
      // Without the required dot after alpha letters, this would wrongly match
      expect(blocks[0].numberingPattern).toBeNull();
    });

    it('assigns sequential order indices', () => {
      const html = '<p>First</p><p>Second</p><p>Third</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].orderIndex).toBe(0);
      expect(blocks[1].orderIndex).toBe(1);
      expect(blocks[2].orderIndex).toBe(2);
    });

    it('detects equation markers', () => {
      const html = '<p>The equation y = mx + b describes a line.</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].hasEquation).toBe(true);
    });

    it('detects heading from h2/h3 tags with correct level', () => {
      const html = '<h2>Methods</h2><h3>Participants</h3>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].blockType).toBe('HEADING');
      expect(blocks[0].level).toBe(2);
      expect(blocks[1].blockType).toBe('HEADING');
      expect(blocks[1].level).toBe(3);
    });

    it('detects multiple citations in one paragraph', () => {
      const html = '<p>Studies (Smith, 2020; Jones, 2021) and [1-3] confirm this.</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].hasCitation).toBe(true);
    });

    it('does not mark regular parenthetical as citation', () => {
      const html = '<p>The value (approximately 100) was measured.</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].hasCitation).toBe(false);
    });

    it('detects REFERENCES section via KAYNAKÇA Turkish keyword', () => {
      const html = '<h1>KAYNAKÇA</h1><p>[1] Test ref</p>';
      const blocks = service.parseDocxHtml(html);
      const refs = blocks.find((b) => b.semanticSectionType === 'REFERENCES');
      expect(refs).toBeDefined();
    });

    it('detects CONCLUSION section', () => {
      const html = '<h1>CONCLUSION</h1><p>Final thoughts</p>';
      const blocks = service.parseDocxHtml(html);
      const conclusion = blocks.find((b) => b.semanticSectionType === 'CONCLUSION');
      expect(conclusion).toBeDefined();
    });

    it('handles nested inline formatting', () => {
      const html = '<p><strong><em>Bold italic text</em></strong> normal</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].runs.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0].runs[0].isBold).toBe(true);
    });

    it('detects page break markers', () => {
      const html = '<p style="page-break-before:always">New page content</p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
    });

    it('detects heading with bold short paragraph heuristic', () => {
      const html = '<p><strong>1.2 Literature Review</strong></p>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].blockType).toBe('HEADING');
      expect(blocks[0].numberingPattern).toBe('1.2');
      expect(blocks[0].level).toBe(2);
    });

    it('assigns null numberingPattern for un-numbered headings', () => {
      const html = '<h1>Abstract</h1>';
      const blocks = service.parseDocxHtml(html);
      expect(blocks[0].numberingPattern).toBeNull();
    });

  describe('getTemplateSlots', () => {
    it('returns default template order', () => {
      const slots = service.getTemplateSlots();

      expect(slots).toContain('abstract');
      expect(slots).toContain('introduction');
      expect(slots).toContain('references');
    });
  });
});
