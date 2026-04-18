import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface TableListItem {
  label: string;
  title: string;
  pageNumber?: number;
}

@Injectable()
export class TableListGeneratorService {
  generateTableList(tables: TableListItem[]): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    blocks.push({
      orderIndex: 0,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: 'LIST OF TABLES',
      metadata: {
        level: 1,
        fontFamily: 'Times New Roman',
        fontSizePt: 16,
        isBold: true,
        isItalic: false,
        alignment: 'center',
        spacingBeforePt: 0,
        spacingAfterPt: 24,
      },
    });

    tables.forEach((table, index) => {
      blocks.push({
        orderIndex: index + 1,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: `${table.label} ${table.title}${table.pageNumber ? `\t${table.pageNumber}` : ''}`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'left',
          lineSpacing: 1.5,
          firstLineIndentCm: 0,
        },
      });
    });

    return blocks;
  }
}
