import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface PdfGeneratorSettings {
  fontFamily: string;
  fontSizePt: number;
}

interface PdfPageLine {
  text: string;
  isHeading: boolean;
}

@Injectable()
export class PdfOutputGeneratorService {
  generatePdf(
    blocks: FormattedBlock[],
    settings: PdfGeneratorSettings,
  ): Buffer {
    const lines = this.toLines(blocks);
    const pages = this.paginate(lines, settings.fontSizePt);
    const pdf = this.buildPdfDocument(pages, settings);
    return Buffer.from(pdf, 'utf8');
  }

  private toLines(blocks: FormattedBlock[]): PdfPageLine[] {
    const lines: PdfPageLine[] = [];

    for (const block of blocks) {
      if (block.blockType === 'HEADING') {
        lines.push({
          text: block.text,
          isHeading: true,
        });
        continue;
      }

      const paragraphLines = this.wrapText(block.text, 90);
      if (paragraphLines.length === 0) {
        lines.push({ text: '', isHeading: false });
        continue;
      }

      for (const paragraphLine of paragraphLines) {
        lines.push({
          text: paragraphLine,
          isHeading: false,
        });
      }
    }

    return lines;
  }

  private paginate(lines: PdfPageLine[], fontSizePt: number): PdfPageLine[][] {
    const pageHeightPt = 792;
    const marginTopPt = 54;
    const marginBottomPt = 54;
    const leadingPt = Math.max(fontSizePt * 1.5, 14);
    const maxLinesPerPage = Math.max(
      12,
      Math.floor((pageHeightPt - marginTopPt - marginBottomPt) / leadingPt),
    );

    const pages: PdfPageLine[][] = [];
    let currentPage: PdfPageLine[] = [];

    for (const line of lines) {
      if (currentPage.length >= maxLinesPerPage) {
        pages.push(currentPage);
        currentPage = [];
      }

      currentPage.push(line);
    }

    if (currentPage.length || !pages.length) {
      pages.push(currentPage);
    }

    return pages;
  }

  private buildPdfDocument(
    pages: PdfPageLine[][],
    settings: PdfGeneratorSettings,
  ): string {
    const objects: string[] = [];

    const addObject = (content: string): number => {
      objects.push(content);
      return objects.length;
    };

    const fontObjectId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldFontObjectId = addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    );

    const pageObjectIds: number[] = [];
    const contentObjectIds: number[] = [];

    for (const page of pages) {
      const content = this.buildContentStream(page, settings);
      const contentObjectId = addObject(
        `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
      );
      contentObjectIds.push(contentObjectId);
      pageObjectIds.push(0);
    }

    const kidsPlaceholders = pages
      .map(() => '0 0 R')
      .join(' ');
    const pagesObjectId = addObject(
      `<< /Type /Pages /Kids [ ${kidsPlaceholders} ] /Count ${pages.length} >>`,
    );

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const pageObjectId = addObject(
        `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectIds[pageIndex]} 0 R >>`,
      );
      pageObjectIds[pageIndex] = pageObjectId;
    }

    objects[pagesObjectId - 1] = `<< /Type /Pages /Kids [ ${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(' ')} ] /Count ${pages.length} >>`;

    const catalogObjectId = addObject(
      `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`,
    );

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
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\n`;
    output += `startxref\n${xrefOffset}\n%%EOF`;

    return output;
  }

  private buildContentStream(page: PdfPageLine[], settings: PdfGeneratorSettings): string {
    const marginLeftPt = 54;
    const topStartPt = 738;
    const leadingPt = Math.max(settings.fontSizePt * 1.5, 14);
    const headingSizePt = Math.max(settings.fontSizePt + 4, settings.fontSizePt * 1.25);

    const operations: string[] = [];
    let cursorY = topStartPt;

    for (const line of page) {
      const fontName = line.isHeading ? '/F2' : '/F1';
      const fontSize = line.isHeading ? headingSizePt : settings.fontSizePt;
      const safeText = this.escapePdfText(line.text);

      operations.push('BT');
      operations.push(`${fontName} ${fontSize} Tf`);
      operations.push(`${marginLeftPt} ${cursorY} Td`);
      operations.push(`(${safeText}) Tj`);
      operations.push('ET');

      cursorY -= leadingPt;
    }

    return operations.join('\n');
  }

  private wrapText(text: string, width: number): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return [];
    }

    const words = normalized.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= width) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
      }
      current = word;
    }

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  private escapePdfText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r?\n/g, ' ');
  }
}
