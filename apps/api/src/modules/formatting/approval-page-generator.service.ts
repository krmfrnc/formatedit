import { Injectable } from '@nestjs/common';
import type { ApprovalPageConfig, FormattedBlock, JuryMember } from './formatting.types';

export interface ApprovalPageGeneratorInput extends ApprovalPageConfig {
  fontFamily: string;
  fontSizePt: number;
}

@Injectable()
export class ApprovalPageGeneratorService {
  /**
   * Generate approval page with dynamic jury members.
   * Font/size come from template parameters.
   */
  generateApprovalPage(input: ApprovalPageGeneratorInput): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];
    const font = input.fontFamily;
    const basePt = input.fontSizePt;

    // Title
    blocks.push(this.buildBlock(blocks.length, 'HEADING', 'ONAY SAYFASI', {
      typography: {
        fontFamily: font, fontSizePt: basePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: true },
      templateSlot: 'APPROVAL',
    }));

    // Thesis title
    blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', input.title, {
      typography: {
        fontFamily: font, fontSizePt: basePt, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 18, firstLineIndentCm: 0,
      },
      templateSlot: 'APPROVAL',
    }));

    // Author name
    blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', `Hazırlayan: ${input.author}`, {
      typography: {
        fontFamily: font, fontSizePt: basePt, isBold: false,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 12, firstLineIndentCm: 0,
      },
      templateSlot: 'APPROVAL',
    }));

    // Defense date
    blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', `Savunma Tarihi: ${input.defenseDate}`, {
      typography: {
        fontFamily: font, fontSizePt: basePt, isBold: false,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      templateSlot: 'APPROVAL',
    }));

    // Voting type
    const votingText = input.votingType === 'unanimous'
      ? 'Oybirliği ile kabul edilmiştir.'
      : 'Oyçokluğu ile kabul edilmiştir.';

    blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', votingText, {
      typography: {
        fontFamily: font, fontSizePt: basePt, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 36, firstLineIndentCm: 0,
      },
      templateSlot: 'APPROVAL',
    }));

    // Jury members — dynamic
    const sortedJury = this.sortJuryMembers(input.juryMembers);

    for (const member of sortedJury) {
      const roleLabel = this.getRoleLabel(member.role);

      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH',
        `${member.title} ${member.name}`,
        {
          typography: {
            fontFamily: font, fontSizePt: basePt, isBold: true,
            alignment: 'left', lineSpacing: 1.5,
            spacingBeforePt: 12, spacingAfterPt: 0, firstLineIndentCm: 0,
          },
          templateSlot: 'APPROVAL',
        },
      ));

      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', roleLabel, {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'left', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 0, firstLineIndentCm: 0,
        },
        templateSlot: 'APPROVAL',
      }));

      // Signature line
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH',
        'İmza: _______________________',
        {
          typography: {
            fontFamily: font, fontSizePt: basePt, isBold: false,
            alignment: 'left', lineSpacing: 1.5,
            spacingBeforePt: 6, spacingAfterPt: 18, firstLineIndentCm: 0,
          },
          templateSlot: 'APPROVAL',
        },
      ));
    }

    return blocks;
  }

  /**
   * Sort jury members: chair first, then advisor, co-advisor, committee.
   */
  private sortJuryMembers(members: JuryMember[]): JuryMember[] {
    const roleOrder: Record<string, number> = {
      chair: 0,
      advisor: 1,
      'co-advisor': 2,
      committee: 3,
    };

    return [...members].sort(
      (a, b) => (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4),
    );
  }

  private getRoleLabel(role: JuryMember['role']): string {
    switch (role) {
      case 'chair':
        return 'Jüri Başkanı';
      case 'advisor':
        return 'Tez Danışmanı';
      case 'co-advisor':
        return 'Eş Danışman';
      case 'committee':
        return 'Jüri Üyesi';
    }
  }

  private buildBlock(
    orderIndex: number,
    blockType: string,
    text: string,
    metadata: Record<string, unknown>,
  ): FormattedBlock {
    return {
      orderIndex,
      blockType,
      appliedRules: ['PAGE_LAYOUT', 'FIXED_PAGE'],
      text,
      metadata: metadata as FormattedBlock['metadata'],
    };
  }
}
