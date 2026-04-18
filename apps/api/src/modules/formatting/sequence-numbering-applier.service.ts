import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface SequenceNumberingSettings {
  tableStart: number;
  figureStart: number;
  equationStart: number;
}

@Injectable()
export class SequenceNumberingApplierService {
  applySequenceNumbering(
    blocks: FormattedBlock[],
    settings: SequenceNumberingSettings,
  ): FormattedBlock[] {
    let tableCounter = settings.tableStart;
    let figureCounter = settings.figureStart;
    let equationCounter = settings.equationStart;

    return blocks.map((block) => {
      const blockType = block.blockType.toUpperCase();

      if (blockType === 'TABLE') {
        const manualOverride = this.getManualOverride(block);
        const number = manualOverride ?? tableCounter;
        if (manualOverride === null) {
          tableCounter += 1;
        }

        return {
          ...block,
          text: this.updateBlockText(block.text, 'Table', number),
          metadata: {
            ...(block.metadata ?? {}),
            sequenceNumber: number,
            sequenceType: 'table',
          },
          appliedRules: [...block.appliedRules, 'NUMBERING'],
        };
      }

      if (blockType === 'FIGURE') {
        const manualOverride = this.getManualOverride(block);
        const number = manualOverride ?? figureCounter;
        if (manualOverride === null) {
          figureCounter += 1;
        }

        return {
          ...block,
          text: this.updateBlockText(block.text, 'Figure', number),
          metadata: {
            ...(block.metadata ?? {}),
            sequenceNumber: number,
            sequenceType: 'figure',
          },
          appliedRules: [...block.appliedRules, 'NUMBERING'],
        };
      }

      if (blockType === 'EQUATION') {
        const manualOverride = this.getManualOverride(block);
        const number = manualOverride ?? equationCounter;
        if (manualOverride === null) {
          equationCounter += 1;
        }

        return {
          ...block,
          text: this.updateBlockText(block.text, 'Equation', number),
          metadata: {
            ...(block.metadata ?? {}),
            sequenceNumber: number,
            sequenceType: 'equation',
          },
          appliedRules: [...block.appliedRules, 'NUMBERING'],
        };
      }

      return block;
    });
  }

  private getManualOverride(block: FormattedBlock): number | null {
    const override = block.metadata?.manualSequenceNumber;
    if (typeof override === 'number' && override > 0) {
      return override;
    }
    return null;
  }

  private updateBlockText(text: string, label: string, number: number): string {
    const existingPattern = new RegExp(`${label}\\s*\\d+`, 'i');
    if (existingPattern.test(text)) {
      return text.replace(existingPattern, `${label} ${number}`);
    }

    return `${label} ${number}: ${text}`;
  }
}
