import { Injectable } from '@nestjs/common';
import type { FormattedBlock, PageLayoutSettings } from './formatting.types';

export interface DocxGeneratorSettings {
  fontFamily: string;
  fontSizePt: number;
  pageLayout: PageLayoutSettings;
}

type DocxParagraphAlignment =
  | 'left'
  | 'center'
  | 'right'
  | 'both'
  | 'start'
  | 'end';

// Centimeter to DOCX EMU/DXA helpers
const CM_TO_DXA = 567; // 1 cm ≈ 567 twips (DXA)
const PT_TO_HALF_PT = 2; // docx lib uses half-points for font sizes

@Injectable()
export class DocxOutputGeneratorService {
  /**
   * Generate a complete DOCX file from formatted blocks. Applies:
   *   - Document-level page layout (margins, paper size)
   *   - Multi-section support (for page numbering zones)
   *   - Full typography per block (font, size, bold/italic, alignment, spacing)
   *   - 5-level heading styles
   *   - Page break before level-1 headings
   *   - Table of contents placeholder (DOCX TOC field)
   */
  async generateDocx(
    generatedPages: FormattedBlock[],
    contentBlocks: FormattedBlock[],
    settings: DocxGeneratorSettings,
  ): Promise<Buffer> {
    try {
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        HeadingLevel,
        AlignmentType,
        PageBreak,
        TabStopPosition,
        TabStopType,
        Header,
        Footer,
        PageNumber,
        NumberFormat,
        SectionType,
      } = await import('docx');

      const allBlocks = [...generatedPages, ...contentBlocks];

      // Build sections from blocks (each page numbering zone becomes a DOCX section)
      const sections = this.buildSections(allBlocks, settings, {
        Document,
        Paragraph,
        TextRun,
        HeadingLevel,
        AlignmentType,
        PageBreak,
        TabStopPosition,
        TabStopType,
        Header,
        Footer,
        PageNumber,
        NumberFormat,
        SectionType,
      });

      const doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: settings.fontFamily,
                size: settings.fontSizePt * PT_TO_HALF_PT,
              },
              paragraph: {
                spacing: { line: 360 }, // 1.5 spacing (240 = single, 360 = 1.5)
              },
            },
          },
        },
        sections: sections as any,
      });

      const buffer = await Packer.toBuffer(doc);
      return buffer;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Cannot find module') ||
          error.message.includes('MODULE_NOT_FOUND'))
      ) {
        throw new Error(
          'docx library is not installed. Install it with: npm install docx',
        );
      }
      throw error;
    }
  }

  /**
   * Build DOCX section configurations from blocks.
   * Generated pages (cover, approval, etc.) go into a "frontMatter" section
   * with roman page numbering. Content blocks go into a "body" section
   * with arabic page numbering.
   */
  private buildSections(
    allBlocks: FormattedBlock[],
    settings: DocxGeneratorSettings,
    docxLib: Record<string, unknown>,
  ): unknown[] {
    const Paragraph = docxLib.Paragraph as new (opts: unknown) => unknown;
    const AlignmentType = docxLib.AlignmentType as Record<string, string>;
    const Header = docxLib.Header as new (opts: unknown) => unknown;
    const Footer = docxLib.Footer as new (opts: unknown) => unknown;
    const PageNumber = docxLib.PageNumber as new (opts: unknown) => unknown;
    const NumberFormat = docxLib.NumberFormat as Record<string, unknown>;

    const pageProps = this.buildPageProperties(settings.pageLayout);

    // Separate front matter (generated pages) from body content
    const frontMatterBlocks = allBlocks.filter(
      (b) => this.isFrontMatterSlot(b.metadata?.templateSlot as string),
    );
    const bodyBlocks = allBlocks.filter(
      (b) => !this.isFrontMatterSlot(b.metadata?.templateSlot as string),
    );

    const sections: unknown[] = [];

    // Section 1: Front matter (roman page numbers)
    if (frontMatterBlocks.length > 0) {
      const frontMatterChildren = frontMatterBlocks.map((block) =>
        this.blockToParagraph(block, settings, docxLib),
      );

      const frontPageProp = pageProps.page as Record<string, unknown> ?? {};
      sections.push({
        properties: {
          page: {
            ...frontPageProp,
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.LOWER_ROMAN,
            },
          },
        },
        headers: {
          default: new Header({
            children: [],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new PageNumber({}),
                ],
              }),
            ],
          }),
        },
        children: frontMatterChildren,
      });
    }

    // Section 2: Body (arabic page numbers)
    if (bodyBlocks.length > 0) {
      const bodyChildren = bodyBlocks.map((block) =>
        this.blockToParagraph(block, settings, docxLib),
      );

      const bodyPageProp = pageProps.page as Record<string, unknown> ?? {};
      sections.push({
        properties: {
          page: {
            ...bodyPageProp,
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        headers: {
          default: new Header({
            children: [],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new PageNumber({}),
                ],
              }),
            ],
          }),
        },
        children: bodyChildren,
      });
    }

    // Fallback: if no sections were created, add empty sections
    if (sections.length === 0) {
      sections.push({
        properties: pageProps,
        children: [],
      });
    }

    return sections;
  }

  /**
   * Convert a single FormattedBlock to a docx Paragraph.
   */
  private blockToParagraph(
    block: FormattedBlock,
    settings: DocxGeneratorSettings,
    docxLib: Record<string, unknown>,
  ): unknown {
    const {
      Paragraph,
      HeadingLevel,
      AlignmentType,
      PageBreak,
    } = docxLib as Record<string, new (...args: unknown[]) => unknown> & {
      AlignmentType: Record<string, string>;
      HeadingLevel: Record<string, unknown>;
    };

    const typo = block.metadata?.typography;
    const heading = block.metadata?.heading;

    // Determine font properties
    const fontFamily = typo?.fontFamily ?? settings.fontFamily;
    const fontSizePt = typo?.fontSizePt ?? settings.fontSizePt;
    const isBold = typo?.isBold ?? false;
    const isItalic = typo?.isItalic ?? false;
    const alignment = this.parseAlignment(
      typo?.alignment,
      AlignmentType as Record<string, string>,
    );

    // Build text run
    const children: unknown[] = [];

    // Add page break before level-1 headings (if configured)
    if (
      heading?.startsNewPage &&
      block.blockType === 'HEADING' &&
      heading.level === 1
    ) {
      children.push(
        new (PageBreak as new () => unknown)(),
      );
    }

    // Numbering pattern prefix for headings
    const numberPrefix = heading?.numberingPattern
      ? `${heading.numberingPattern} `
      : '';

    const fullHtml = numberPrefix ? `${numberPrefix}${block.text}` : block.text;

    const parsedRuns = this.parseHtmlToTextRuns(
      fullHtml,
      fontFamily,
      fontSizePt,
      isBold,
      isItalic,
      docxLib,
    );
    children.push(...parsedRuns);

    // Build paragraph options
    const paragraphOpts: Record<string, unknown> = {
      alignment,
      children,
      spacing: {
        before: (typo?.spacingBeforePt ?? 0) * 20, // pt to twips
        after: (typo?.spacingAfterPt ?? 6) * 20,
        line: this.lineSpacingToTwips(typo?.lineSpacing ?? 1.5),
      },
    };

    // First line indent
    if (typo?.firstLineIndentCm && typo.firstLineIndentCm > 0) {
      paragraphOpts.indent = {
        firstLine: Math.round(typo.firstLineIndentCm * CM_TO_DXA),
      };
    }

    // Heading level
    if (block.blockType === 'HEADING' && heading) {
      const headingLevelMap: Record<number, unknown> = {
        1: (HeadingLevel as Record<string, unknown>).HEADING_1,
        2: (HeadingLevel as Record<string, unknown>).HEADING_2,
        3: (HeadingLevel as Record<string, unknown>).HEADING_3,
        4: (HeadingLevel as Record<string, unknown>).HEADING_4,
        5: (HeadingLevel as Record<string, unknown>).HEADING_5,
      };

      const docxHeadingLevel =
        headingLevelMap[heading.level] ??
        (HeadingLevel as Record<string, unknown>).HEADING_1;

      paragraphOpts.heading = docxHeadingLevel;
    }

    return new (Paragraph as new (opts: unknown) => unknown)(paragraphOpts);
  }

  private parseHtmlToTextRuns(
    html: string,
    baseFontFamily: string,
    baseFontSizePt: number,
    baseIsBold: boolean,
    baseIsItalic: boolean,
    docxLib: Record<string, unknown>,
  ): unknown[] {
    const TextRun = docxLib.TextRun as new (opts: unknown) => unknown;
    const runs: unknown[] = [];
    
    // Fallback if not HTML (or if empty)
    if (!html || !html.includes('<')) {
      return [new TextRun({
        text: html || '',
        font: baseFontFamily,
        size: baseFontSizePt * PT_TO_HALF_PT,
        bold: baseIsBold,
        italics: baseIsItalic,
      })];
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { load } = require('cheerio');
    const $ = load(html);
    
    function walk(node: any, currentBold: boolean, currentItalic: boolean, currentUnderline: boolean, currentStrike: boolean) {
      if (node.type === 'text') {
        if (node.data) {
          // preserve spaces around tags, but might need trimming if entirely whitespace, 
          // let's just keep literal spaces as docx respects them 
          // (or text layout engine will handle wrapper spaces).
          runs.push(new TextRun({
            text: node.data,
            font: baseFontFamily,
            size: baseFontSizePt * PT_TO_HALF_PT,
            bold: currentBold,
            italics: currentItalic,
            underline: currentUnderline ? {} : undefined,
            strike: currentStrike,
          }));
        }
      } else if (node.type === 'tag') {
        const isBold = currentBold || node.name === 'strong' || node.name === 'b';
        const isItalic = currentItalic || node.name === 'em' || node.name === 'i';
        const isUnderline = currentUnderline || node.name === 'u';
        const isStrike = currentStrike || node.name === 's' || node.name === 'strike';
        
        if (node.name === 'br') {
           runs.push(new TextRun({ break: 1 }));
        }

        if (node.children) {
          node.children.forEach((child: any) => walk(child, isBold, isItalic, isUnderline, isStrike));
        }
      }
    }

    $('body').contents().each((_: unknown, el: any) => {
      walk(el, baseIsBold, baseIsItalic, false, false);
    });

    if (runs.length === 0) {
       runs.push(new TextRun({ text: '' }));
    }
    return runs;
  }

  /**
   * Build DOCX page properties from PageLayoutSettings.
   */
  private buildPageProperties(layout: PageLayoutSettings): Record<string, unknown> {
    const isLetter = layout.paperSize === 'Letter';

    // Page dimensions in EMU (English Metric Units)
    let pageWidth = 11906; // A4 width in twips
    let pageHeight = 16838; // A4 height in twips

    if (isLetter) {
      pageWidth = 12240;
      pageHeight = 15840;
    }

    if (layout.orientation === 'landscape') {
      [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }

    return {
      page: {
        size: {
          width: pageWidth,
          height: pageHeight,
          orientation: layout.orientation === 'landscape' ? 'landscape' : 'portrait',
        },
        margin: {
          top: Math.round(layout.marginTopCm * CM_TO_DXA),
          bottom: Math.round(layout.marginBottomCm * CM_TO_DXA),
          left: Math.round(layout.marginLeftCm * CM_TO_DXA),
          right: Math.round(layout.marginRightCm * CM_TO_DXA),
          header: Math.round(layout.headerMarginCm * CM_TO_DXA),
          footer: Math.round(layout.footerMarginCm * CM_TO_DXA),
          gutter: Math.round(layout.gutterCm * CM_TO_DXA),
        },
      },
    };
  }

  private parseAlignment(
    alignment: string | undefined,
    AlignmentType: Record<string, string>,
  ): DocxParagraphAlignment | undefined {
    if (!alignment) {
      return undefined;
    }

    const normalized = alignment.toLowerCase();
    if (normalized === 'left') return AlignmentType.LEFT as DocxParagraphAlignment;
    if (normalized === 'center') return AlignmentType.CENTER as DocxParagraphAlignment;
    if (normalized === 'right') return AlignmentType.RIGHT as DocxParagraphAlignment;
    if (normalized === 'justify') return AlignmentType.BOTH as DocxParagraphAlignment;

    return undefined;
  }

  private lineSpacingToTwips(lineSpacing: number): number {
    // 240 twips = single spacing, multiply by line spacing factor
    return Math.round(240 * lineSpacing);
  }

  private isFrontMatterSlot(slot: string | undefined): boolean {
    if (!slot) return false;
    const frontMatterSlots = [
      'COVER', 'APPROVAL', 'DECLARATION', 'ACKNOWLEDGMENT',
      'ABSTRACT_TR', 'ABSTRACT_EN',
      'TABLE_OF_CONTENTS', 'TABLE_LIST', 'FIGURE_LIST',
      'ABBREVIATIONS',
    ];
    return frontMatterSlots.includes(slot.toUpperCase());
  }
}
