// ─── Heading Pattern ────────────────────────────────────────────────
// Matches a leading "numbering" on a line. Three alternatives:
//   - Arabic: `1`, `1.`, `1.2`, `1.2.3.` — optional trailing dot
//   - Roman:  `IV.`, `XII.` — dot REQUIRED (disambiguates from regular prose)
//   - Alpha:  `A.`, `B.`   — dot REQUIRED (a lone capital letter followed by
//             space is otherwise ambiguous with sentences like `E = mc2`)
// Callers should strip any trailing dot from the captured group before using
// it as a numbering key — see `extractNumberingPattern`.
export const headingPattern =
  /^(\d+(?:\.\d+){0,4}\.?|[IVXLCDM]+\.|[A-Z]\.)\\s+/;

// ─── Citation Patterns ──────────────────────────────────────────────
// IEEE / numeric: [1], [1-3], [1,2,3]
export const citationNumericPattern =
  /\[(\d+)(?:\s*[-–,;]\s*\d+)*\]/g;

// APA / Harvard: (Author, 2024), (Author & Author, 2024), (Author et al., 2023)
export const citationApaPattern =
  /\((?:[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s(?:ve|and|&)\s[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?(?:\set\sal\.?)?),?\s*((?:19|20)\d{2}[a-z]?)\)/g;

// Vancouver / superscript-like: trailing numbers like ¹²³ or text_1
export const citationSuperscriptPattern =
  /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;

// Chicago author-date: similar to APA
export const citationChicagoPattern =
  /\((?:[A-ZÇĞİÖŞÜ][a-zçğıöşü-]+\s*(?:ve|and|&)?\s*){1,3},?\s*(?:19|20)\d{2}[a-z]?(?:\s*[:;,]\s*\d+(?:-\d+)?)?\)/g;

// Inline citation patterns: "Author (2024)", "Author'un (2024)"  
export const citationInlinePattern =
  /(?:[A-ZÇĞİÖŞÜ][a-zçğıöşü-]+(?:'[a-zçğıöşüA-ZÇĞİÖŞÜ]+)?)\s*\((?:19|20)\d{2}[a-z]?\)/g;

// Combined - for backward compat
export const citationPatterns = [
  citationNumericPattern,
  citationApaPattern,
];

// ─── Footnote Patterns ──────────────────────────────────────────────
// Classic footnote markers: [1], trailing superscript numbers
export const footnotePattern = /(\[[0-9]+\]|\b\d+\s*$)/;

// Superscript Unicode markers
export const footnoteSuperscriptPattern = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/;

// DOCX footnote XML marker (for raw XML parsing path)
export const footnoteXmlMarker = /<w:footnoteReference/;

// Footnote text pattern (line starts with number followed by text)
export const footnoteTextPattern = /^\s*\d+\s*[.)]\s+.+/;

// ─── Equation Patterns ──────────────────────────────────────────────
// Basic operator/keyword pattern
export const equationPattern =
  /(=|\bleft\b|\bright\b|\bsum\b|\bintegral\b|\bequation\b)/i;

// LaTeX math patterns: $...$, \[...\], \(...\), \frac{}, \sum, \int, etc.
export const equationLatexPattern =
  /(\$[^$]+\$|\\\[.*?\\\]|\\\(.*?\\\)|\\(?:frac|sqrt|sum|int|prod|lim|infty|alpha|beta|gamma|delta|theta|lambda|sigma|omega|pi|nabla|partial|begin\{equation\}|end\{equation\}|begin\{align\}|end\{align\}))/;

// MathML detection
export const equationMathmlPattern =
  /<(?:math|mml:math|m:oMath)\b/i;

// OMML (Office Math Markup Language) detection
export const equationOmmlPattern =
  /<m:oMath\b|<m:oMathPara\b/i;

// Mathematical symbol detection (Unicode math symbols)
export const equationSymbolPattern =
  /[∑∏∫∬∭∮∯∰∞√∛∜∂∇∆≈≡≠≤≥≪≫±∓×÷∝∠∡∢⊕⊗⊥∥∦∈∉⊂⊃⊆⊇∪∩∧∨¬⊕⊖←→↔⇐⇒⇔∀∃∄∅ℕℤℚℝℂ]/;

// Equation numbering pattern: (1), (2.1), (3.1.2)
export const equationNumberPattern =
  /\(\d+(?:\.\d+)*\)\s*$/;

// ─── Table / Figure Patterns ────────────────────────────────────────
export const tablePattern = /^\s*(tablo|table|çizelge)\s+\d+(?:\.\d+)?/i;
export const figurePattern = /^\s*(sekil|şekil|figure|resim|grafik|diyagram)\s+\d+(?:\.\d+)?/i;

// Table/figure caption continuation (follows a label)
export const tableCaptionPattern =
  /^\s*(tablo|table|çizelge)\s+\d+(?:\.\d+)?[.:]\s*/i;
export const figureCaptionPattern =
  /^\s*(sekil|şekil|figure|resim|grafik|diyagram)\s+\d+(?:\.\d+)?[.:]\s*/i;

// ─── Font Size Constants ────────────────────────────────────────────
export const defaultFontSize = 11;

export const fontSizeHeadingThresholds: Record<number, number> = {
  1: 16,
  2: 14,
  3: 13,
  4: 12,
  5: 11.5,
};

export const fontSizeHeadingBoost = 0.12;

// ─── Semantic Section Rules ─────────────────────────────────────────
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
    pattern: /^(introduction|giris|giriş|1\.\s*giriş|1\.\s*introduction)$/i,
    templateSlot: 'introduction',
  },
  {
    type: 'LITERATURE_REVIEW',
    pattern: /^(literature\s*review|literatur|literatür\s*(taraması|inceleme(si)?)?|ilgili\s*çalışmalar)$/i,
    templateSlot: 'literature_review',
  },
  {
    type: 'METHODS',
    pattern: /^(methods?|materials?\s*and\s*methods?|yontem|yöntem|materyal\s*ve\s*yöntem|araştırma\s*yöntemi)/i,
    templateSlot: 'methods',
  },
  {
    type: 'RESULTS',
    pattern: /^(results?|bulgular|araştırma\s*bulguları)/i,
    templateSlot: 'results',
  },
  {
    type: 'DISCUSSION',
    pattern: /^(discussion|tartisma|tartışma|sonuçların\s*tartışılması)/i,
    templateSlot: 'discussion',
  },
  {
    type: 'CONCLUSION',
    pattern: /^(conclusion|sonuc|sonuç|sonuç\s*ve\s*öneriler)/i,
    templateSlot: 'conclusion',
  },
  {
    type: 'REFERENCES',
    pattern: /^(references|kaynakca|kaynakça|bibliography|referanslar)/i,
    templateSlot: 'references',
  },
  {
    type: 'APPENDIX',
    pattern: /^(appendix|ekler?|ek\s*\d+|annex)/i,
    templateSlot: 'appendix',
  },
  {
    type: 'ACKNOWLEDGMENT',
    pattern: /^(acknowledgments?|teşekkür|önsöz)/i,
    templateSlot: 'acknowledgment',
  },
  {
    type: 'ABBREVIATIONS',
    pattern: /^(list\s*of\s*abbreviations|kısaltmalar|simgeler\s*ve\s*kısaltmalar|kisaltmalar)/i,
    templateSlot: 'abbreviations',
  },
  {
    type: 'TABLE_OF_CONTENTS',
    pattern: /^(table\s*of\s*contents|içindekiler|ıcındekıler)/i,
    templateSlot: 'table_of_contents',
  },
  {
    type: 'TABLE_LIST',
    pattern: /^(list\s*of\s*tables|tablolar\s*listesi|çizelge(ler)?\s*listesi)/i,
    templateSlot: 'table_list',
  },
  {
    type: 'FIGURE_LIST',
    pattern: /^(list\s*of\s*figures|şekiller?\s*listesi|şekil\s*listesi)/i,
    templateSlot: 'figure_list',
  },
  {
    type: 'CV',
    pattern: /^(curriculum\s*vitae|özgeçmiş|ozgecmis)/i,
    templateSlot: 'cv',
  },
  {
    type: 'DECLARATION',
    pattern: /^(declaration|beyanname|etik\s*beyan)/i,
    templateSlot: 'declaration',
  },
];

export const defaultTemplateOrder: string[] = [
  'abstract',
  'introduction',
  'literature_review',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'references',
  'appendix',
];

export const maxParseBlockCount = 2000;

// ─── Citation Style Detection ───────────────────────────────────────
export type CitationStyle = 'apa' | 'ieee' | 'vancouver' | 'chicago' | 'unknown';

/**
 * Detects the dominant citation style in a document based on
 * pattern frequency analysis.
 */
export function detectCitationStyle(fullText: string): CitationStyle {
  const apaCount = (fullText.match(citationApaPattern) ?? []).length;
  const numericCount = (fullText.match(citationNumericPattern) ?? []).length;
  const chicagoCount = (fullText.match(citationChicagoPattern) ?? []).length;
  const superscriptCount = (fullText.match(citationSuperscriptPattern) ?? []).length;

  // Reset lastIndex for global regexes
  citationApaPattern.lastIndex = 0;
  citationNumericPattern.lastIndex = 0;
  citationChicagoPattern.lastIndex = 0;
  citationSuperscriptPattern.lastIndex = 0;

  const maxCount = Math.max(apaCount, numericCount, chicagoCount, superscriptCount);
  if (maxCount === 0) return 'unknown';

  if (numericCount === maxCount) return 'ieee';
  if (apaCount === maxCount) return 'apa';
  if (chicagoCount === maxCount) return 'chicago';
  if (superscriptCount === maxCount) return 'vancouver';

  return 'unknown';
}
