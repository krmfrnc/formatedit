import type { TemplateParameterSet } from '@formatedit/shared';

export type TemplateSectionKey = keyof TemplateParameterSet;
export type FieldType = 'text' | 'number' | 'checkbox' | 'textarea';

export interface SectionField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
}

export const sectionLabels: Record<TemplateSectionKey, string> = {
  pageLayout: 'Sayfa duzeni',
  typography: 'Yazi tipi',
  headingHierarchy: 'Baslik hiyerarsisi',
  pageNumbering: 'Sayfa numarasi',
  coverPages: 'Kapak sayfalari',
  fixedPages: 'Sabit sayfalar',
  sectionOrdering: 'Bolum sirasi',
  tableFigureFormatting: 'Tablo ve sekil',
  equationFormatting: 'Denklem',
  citations: 'Kaynakca',
  restrictions: 'Kisitlamalar',
};

export const sectionFieldMap: Record<TemplateSectionKey, SectionField[]> = {
  pageLayout: [
    { key: 'paperSize', label: 'Kagit boyutu', type: 'text', placeholder: 'A4' },
    { key: 'marginTopCm', label: 'Ust bosluk (cm)', type: 'number' },
    { key: 'marginBottomCm', label: 'Alt bosluk (cm)', type: 'number' },
    { key: 'marginLeftCm', label: 'Sol bosluk (cm)', type: 'number' },
    { key: 'marginRightCm', label: 'Sag bosluk (cm)', type: 'number' },
  ],
  typography: [
    { key: 'fontFamily', label: 'Govde fontu', type: 'text', placeholder: 'Times New Roman' },
    { key: 'fontSizePt', label: 'Font boyutu', type: 'number' },
    { key: 'lineSpacing', label: 'Satir araligi', type: 'text', placeholder: '1.5' },
    { key: 'paragraphSpacingAfterPt', label: 'Paragraf sonrasi bosluk', type: 'number' },
  ],
  headingHierarchy: [
    { key: 'level1SizePt', label: 'H1 boyutu', type: 'number' },
    { key: 'level2SizePt', label: 'H2 boyutu', type: 'number' },
    { key: 'level3SizePt', label: 'H3 boyutu', type: 'number' },
    { key: 'level4SizePt', label: 'H4 boyutu', type: 'number' },
    { key: 'level5SizePt', label: 'H5 boyutu', type: 'number' },
  ],
  pageNumbering: [
    { key: 'startAt', label: 'Baslangic sayfasi', type: 'number' },
    { key: 'position', label: 'Konum', type: 'text', placeholder: 'bottom-center' },
    { key: 'showOnCover', label: 'Kapakta goster', type: 'checkbox' },
  ],
  coverPages: [
    { key: 'titlePageEnabled', label: 'Dis kapak', type: 'checkbox' },
    { key: 'approvalPageEnabled', label: 'Onay sayfasi', type: 'checkbox' },
    { key: 'declarationPageEnabled', label: 'Beyan sayfasi', type: 'checkbox' },
  ],
  fixedPages: [
    { key: 'abstractEnabled', label: 'Ozet', type: 'checkbox' },
    { key: 'acknowledgementsEnabled', label: 'Tesekkur', type: 'checkbox' },
    { key: 'cvEnabled', label: 'Ozgecmis', type: 'checkbox' },
  ],
  sectionOrdering: [
    {
      key: 'items',
      label: 'Bolumler',
      type: 'textarea',
      placeholder: 'cover, abstract, introduction, references',
    },
  ],
  tableFigureFormatting: [
    { key: 'tableLabel', label: 'Tablo etiketi', type: 'text', placeholder: 'Tablo' },
    { key: 'figureLabel', label: 'Sekil etiketi', type: 'text', placeholder: 'Sekil' },
    { key: 'captionPosition', label: 'Caption konumu', type: 'text', placeholder: 'below' },
  ],
  equationFormatting: [
    { key: 'numberingPosition', label: 'Numara konumu', type: 'text', placeholder: 'right' },
    { key: 'equationLabel', label: 'Denklem etiketi', type: 'text', placeholder: 'Eq.' },
  ],
  citations: [
    { key: 'style', label: 'Stil', type: 'text', placeholder: 'APA7' },
    { key: 'inlineFormat', label: 'Metin ici format', type: 'text', placeholder: 'author-date' },
    { key: 'bibliographyTitle', label: 'Kaynakca basligi', type: 'text', placeholder: 'Kaynakca' },
  ],
  restrictions: [
    { key: 'maxHeadingLevel', label: 'Maksimum baslik seviyesi', type: 'number' },
    { key: 'allowLandscapeTables', label: 'Yatay tabloya izin ver', type: 'checkbox' },
    { key: 'maxPageCount', label: 'Maksimum sayfa', type: 'number' },
  ],
};

export const emptyTemplateParameters: TemplateParameterSet = {
  pageLayout: {
    paperSize: 'A4',
    marginTopCm: 4,
    marginBottomCm: 2.5,
    marginLeftCm: 3.5,
    marginRightCm: 2.5,
  },
  typography: {
    fontFamily: 'Times New Roman',
    fontSizePt: 12,
    lineSpacing: '1.5',
    paragraphSpacingAfterPt: 0,
  },
  headingHierarchy: {
    level1SizePt: 14,
    level2SizePt: 13,
    level3SizePt: 12,
    level4SizePt: 12,
    level5SizePt: 11,
  },
  pageNumbering: {
    startAt: 1,
    position: 'bottom-center',
    showOnCover: false,
  },
  coverPages: {
    titlePageEnabled: true,
    approvalPageEnabled: true,
    declarationPageEnabled: false,
  },
  fixedPages: {
    abstractEnabled: true,
    acknowledgementsEnabled: false,
    cvEnabled: false,
  },
  sectionOrdering: {
    items: 'cover, abstract, introduction, methods, results, discussion, conclusion, references',
  },
  tableFigureFormatting: {
    tableLabel: 'Tablo',
    figureLabel: 'Sekil',
    captionPosition: 'below',
  },
  equationFormatting: {
    numberingPosition: 'right',
    equationLabel: 'Eq.',
  },
  citations: {
    style: 'APA7',
    inlineFormat: 'author-date',
    bibliographyTitle: 'Kaynakca',
  },
  restrictions: {
    maxHeadingLevel: 5,
    allowLandscapeTables: true,
    maxPageCount: 300,
  },
};
