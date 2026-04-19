import type {
  HeadingStyleLevel,
  PageLayoutSettings,
  PageNumberingSettings,
  RestrictionSettings,
  SectionOrderSettings,
  SequenceNumberingSettings,
  TableFigureFormatSettings,
  TypographySettings,
} from './formatting.types';

// ──────────────────────────────────────────────
// Limits
// ──────────────────────────────────────────────

export const maxFormattingErrors = 100;

// ──────────────────────────────────────────────
// Default font & spacing
// ──────────────────────────────────────────────

export const defaultFontFamily = 'Times New Roman';
export const defaultFontSizePt = 12;
export const defaultLineSpacing = 1.5;

export const defaultMarginCm = {
  top: 4,
  bottom: 3,
  left: 3,
  right: 3,
};

// ──────────────────────────────────────────────
// Severity constants
// ──────────────────────────────────────────────

export const severityLevels = {
  ERROR: 'ERROR' as const,
  WARNING: 'WARNING' as const,
  INFO: 'INFO' as const,
};

// ──────────────────────────────────────────────
// Default page layout settings
// ──────────────────────────────────────────────

export const defaultPageLayout: PageLayoutSettings = {
  paperSize: 'A4',
  orientation: 'portrait',
  marginTopCm: defaultMarginCm.top,
  marginBottomCm: defaultMarginCm.bottom,
  marginLeftCm: defaultMarginCm.left,
  marginRightCm: defaultMarginCm.right,
  headerMarginCm: 2.5,
  footerMarginCm: 2.5,
  gutterCm: 0,
};

// ──────────────────────────────────────────────
// Default typography settings
// ──────────────────────────────────────────────

export const defaultTypography: TypographySettings = {
  fontFamily: defaultFontFamily,
  fontSizePt: defaultFontSizePt,
  lineSpacing: defaultLineSpacing,
  paragraphSpacingBeforePt: 0,
  paragraphSpacingAfterPt: 6,
  alignment: 'justify',
  firstLineIndentCm: 1.25,
  captionFontSizePt: 10,
  footnoteFontSizePt: 10,
  tableContentFontSizePt: 10,
  pageNumberFontSizePt: 12,
};

// ──────────────────────────────────────────────
// Default heading levels (5 levels v5 §4.9.3)
// ──────────────────────────────────────────────

export const defaultHeadingLevels: HeadingStyleLevel[] = [
  {
    level: 1,
    fontFamily: defaultFontFamily,
    fontSizePt: 16,
    isBold: true,
    isItalic: false,
    isUpperCase: true,
    isInline: false,
    alignment: 'center',
    spacingBeforePt: 12,
    spacingAfterPt: 6,
    numberingFormat: null,
    startsNewPage: true,
  },
  {
    level: 2,
    fontFamily: defaultFontFamily,
    fontSizePt: 14,
    isBold: true,
    isItalic: false,
    isUpperCase: false,
    isInline: false,
    alignment: 'left',
    spacingBeforePt: 10,
    spacingAfterPt: 4,
    numberingFormat: null,
    startsNewPage: false,
  },
  {
    level: 3,
    fontFamily: defaultFontFamily,
    fontSizePt: 13,
    isBold: true,
    isItalic: false,
    isUpperCase: false,
    isInline: false,
    alignment: 'left',
    spacingBeforePt: 8,
    spacingAfterPt: 4,
    numberingFormat: null,
    startsNewPage: false,
  },
  {
    level: 4,
    fontFamily: defaultFontFamily,
    fontSizePt: 12,
    isBold: true,
    isItalic: false,
    isUpperCase: false,
    isInline: false,
    alignment: 'left',
    spacingBeforePt: 6,
    spacingAfterPt: 2,
    numberingFormat: null,
    startsNewPage: false,
  },
  {
    level: 5,
    fontFamily: defaultFontFamily,
    fontSizePt: 12,
    isBold: false,
    isItalic: true,
    isUpperCase: false,
    isInline: true,
    alignment: 'left',
    spacingBeforePt: 6,
    spacingAfterPt: 2,
    numberingFormat: null,
    startsNewPage: false,
  },
];

// ──────────────────────────────────────────────
// Default page numbering settings
// ──────────────────────────────────────────────

export const defaultPageNumbering: PageNumberingSettings = {
  zones: [
    {
      id: 'frontMatter',
      startPage: 1,
      endPage: null,
      style: 'roman',
      startNumber: 1,
      position: 'bottom-center',
      fontFamily: defaultFontFamily,
      fontSizePt: defaultFontSizePt,
    },
    {
      id: 'body',
      startPage: 1,
      endPage: null,
      style: 'arabic',
      startNumber: 1,
      position: 'bottom-center',
      fontFamily: defaultFontFamily,
      fontSizePt: defaultFontSizePt,
    },
  ],
  unnumberedPages: [],
};

// ──────────────────────────────────────────────
// Default sequence numbering settings
// ──────────────────────────────────────────────

export const defaultSequenceNumbering: SequenceNumberingSettings = {
  mode: 'sequential',
  tableStart: 1,
  figureStart: 1,
  equationStart: 1,
  chapterSeparator: '.',
};

// ──────────────────────────────────────────────
// Default section ordering
// ──────────────────────────────────────────────

export const defaultSectionOrder: SectionOrderSettings = {
  order: [
    'COVER',
    'APPROVAL',
    'DECLARATION',
    'ACKNOWLEDGMENT',
    'ABSTRACT_TR',
    'ABSTRACT_EN',
    'TABLE_OF_CONTENTS',
    'TABLE_LIST',
    'FIGURE_LIST',
    'ABBREVIATIONS',
    'BODY',
    'REFERENCES',
    'APPENDIX',
    'CV',
  ],
};

// ──────────────────────────────────────────────
// Default table/figure format settings (v5 §4.9.8)
// ──────────────────────────────────────────────

export const defaultTableFigureFormat: TableFigureFormatSettings = {
  tableCaptionPosition: 'above',
  figureCaptionPosition: 'below',
  numberingSystem: 'sequential',
  numberFormat: '1',
  captionIsBold: true,
  captionSeparator: '. ',
  sourcePosition: 'below',
  continuationFormat: '(continued)',
  continuationRepeatHeaders: true,
  tableAlignment: 'center',
  tableBorderStyle: 'full',
};

// ──────────────────────────────────────────────
// Default restriction settings (v5 §4.9.11)
// ──────────────────────────────────────────────

export const defaultRestrictions: RestrictionSettings = {
  abstractWordLimitMin: undefined,
  abstractWordLimitMax: 300,
  mainTextWordLimitMin: undefined,
  mainTextWordLimitMax: undefined,
  keywordCountMin: 3,
  keywordCountMax: 7,
};

// ──────────────────────────────────────────────
// Default fixed pages (common for thesis)
// ──────────────────────────────────────────────

export const defaultFixedPages = {
  approval: true,
  declaration: true,
  abstractTr: true,
  abstractEn: true,
  tableOfContents: true,
  tableList: true,
  figureList: true,
  abbreviations: false,
  cv: false,
};
