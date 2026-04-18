import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

interface SequenceEntry {
  type: 'table' | 'figure' | 'equation';
  number: number;
  id?: string;
}

@Injectable()
export class CrossReferenceUpdaterService {
  updateCrossReferences(blocks: FormattedBlock[]): FormattedBlock[] {
    const sequenceMap = this.buildSequenceMap(blocks);

    return blocks.map((block) => {
      const updatedText = this.replaceCrossReferences(block.text, sequenceMap);

      if (updatedText !== block.text) {
        return {
          ...block,
          text: updatedText,
          metadata: {
            ...(block.metadata ?? {}),
            crossReferencesUpdated: true,
          },
        };
      }

      return block;
    });
  }

  private buildSequenceMap(blocks: FormattedBlock[]): SequenceEntry[] {
    const entries: SequenceEntry[] = [];

    for (const block of blocks) {
      const blockType = block.blockType.toUpperCase();
      const sequenceNumber = block.metadata?.sequenceNumber as
        | number
        | undefined;

      if (sequenceNumber === undefined) {
        continue;
      }

      if (blockType === 'TABLE') {
        entries.push({
          type: 'table',
          number: sequenceNumber,
          id: block.metadata?.id as string | undefined,
        });
      } else if (blockType === 'FIGURE') {
        entries.push({
          type: 'figure',
          number: sequenceNumber,
          id: block.metadata?.id as string | undefined,
        });
      } else if (blockType === 'EQUATION') {
        entries.push({
          type: 'equation',
          number: sequenceNumber,
          id: block.metadata?.id as string | undefined,
        });
      }
    }

    return entries;
  }

  private replaceCrossReferences(
    text: string,
    sequenceMap: SequenceEntry[],
  ): string {
    let result = text;

    const refPatterns = [
      { pattern: /\[ref:table:(\w+|@(\d+))\]/gi, type: 'table' as const },
      { pattern: /\[ref:figure:(\w+|@(\d+))\]/gi, type: 'figure' as const },
      { pattern: /\[ref:equation:(\w+|@(\d+))\]/gi, type: 'equation' as const },
    ];

    for (const { pattern, type } of refPatterns) {
      result = result.replace(pattern, (match: string, idOrIndex: string) => {
        const entry = this.findSequenceEntry(sequenceMap, type, idOrIndex);
        if (entry) {
          const label = this.getLabel(type);
          return `${label} ${entry.number}`;
        }
        return match;
      });
    }

    return result;
  }

  private findSequenceEntry(
    sequenceMap: SequenceEntry[],
    type: 'table' | 'figure' | 'equation',
    identifier: string,
  ): SequenceEntry | null {
    if (identifier.startsWith('@')) {
      const index = parseInt(identifier.substring(1), 10);
      let count = 0;
      for (const entry of sequenceMap) {
        if (entry.type === type) {
          count += 1;
          if (count === index) {
            return entry;
          }
        }
      }
      return null;
    }

    return (
      sequenceMap.find(
        (entry) => entry.type === type && entry.id === identifier,
      ) ?? null
    );
  }

  private getLabel(type: 'table' | 'figure' | 'equation'): string {
    switch (type) {
      case 'table':
        return 'Table';
      case 'figure':
        return 'Figure';
      case 'equation':
        return 'Equation';
    }
  }
}
