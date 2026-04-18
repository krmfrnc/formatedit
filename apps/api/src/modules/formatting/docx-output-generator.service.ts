import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface DocxGeneratorSettings {
  fontFamily: string;
  fontSizePt: number;
}

type DocxParagraphAlignment =
  | 'left'
  | 'center'
  | 'right'
  | 'both'
  | 'start'
  | 'end'
  | 'mediumKashida'
  | 'distribute'
  | 'numTab'
  | 'highKashida'
  | 'lowKashida'
  | 'thaiDistribute';

@Injectable()
export class DocxOutputGeneratorService {
  async generateDocx(
    blocks: FormattedBlock[],
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
      } = await import('docx');

      const children = blocks.map((block) => {
        const textRun = new TextRun({
          text: block.text,
          font: settings.fontFamily,
          size: settings.fontSizePt * 2,
        });

        if (block.blockType === 'HEADING') {
          const level = (block.metadata?.level as number) ?? 1;
          const headingLevelMap: Record<number, unknown> = {
            1: HeadingLevel.HEADING_1,
            2: HeadingLevel.HEADING_2,
            3: HeadingLevel.HEADING_3,
            4: HeadingLevel.HEADING_4,
            5: HeadingLevel.HEADING_5,
            6: HeadingLevel.HEADING_6,
          };

          return new Paragraph({
            heading: (headingLevelMap[level] ??
              HeadingLevel.HEADING_1) as never,
            alignment: this.parseAlignment(
              block.metadata?.alignment as string | undefined,
              AlignmentType,
            ),
            children: [textRun],
          });
        }

        if (block.blockType === 'TABLE') {
          return new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: block.text,
                font: settings.fontFamily,
                size: settings.fontSizePt * 2,
                bold: true,
              }),
            ],
          });
        }

        if (block.blockType === 'FIGURE') {
          return new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: block.text,
                font: settings.fontFamily,
                size: settings.fontSizePt * 2,
                italics: true,
              }),
            ],
          });
        }

        return new Paragraph({
          alignment: this.parseAlignment(
            block.metadata?.alignment as string | undefined,
            AlignmentType,
          ),
          children: [textRun],
        });
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children,
          },
        ],
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

  private parseAlignment(
    alignment: string | undefined,
    AlignmentType: Record<string, string>,
  ): DocxParagraphAlignment | undefined {
    if (!alignment) {
      return undefined;
    }

    const normalized = alignment.toLowerCase();
    if (normalized === 'left') {
      return AlignmentType.LEFT as DocxParagraphAlignment;
    }
    if (normalized === 'center') {
      return AlignmentType.CENTER as DocxParagraphAlignment;
    }
    if (normalized === 'right') {
      return AlignmentType.RIGHT as DocxParagraphAlignment;
    }
    if (normalized === 'justify') {
      return AlignmentType.BOTH as DocxParagraphAlignment;
    }

    return undefined;
  }
}
