export const supportedCitationStyles = [
  'apa-7',
  'apa-6',
  'vancouver',
  'ieee',
  'mdpi',
  'chicago-author-date',
  'chicago-notes-bibliography',
  'harvard',
  'mla',
  'ama',
  'nlm',
] as const;

export type CitationStyleSlug = (typeof supportedCitationStyles)[number];

export const authorDateStyles: CitationStyleSlug[] = [
  'apa-7',
  'apa-6',
  'chicago-author-date',
  'harvard',
];

export const numericStyles: CitationStyleSlug[] = [
  'vancouver',
  'ieee',
  'mdpi',
  'ama',
  'nlm',
];

export const notesBibliographyStyles: CitationStyleSlug[] = [
  'chicago-notes-bibliography',
];

