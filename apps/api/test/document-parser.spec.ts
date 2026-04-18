import { ConfigService } from '@nestjs/config';
import { DocumentParserService } from '../src/modules/document-parser/document-parser.service';
import { DocxAiHeadingService } from '../src/modules/document-parser/docx-ai-heading.service';
import { SectionMatcherService } from '../src/modules/document-parser/section-matcher.service';
import { PrismaService } from '../src/prisma.service';
import { sampleDocxHtml } from './fixtures/docx-parser.fixture';

describe('DocumentParserService', () => {
  const mockPrismaService = {
    document: { findFirst: jest.fn(), update: jest.fn() },
    documentVersion: { findUnique: jest.fn(), update: jest.fn() },
    documentSection: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const parserService = new DocumentParserService(
    mockPrismaService,
    {} as never,
    new DocxAiHeadingService({
      get: () => 'false',
    } as unknown as ConfigService),
    new SectionMatcherService(mockPrismaService),
  );

  it('parses heading, citation, table, equation, and semantic sections from fixture html', () => {
    const blocks = parserService.parseDocxHtml(sampleDocxHtml);

    expect(blocks.length).toBeGreaterThanOrEqual(5);
    expect(blocks[0]).toMatchObject({
      blockType: 'HEADING',
      semanticSectionType: 'ABSTRACT',
      title: 'ABSTRACT',
    });
    expect(blocks.some((block) => block.blockType === 'TABLE')).toBe(true);
    expect(blocks.some((block) => block.hasCitation)).toBe(true);
    expect(blocks.some((block) => block.blockType === 'EQUATION')).toBe(true);
    expect(
      blocks.some((block) => block.semanticSectionType === 'REFERENCES'),
    ).toBe(true);
  });

  it('derives heading levels from numbering patterns when heading tags are absent', () => {
    const blocks = parserService.parseDocxHtml(
      '<p><strong>2.1 Methods</strong></p>',
    );

    expect(blocks[0]).toMatchObject({
      blockType: 'HEADING',
      level: 2,
      numberingPattern: '2.1',
    });
  });
});
