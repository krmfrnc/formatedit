import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import type { SemanticSectionType } from '../document-parser/document-parser.types';

const sectionTypeToSlotMap: Record<SemanticSectionType, string[]> = {
  ABSTRACT: ['abstract', 'ozet', 'summary'],
  INTRODUCTION: ['introduction', 'giris', 'giriş'],
  METHODS: [
    'methods',
    'methodology',
    'yontem',
    'yöntem',
    'materials-and-methods',
  ],
  RESULTS: ['results', 'bulgular', 'findings'],
  DISCUSSION: ['discussion', 'tartisma', 'tartışma'],
  CONCLUSION: ['conclusion', 'sonuc', 'sonuç', 'conclusions'],
  REFERENCES: ['references', 'kaynakca', 'kaynakça', 'bibliography'],
  APPENDIX: ['appendix', 'ekler', 'ek', 'annex', 'appendices'],
  BODY: [],
};

export interface SectionMatchResult {
  sectionType: SemanticSectionType;
  templateSlot: string | null;
  matchedPosition: number | null;
  confidence: number;
  status: 'matched' | 'missing-required' | 'missing-optional' | 'extra';
}

export interface SectionMatchingReport {
  matches: SectionMatchResult[];
  missingRequired: string[];
  missingOptional: string[];
  extraSections: string[];
  expectedOrder: string[];
  actualOrder: string[];
  orderCorrect: boolean;
}

interface WorkTypeSectionDefinition {
  requiredFixedPages: string[];
  optionalFixedPages: string[];
}

@Injectable()
export class SectionMatcherService {
  constructor(private readonly prismaService: PrismaService) {}

  async matchSectionsAgainstTemplate(
    detectedSections: Array<{
      sectionType: SemanticSectionType;
      templateSlot: string | null;
    }>,
    templateId?: string,
    workTypeSlug?: string,
  ): Promise<SectionMatchingReport> {
    const sectionDefinition = await this.resolveSectionDefinition(
      templateId,
      workTypeSlug,
    );
    const expectedOrder = this.buildExpectedOrder(sectionDefinition);
    const actualOrder = detectedSections
      .map((section) => section.templateSlot)
      .filter((slot): slot is string => slot !== null);

    const matches = this.computeMatches(
      detectedSections,
      expectedOrder,
      sectionDefinition,
    );
    const missingRequired = expectedOrder.filter(
      (slot) =>
        sectionDefinition.requiredFixedPages.includes(slot) &&
        !actualOrder.includes(slot),
    );
    const missingOptional = expectedOrder.filter(
      (slot) =>
        sectionDefinition.optionalFixedPages.includes(slot) &&
        !actualOrder.includes(slot),
    );
    const extraSections = actualOrder.filter(
      (slot) => !expectedOrder.includes(slot),
    );

    const orderCorrect = this.checkOrderConsistency(actualOrder, expectedOrder);

    return {
      matches,
      missingRequired,
      missingOptional,
      extraSections,
      expectedOrder,
      actualOrder,
      orderCorrect,
    };
  }

  async matchSectionsAgainstWorkType(
    detectedSections: Array<{
      sectionType: SemanticSectionType;
      templateSlot: string | null;
    }>,
    workTypeSlug: string,
  ): Promise<SectionMatchingReport> {
    return this.matchSectionsAgainstTemplate(
      detectedSections,
      undefined,
      workTypeSlug,
    );
  }

  getSectionSlotsForType(sectionType: SemanticSectionType): string[] {
    return sectionTypeToSlotMap[sectionType] ?? [];
  }

  getSectionTypeForSlot(slot: string): SemanticSectionType | null {
    for (const [type, slots] of Object.entries(sectionTypeToSlotMap)) {
      if (slots.includes(slot.toLowerCase())) {
        return type as SemanticSectionType;
      }
    }
    return null;
  }

  private async resolveSectionDefinition(
    templateId?: string,
    workTypeSlug?: string,
  ): Promise<WorkTypeSectionDefinition> {
    if (templateId) {
      const template = await this.prismaService.template.findUnique({
        where: { id: templateId },
      });

      if (template) {
        const params = template.templateParameters as Record<
          string,
          unknown
        > | null;
        const fixedPages =
          (params?.fixedPages as Record<string, unknown> | undefined) ?? {};
        const sectionOrdering =
          (params?.sectionOrdering as Record<string, unknown> | undefined) ??
          {};
        const items = Array.isArray(sectionOrdering.items)
          ? (sectionOrdering.items as string[])
          : [];

        const requiredPages: string[] = [];
        const optionalPages: string[] = [];

        for (const [key, value] of Object.entries(fixedPages)) {
          if (value === true) {
            requiredPages.push(key);
          } else if (value === 'optional') {
            optionalPages.push(key);
          }
        }

        if (items.length) {
          return {
            requiredFixedPages: [...new Set([...requiredPages, ...items])],
            optionalFixedPages: optionalPages,
          };
        }

        return {
          requiredFixedPages: requiredPages.length
            ? requiredPages
            : ['abstract', 'introduction', 'references'],
          optionalFixedPages: optionalPages.length
            ? optionalPages
            : ['acknowledgements', 'appendix'],
        };
      }
    }

    if (workTypeSlug) {
      const workType = await this.prismaService.workTypeSetting.findUnique({
        where: { slug: workTypeSlug },
      });

      if (workType) {
        return {
          requiredFixedPages: this.toStringArray(workType.requiredFixedPages),
          optionalFixedPages: this.toStringArray(workType.optionalFixedPages),
        };
      }
    }

    return {
      requiredFixedPages: ['abstract', 'introduction', 'references'],
      optionalFixedPages: ['acknowledgements', 'appendix', 'cv'],
    };
  }

  private buildExpectedOrder(definition: WorkTypeSectionDefinition): string[] {
    const coreSlots = [
      'abstract',
      'introduction',
      'methods',
      'results',
      'discussion',
      'conclusion',
      'references',
    ];
    const required = definition.requiredFixedPages.filter(
      (slot) => !coreSlots.includes(slot),
    );
    const optional = definition.optionalFixedPages.filter(
      (slot) => !coreSlots.includes(slot),
    );

    const order = [...coreSlots];
    const insertIndex = order.indexOf('introduction');
    for (const slot of required) {
      order.splice(insertIndex + 1, 0, slot);
    }
    for (const slot of optional) {
      order.push(slot);
    }

    return order;
  }

  private computeMatches(
    detectedSections: Array<{
      sectionType: SemanticSectionType;
      templateSlot: string | null;
    }>,
    expectedOrder: string[],
    definition: WorkTypeSectionDefinition,
  ): SectionMatchResult[] {
    return detectedSections.map((section) => {
      const slot = section.templateSlot;
      if (!slot) {
        return {
          sectionType: section.sectionType,
          templateSlot: null,
          matchedPosition: null,
          confidence: 0.3,
          status: 'extra',
        };
      }

      const position = expectedOrder.indexOf(slot);
      const isRequired = definition.requiredFixedPages.includes(slot);
      const isOptional = definition.optionalFixedPages.includes(slot);

      let status: SectionMatchResult['status'];
      if (position >= 0) {
        status = 'matched';
      } else if (isRequired) {
        status = 'missing-required';
      } else if (isOptional) {
        status = 'missing-optional';
      } else {
        status = 'extra';
      }

      const confidence = position >= 0 ? 0.9 : isRequired ? 0.5 : 0.4;

      return {
        sectionType: section.sectionType,
        templateSlot: slot,
        matchedPosition: position >= 0 ? position : null,
        confidence,
        status,
      };
    });
  }

  private checkOrderConsistency(
    actualOrder: string[],
    expectedOrder: string[],
  ): boolean {
    const filteredExpected = expectedOrder.filter((slot) =>
      actualOrder.includes(slot),
    );
    const filteredActual = actualOrder.filter((slot) =>
      filteredExpected.includes(slot),
    );

    for (let i = 0; i < filteredActual.length; i += 1) {
      if (filteredActual[i] !== filteredExpected[i]) {
        return false;
      }
    }

    return true;
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter(
        (entry): entry is string => typeof entry === 'string',
      );
    }
    return [];
  }
}
