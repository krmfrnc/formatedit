export const maxFormattingErrors = 100;

export const defaultFontFamily = 'Times New Roman';

export const defaultFontSizePt = 12;

export const defaultLineSpacing = 1.5;

export const defaultMarginCm = {
  top: 4,
  bottom: 3,
  left: 3,
  right: 3,
};

export const severityLevels = {
  ERROR: 'ERROR' as const,
  WARNING: 'WARNING' as const,
  INFO: 'INFO' as const,
};

export const defaultPageLayout = {
  paperSize: 'A4',
  orientation: 'portrait' as const,
  marginTopCm: defaultMarginCm.top,
  marginBottomCm: defaultMarginCm.bottom,
  marginLeftCm: defaultMarginCm.left,
  marginRightCm: defaultMarginCm.right,
  headerMarginCm: 2.5,
  footerMarginCm: 2.5,
  gutterCm: 0,
};

export const defaultTypography = {
  fontFamily: defaultFontFamily,
  fontSizePt: defaultFontSizePt,
  lineSpacing: defaultLineSpacing,
  paragraphSpacingBeforePt: 0,
  paragraphSpacingAfterPt: 6,
  alignment: 'justify' as const,
  firstLineIndentCm: 1.25,
};

export const defaultHeadingLevels = [
  {
    level: 1,
    fontFamily: defaultFontFamily,
    fontSizePt: 16,
    isBold: true,
    isItalic: false,
    alignment: 'center' as const,
    spacingBeforePt: 12,
    spacingAfterPt: 6,
    numberingFormat: null,
  },
  {
    level: 2,
    fontFamily: defaultFontFamily,
    fontSizePt: 14,
    isBold: true,
    isItalic: false,
    alignment: 'left' as const,
    spacingBeforePt: 10,
    spacingAfterPt: 4,
    numberingFormat: null,
  },
  {
    level: 3,
    fontFamily: defaultFontFamily,
    fontSizePt: 13,
    isBold: true,
    isItalic: false,
    alignment: 'left' as const,
    spacingBeforePt: 8,
    spacingAfterPt: 4,
    numberingFormat: null,
  },
  {
    level: 4,
    fontFamily: defaultFontFamily,
    fontSizePt: 12,
    isBold: true,
    isItalic: false,
    alignment: 'left' as const,
    spacingBeforePt: 6,
    spacingAfterPt: 2,
    numberingFormat: null,
  },
  {
    level: 5,
    fontFamily: defaultFontFamily,
    fontSizePt: 12,
    isBold: false,
    isItalic: true,
    alignment: 'left' as const,
    spacingBeforePt: 6,
    spacingAfterPt: 2,
    numberingFormat: null,
  },
];
