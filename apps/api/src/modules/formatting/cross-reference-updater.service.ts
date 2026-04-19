import { Injectable } from '@nestjs/common';
import type { FormattedBlock, FormattingValidationError } from './formatting.types';

interface SequenceEntry {
  type: 'table' | 'figure' | 'equation';
  number: number;
  chapterNumber: number | null;
  formattedLabel: string;
  id?: string;
}

@Injectable()
export class CrossReferenceUpdaterService {
  /**
   * Scan all blocks and replace cross-reference markers with actual
   * formatted labels. Supports both:
   *   - Structured markers: [ref:table:id] or [ref:figure:@2]
   *   - Natural language: "bkz. Tablo 3", "see Figure 2.1"
   */
  updateCrossReferences(blocks: FormattedBlock[]): FormattedBlock[] {
    const sequenceMap = this.buildSequenceMap(blocks);

    return blocks.map((block) => {
      let updatedText = block.text;

      // 1. Replace structured markers [ref:type:id]
      updatedText = this.replaceStructuredRefs(updatedText, sequenceMap);

      // 2. Replace natural language references with updated numbers
      updatedText = this.replaceNaturalLanguageRefs(updatedText, sequenceMap);

      if (updatedText !== block.text) {
        return {
          ...block,
          text: updatedText,
          metadata: {
            ...block.metadata,
            crossReferencesUpdated: true,
          },
        };
      }

      return block;
    });
  }

  /**
   * Collect all broken cross-references as validation errors.
   */
  findBrokenReferences(blocks: FormattedBlock[]): FormattingValidationError[] {
    const errors: FormattingValidationError[] = [];
    const sequenceMap = this.buildSequenceMap(blocks);

    blocks.forEach((block, index) => {
      // Check for unresolved structured markers
      const unresolvedPattern = /\[ref:(table|figure|equation):(\w+|@\d+)\]/gi;
      let match: RegExpExecArray | null;

      while ((match = unresolvedPattern.exec(block.text)) !== null) {
        const type = match[1].toLowerCase() as 'table' | 'figure' | 'equation';
        const identifier = match[2];
        const entry = this.findSequenceEntry(sequenceMap, type, identifier);

        if (!entry) {
          errors.push({
            severity: 'WARNING',
            code: 'BROKEN_CROSS_REFERENCE',
            message: `Unresolved cross-reference: ${match[0]}`,
            blockIndex: index,
          });
        }
      }
    });

    return errors;
  }

  // ─── Private helpers ────────────────────────

  private buildSequenceMap(blocks: FormattedBlock[]): SequenceEntry[] {
    const entries: SequenceEntry[] = [];

    for (const block of blocks) {
      const seq = block.metadata?.sequence;
      if (!seq) {
        continue;
      }

      entries.push({
        type: seq.sequenceType,
        number: seq.sequenceNumber,
        chapterNumber: seq.chapterNumber ?? null,
        formattedLabel: seq.formattedLabel,
        id: (block.metadata as Record<string, unknown>)?.id as string | undefined,
      });
    }

    return entries;
  }

  private replaceStructuredRefs(
    text: string,
    sequenceMap: SequenceEntry[],
  ): string {
    let result = text;

    const refPatterns = [
      { pattern: /\[ref:table:(\w+|@\d+)\]/gi, type: 'table' as const },
      { pattern: /\[ref:figure:(\w+|@\d+)\]/gi, type: 'figure' as const },
      { pattern: /\[ref:equation:(\w+|@\d+)\]/gi, type: 'equation' as const },
    ];

    for (const { pattern, type } of refPatterns) {
      result = result.replace(pattern, (match: string, idOrIndex: string) => {
        const entry = this.findSequenceEntry(sequenceMap, type, idOrIndex);
        if (entry) {
          return entry.formattedLabel;
        }
        return match; // Leave unresolved markers for later validation
      });
    }

    return result;
  }

  private replaceNaturalLanguageRefs(
    text: string,
    sequenceMap: SequenceEntry[],
  ): string {
    let result = text;

    // Turkish and English natural-language patterns
    const naturalPatterns = [
      { pattern: /(Tablo|Table)\s+(\d+(?:\.\d+)*)/gi, type: 'table' as const },
      { pattern: /(Şekil|Sekil|Figure)\s+(\d+(?:\.\d+)*)/gi, type: 'figure' as const },
      { pattern: /(Denklem|Equation)\s+(\d+(?:\.\d+)*)/gi, type: 'equation' as const },
    ];

    for (const { pattern, type } of naturalPatterns) {
      result = result.replace(
        pattern,
        (match: string, _label: string, numberStr: string) => {
          // Find the entry whose formatted label matches this number
          const entry = this.findEntryByNumber(sequenceMap, type, numberStr);
          if (entry) {
            return entry.formattedLabel;
          }
          return match; // Leave as-is if no matching entry
        },
      );
    }

    return result;
  }

  private findSequenceEntry(
    sequenceMap: SequenceEntry[],
    type: 'table' | 'figure' | 'equation',
    identifier: string,
  ): SequenceEntry | null {
    // Index-based: @1, @2, ...
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

    // ID-based lookup
    return (
      sequenceMap.find(
        (entry) => entry.type === type && entry.id === identifier,
      ) ?? null
    );
  }

  private findEntryByNumber(
    sequenceMap: SequenceEntry[],
    type: 'table' | 'figure' | 'equation',
    numberStr: string,
  ): SequenceEntry | null {
    // For chapter-based: "2.3" → chapter 2, sequence 3
    if (numberStr.includes('.')) {
      const parts = numberStr.split('.');
      const chapter = parseInt(parts[0], 10);
      const seqNum = parseInt(parts[1], 10);

      return (
        sequenceMap.find(
          (entry) =>
            entry.type === type &&
            entry.chapterNumber === chapter &&
            entry.number === seqNum,
        ) ?? null
      );
    }

    // For sequential: "3" → sequence number 3
    const seqNum = parseInt(numberStr, 10);
    return (
      sequenceMap.find(
        (entry) => entry.type === type && entry.number === seqNum,
      ) ?? null
    );
  }
}
