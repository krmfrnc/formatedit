import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

const defaultSectionOrder = [
  'COVER',
  'APPROVAL',
  'DECLARATION',
  'ABSTRACT',
  'TABLE_OF_CONTENTS',
  'TABLE_LIST',
  'FIGURE_LIST',
  'ABBREVIATIONS',
  'INTRODUCTION',
  'METHODS',
  'RESULTS',
  'DISCUSSION',
  'CONCLUSION',
  'REFERENCES',
  'APPENDIX',
  'CV',
  'BODY',
];

@Injectable()
export class SectionOrderApplierService {
  applySectionOrder(
    blocks: FormattedBlock[],
    sectionOrder: string[],
  ): FormattedBlock[] {
    const order = sectionOrder.length > 0 ? sectionOrder : defaultSectionOrder;

    const orderMap = new Map<string, number>();
    order.forEach((section, index) => {
      orderMap.set(section.toUpperCase(), index);
    });

    const unknownOrder = order.length;

    const sorted = [...blocks].sort((a, b) => {
      const sectionA = this.getSectionType(a);
      const sectionB = this.getSectionType(b);

      const orderA = orderMap.get(sectionA) ?? unknownOrder;
      const orderB = orderMap.get(sectionB) ?? unknownOrder;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.orderIndex - b.orderIndex;
    });

    return sorted.map((block, index) => ({
      ...block,
      orderIndex: index,
    }));
  }

  private getSectionType(block: FormattedBlock): string {
    const semanticType = (block.metadata?.semanticSectionType as string) ?? '';
    if (semanticType) {
      return semanticType.toUpperCase();
    }

    const templateSlot = (block.metadata?.templateSlot as string) ?? '';
    if (templateSlot) {
      return templateSlot.toUpperCase();
    }

    return block.blockType.toUpperCase();
  }
}
