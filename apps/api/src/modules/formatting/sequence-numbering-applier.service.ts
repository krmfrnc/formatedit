import { Injectable } from '@nestjs/common';
import type {
  FormattedBlock,
  SequenceNumberingSettings,
} from './formatting.types';

@Injectable()
export class SequenceNumberingApplierService {
  /**
   * Apply automatic numbering to TABLE, FIGURE, and EQUATION blocks.
   * Supports two modes:
   *   - 'sequential': 1, 2, 3, … (global counter)
   *   - 'chapterBased': 2.1, 2.2, 3.1, … (chapter.sequence counter)
   */
  applySequenceNumbering(
    blocks: FormattedBlock[],
    settings: SequenceNumberingSettings,
    chapterMap?: Map<number, number>,
  ): FormattedBlock[] {
    let tableCounter = settings.tableStart;
    let figureCounter = settings.figureStart;
    let equationCounter = settings.equationStart;

    // Chapter-based counters track per chapter
    const chapterCounters = new Map<number, { table: number; figure: number; equation: number }>();

    return blocks.map((block, index) => {
      const blockType = block.blockType.toUpperCase();
      const isSequenceable =
        blockType === 'TABLE' ||
        blockType === 'FIGURE' ||
        blockType === 'EQUATION';

      if (!isSequenceable) {
        return block;
      }

      const manualOverride = this.getManualOverride(block);
      const chapterNumber = chapterMap?.get(index) ?? null;

      let sequenceNumber: number;
      let formattedLabel: string;

      if (settings.mode === 'chapterBased' && chapterNumber !== null && chapterNumber > 0) {
        // Chapter-based numbering
        if (!chapterCounters.has(chapterNumber)) {
          chapterCounters.set(chapterNumber, { table: 1, figure: 1, equation: 1 });
        }

        const counters = chapterCounters.get(chapterNumber)!;

        if (blockType === 'TABLE') {
          sequenceNumber = manualOverride ?? counters.table;
          counters.table = sequenceNumber + 1;
        } else if (blockType === 'FIGURE') {
          sequenceNumber = manualOverride ?? counters.figure;
          counters.figure = sequenceNumber + 1;
        } else {
          sequenceNumber = manualOverride ?? counters.equation;
          counters.equation = sequenceNumber + 1;
        }

        const label = this.getLabel(blockType);
        formattedLabel = `${label} ${chapterNumber}${settings.chapterSeparator}${sequenceNumber}`;
      } else {
        // Sequential numbering
        if (blockType === 'TABLE') {
          sequenceNumber = manualOverride ?? tableCounter;
          if (manualOverride === null) tableCounter = sequenceNumber + 1;
        } else if (blockType === 'FIGURE') {
          sequenceNumber = manualOverride ?? figureCounter;
          if (manualOverride === null) figureCounter = sequenceNumber + 1;
        } else {
          sequenceNumber = manualOverride ?? equationCounter;
          if (manualOverride === null) equationCounter = sequenceNumber + 1;
        }

        const label = this.getLabel(blockType);
        formattedLabel = `${label} ${sequenceNumber}`;
      }

      const updatedText = this.updateBlockText(
        block.text,
        this.getLabel(blockType),
        formattedLabel,
      );

      return {
        ...block,
        text: updatedText,
        metadata: {
          ...block.metadata,
          sequence: {
            sequenceNumber,
            sequenceType: blockType.toLowerCase() as 'table' | 'figure' | 'equation',
            chapterNumber,
            formattedLabel,
          },
        },
        appliedRules: [...block.appliedRules, 'NUMBERING'],
      };
    });
  }

  private getManualOverride(block: FormattedBlock): number | null {
    const override = (block.metadata as Record<string, unknown>)?.manualSequenceNumber;
    if (typeof override === 'number' && override > 0) {
      return override;
    }
    return null;
  }

  private updateBlockText(
    text: string,
    label: string,
    formattedLabel: string,
  ): string {
    // Replace existing label pattern (e.g., "Table 1" or "Tablo 2.3")
    const existingPattern = new RegExp(
      `(${label}|Tablo|Sekil|Denklem|Table|Figure|Equation)\\s*\\d+([.:]\\d+)*`,
      'i',
    );

    if (existingPattern.test(text)) {
      return text.replace(existingPattern, formattedLabel);
    }

    return `${formattedLabel}: ${text}`;
  }

  private getLabel(blockType: string): string {
    switch (blockType.toUpperCase()) {
      case 'TABLE':
        return 'Tablo';
      case 'FIGURE':
        return 'Şekil';
      case 'EQUATION':
        return 'Denklem';
      default:
        return blockType;
    }
  }
}
