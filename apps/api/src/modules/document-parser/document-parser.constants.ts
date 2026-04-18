// Matches a leading "numbering" on a line. Three alternatives:
//   - Arabic: `1`, `1.`, `1.2`, `1.2.3.` — optional trailing dot
//   - Roman:  `IV.`, `XII.` — dot REQUIRED (disambiguates from regular prose)
//   - Alpha:  `A.`, `B.`   — dot REQUIRED (a lone capital letter followed by
//             space is otherwise ambiguous with sentences like `E = mc2`)
// Callers should strip any trailing dot from the captured group before using
// it as a numbering key — see `extractNumberingPattern`.
export const headingPattern =
  /^(\d+(?:\.\d+){0,4}\.?|[IVXLCDM]+\.|[A-Z]\.)\s+/;
export const citationPatterns = [
  /\[[0-9]+(?:\s*[-,;]\s*[0-9]+)*\]/g,
  /\([A-Z][A-Za-z-]+,\s*(19|20)\d{2}\)/g,
];
export const footnotePattern = /(\[[0-9]+\]|\b\d+\s*$)/;
export const equationPattern =
  /(=|\bleft\b|\bright\b|\bsum\b|\bintegral\b|\bequation\b)/i;
export const tablePattern = /^\s*(tablo|table)\s+\d+(?:\.\d+)?/i;
export const figurePattern = /^\s*(sekil|şekil|figure)\s+\d+(?:\.\d+)?/i;

export const defaultFontSize = 11;

export const fontSizeHeadingThresholds: Record<number, number> = {
  1: 16,
  2: 14,
  3: 13,
  4: 12,
  5: 11.5,
};

export const fontSizeHeadingBoost = 0.12;

export const semanticSectionRules: Array<{
  type: string;
  pattern: RegExp;
  templateSlot: string;
}> = [
  {
    type: 'ABSTRACT',
    pattern: /^(abstract|ozet|özet)$/i,
    templateSlot: 'abstract',
  },
  {
    type: 'INTRODUCTION',
    pattern: /^(introduction|giris|giriş)$/i,
    templateSlot: 'introduction',
  },
  {
    type: 'METHODS',
    pattern: /^(methods?|materials? and methods?|yontem|yöntem)/i,
    templateSlot: 'methods',
  },
  {
    type: 'RESULTS',
    pattern: /^(results?|bulgular)/i,
    templateSlot: 'results',
  },
  {
    type: 'DISCUSSION',
    pattern: /^(discussion|tartisma|tartışma)/i,
    templateSlot: 'discussion',
  },
  {
    type: 'CONCLUSION',
    pattern: /^(conclusion|sonuc|sonuç)/i,
    templateSlot: 'conclusion',
  },
  {
    type: 'REFERENCES',
    pattern: /^(references|kaynakca|kaynakça|bibliography)/i,
    templateSlot: 'references',
  },
  {
    type: 'APPENDIX',
    pattern: /^(appendix|ekler?|annex)/i,
    templateSlot: 'appendix',
  },
];

export const defaultTemplateOrder: string[] = [
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'references',
  'appendix',
];

export const maxParseBlockCount = 2000;
