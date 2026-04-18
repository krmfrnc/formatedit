import type {
  EditorBlockNumberingMode,
  EditorCascadeNotification,
  EditorDocumentSettings,
  ParsedDocumentBlock,
} from '@formatedit/shared';

interface EditorBlock extends ParsedDocumentBlock {
  id: string;
}

interface EditorSnapshot {
  blocks: EditorBlock[];
  settings: EditorDocumentSettings;
  cascadeNotifications: EditorCascadeNotification[];
}

interface EditorState {
  documentId: string | null;
  blocks: EditorBlock[];
  selectedBlockId: string | null;
  mode: 'split' | 'wysiwyg';
  settings: EditorDocumentSettings;
  cascadeNotifications: EditorCascadeNotification[];
  historyPast: EditorSnapshot[];
  historyFuture: EditorSnapshot[];
}

const defaultSettings: EditorDocumentSettings = {
  pageNumbering: {
    frontMatterStyle: 'roman',
    bodyStyle: 'arabic',
    bodyStartPage: 1,
    bodyStartNumber: 1,
    unnumberedPages: [],
  },
  sequence: {
    tableStart: 1,
    figureStart: 1,
    equationStart: 1,
  },
};

let state: EditorState = createInitialState();

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function createInitialState(): EditorState {
  return {
    documentId: null,
    blocks: [],
    selectedBlockId: null,
    mode: 'split',
    settings: cloneValue(defaultSettings),
    cascadeNotifications: [],
    historyPast: [],
    historyFuture: [],
  };
}

function resetState() {
  state = createInitialState();
}

function cloneSnapshot(s: EditorState): EditorSnapshot {
  return {
    blocks: s.blocks.map((b) => ({ ...b })),
    settings: {
      pageNumbering: {
        ...s.settings.pageNumbering,
        unnumberedPages: [...s.settings.pageNumbering.unnumberedPages],
      },
      sequence: { ...s.settings.sequence },
    },
    cascadeNotifications: s.cascadeNotifications.map((n) => ({ ...n })),
  };
}

function normalizeSettings(
  settings?: EditorDocumentSettings,
): EditorDocumentSettings {
  return {
    pageNumbering: {
      ...defaultSettings.pageNumbering,
      ...settings?.pageNumbering,
      unnumberedPages: [
        ...(settings?.pageNumbering?.unnumberedPages ??
          defaultSettings.pageNumbering.unnumberedPages),
      ].sort((a, b) => a - b),
    },
    sequence: {
      ...defaultSettings.sequence,
      ...settings?.sequence,
    },
  };
}

function toEditorBlocks(blocks: ParsedDocumentBlock[]): EditorBlock[] {
  return blocks.map((block, index) => ({
    ...block,
    numberingOverride: block.numberingOverride ?? null,
    manualSequenceNumber: block.manualSequenceNumber ?? null,
    id: `block_${index}_${block.orderIndex}`,
  }));
}

function normalizeBlock(block: EditorBlock, index: number): EditorBlock {
  const text = block.text.trim();
  return {
    ...block,
    orderIndex: index,
    text,
    title: block.blockType === 'HEADING' ? text || block.title : null,
    level:
      block.blockType === 'HEADING'
        ? Math.min(Math.max(block.level ?? 1, 1), 5)
        : null,
    numberingOverride: block.numberingOverride ?? null,
    manualSequenceNumber: block.manualSequenceNumber ?? null,
  };
}

function cascadeHeadingNumbering(blocks: EditorBlock[]): EditorBlock[] {
  const counters = [0, 0, 0, 0, 0, 0];
  return blocks.map((rawBlock, index) => {
    const block = normalizeBlock(rawBlock, index);
    if (block.blockType !== 'HEADING') {
      return {
        ...block,
        numberingPattern:
          block.numberingOverride?.mode === 'REMOVE'
            ? null
            : block.numberingPattern,
      };
    }
    const level = Math.min(Math.max(block.level ?? 1, 1), 5);
    counters[level] += 1;
    for (let cursor = level + 1; cursor < counters.length; cursor += 1) {
      counters[cursor] = 0;
    }
    const override = block.numberingOverride;
    let numberingPattern: string | null;
    if (override?.mode === 'REMOVE') {
      numberingPattern = null;
    } else if (override?.mode === 'CUSTOM') {
      numberingPattern = override.customValue?.trim() || null;
    } else {
      numberingPattern = counters
        .slice(1, level + 1)
        .filter(Boolean)
        .join('.');
    }
    return { ...block, level, numberingPattern };
  });
}

function cascadeSequenceNumbers(
  blocks: EditorBlock[],
  settings: EditorDocumentSettings,
): EditorBlock[] {
  const counters = {
    TABLE: settings.sequence.tableStart,
    FIGURE: settings.sequence.figureStart,
    EQUATION: settings.sequence.equationStart,
  };
  return blocks.map((block) => {
    if (
      block.blockType !== 'TABLE' &&
      block.blockType !== 'FIGURE' &&
      block.blockType !== 'EQUATION'
    ) {
      return block;
    }
    const nextCounter = counters[block.blockType];
    const manual = block.manualSequenceNumber;
    const effectiveNumber = manual && manual > 0 ? manual : nextCounter;
    counters[block.blockType] = effectiveNumber + 1;
    return { ...block, manualSequenceNumber: effectiveNumber };
  });
}

function recalculateDocument(
  blocks: EditorBlock[],
  settings: EditorDocumentSettings,
): EditorBlock[] {
  const normalized = blocks.map((block, index) => normalizeBlock(block, index));
  const withHeadingNumbers = cascadeHeadingNumbering(normalized);
  return cascadeSequenceNumbers(withHeadingNumbers, settings);
}

let notificationSequence = 0;
function nextNotification(
  type: EditorCascadeNotification['type'],
  message: string,
  severity: EditorCascadeNotification['severity'] = 'info',
): EditorCascadeNotification {
  return {
    id: `${type}_${++notificationSequence}_${Date.now()}`,
    type,
    severity,
    message,
  };
}

function applyMutation(mutate: (draft: EditorSnapshot) => EditorSnapshot) {
  const currentSnapshot = cloneSnapshot(state);
  const mutated = mutate(cloneValue(currentSnapshot));
  const settings = normalizeSettings(mutated.settings);
  const blocks = recalculateDocument(mutated.blocks, settings);
  state = {
    ...state,
    blocks,
    settings,
    cascadeNotifications: mutated.cascadeNotifications,
    historyPast: [...state.historyPast.slice(-39), currentSnapshot],
    historyFuture: [],
  };
}

function setDocument(
  documentId: string,
  blocks: ParsedDocumentBlock[],
  settings?: EditorDocumentSettings,
  cascadeNotifications?: EditorCascadeNotification[],
) {
  const nextSettings = normalizeSettings(settings);
  const nextBlocks = recalculateDocument(toEditorBlocks(blocks), nextSettings);
  state = {
    documentId,
    blocks: nextBlocks,
    settings: nextSettings,
    cascadeNotifications: cascadeNotifications ?? [],
    selectedBlockId: nextBlocks[0]?.id ?? null,
    mode: 'split',
    historyPast: [],
    historyFuture: [],
  };
}

function updateBlockText(blockId: string, text: string) {
  applyMutation((draft) => {
    draft.blocks = draft.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            text,
            title: block.blockType === 'HEADING' ? text.trim() : null,
          }
        : block,
    );
    return draft;
  });
}

function updateHeadingLevel(blockId: string, level: number | null) {
  applyMutation((draft) => {
    draft.blocks = draft.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            level,
            blockType: level ? 'HEADING' : 'PARAGRAPH',
            title: level ? block.text.trim() : null,
            numberingOverride: level
              ? {
                  mode: 'RENUMBER' as EditorBlockNumberingMode,
                  customValue: null,
                }
              : null,
          }
        : block,
    );
    draft.cascadeNotifications = [
      nextNotification(
        'heading-numbering',
        'Baslik hiyerarsisi guncellendi; numaralandirma yeniden hesaplandi.',
      ),
      ...draft.cascadeNotifications,
    ].slice(0, 6);
    return draft;
  });
}

function updateHeadingNumbering(
  blockId: string,
  mode: EditorBlockNumberingMode,
  customValue?: string | null,
) {
  applyMutation((draft) => {
    draft.blocks = draft.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            numberingOverride:
              mode === 'INHERIT'
                ? null
                : {
                    mode,
                    customValue:
                      mode === 'CUSTOM' ? customValue?.trim() || null : null,
                  },
          }
        : block,
    );
    draft.cascadeNotifications = [
      nextNotification(
        'heading-numbering',
        'Baslik numaralandirmasi duzeltildi ve outline senkronize edildi.',
      ),
      ...draft.cascadeNotifications,
    ].slice(0, 6);
    return draft;
  });
}

function updateBlockSequenceNumber(blockId: string, value: number | null) {
  applyMutation((draft) => {
    draft.blocks = draft.blocks.map((block) =>
      block.id === blockId
        ? { ...block, manualSequenceNumber: value && value > 0 ? value : null }
        : block,
    );
    draft.cascadeNotifications = [
      nextNotification(
        'sequence',
        'Tablo/sekil/denklem numaralari kaskad olarak guncellendi.',
      ),
      ...draft.cascadeNotifications,
    ].slice(0, 6);
    return draft;
  });
}

function moveBlock(blockId: string, toIndex: number) {
  applyMutation((draft) => {
    const currentIndex = draft.blocks.findIndex(
      (block) => block.id === blockId,
    );
    if (currentIndex === -1 || currentIndex === toIndex) {
      return draft;
    }
    const boundedIndex = Math.max(
      0,
      Math.min(toIndex, draft.blocks.length - 1),
    );
    const [moved] = draft.blocks.splice(currentIndex, 1);
    draft.blocks.splice(boundedIndex, 0, moved);
    draft.cascadeNotifications = [
      nextNotification(
        'section-order',
        'Bolum sirasi degisti; outline ve preview yeniden duzenlendi.',
      ),
      ...draft.cascadeNotifications,
    ].slice(0, 6);
    return draft;
  });
}

function mergeWithPrevious(blockId: string) {
  applyMutation((draft) => {
    const currentIndex = draft.blocks.findIndex(
      (block) => block.id === blockId,
    );
    if (currentIndex <= 0) {
      return draft;
    }
    const previous = draft.blocks[currentIndex - 1];
    const current = draft.blocks[currentIndex];
    draft.blocks[currentIndex - 1] = {
      ...previous,
      text: `${previous.text} ${current.text}`.trim(),
      title:
        previous.blockType === 'HEADING'
          ? `${previous.text} ${current.text}`.trim()
          : previous.title,
    };
    draft.blocks.splice(currentIndex, 1);
    return draft;
  });
}

function splitBlock(blockId: string, cursorPosition?: number) {
  applyMutation((draft) => {
    const currentIndex = draft.blocks.findIndex(
      (block) => block.id === blockId,
    );
    if (currentIndex === -1) {
      return draft;
    }
    const current = draft.blocks[currentIndex];
    const splitAt =
      typeof cursorPosition === 'number' &&
      cursorPosition > 0 &&
      cursorPosition < current.text.length
        ? cursorPosition
        : Math.max(1, Math.floor(current.text.length / 2));
    const leftText = current.text.slice(0, splitAt).trim();
    const rightText = current.text.slice(splitAt).trim();
    if (!leftText || !rightText) {
      return draft;
    }
    draft.blocks[currentIndex] = {
      ...current,
      text: leftText,
      title: current.blockType === 'HEADING' ? leftText : null,
    };
    draft.blocks.splice(currentIndex + 1, 0, {
      ...current,
      id: `block_split_${Date.now()}`,
      text: rightText,
      title: current.blockType === 'HEADING' ? rightText : null,
    });
    return draft;
  });
}

function markAsParagraph(blockId: string) {
  applyMutation((draft) => {
    draft.blocks = draft.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            blockType: 'PARAGRAPH',
            level: null,
            title: null,
            numberingPattern: null,
            numberingOverride: null,
          }
        : block,
    );
    return draft;
  });
}

function setPageNumbering(
  input: Partial<EditorDocumentSettings['pageNumbering']>,
) {
  applyMutation((draft) => {
    draft.settings = normalizeSettings({
      ...draft.settings,
      pageNumbering: {
        ...draft.settings.pageNumbering,
        ...input,
        unnumberedPages: [
          ...(input.unnumberedPages ??
            draft.settings.pageNumbering.unnumberedPages),
        ],
      },
    });
    draft.cascadeNotifications = [
      nextNotification(
        'page-numbering',
        'Sayfa numaralandirma bolgeleri ve gecis noktasi guncellendi.',
      ),
      ...draft.cascadeNotifications,
    ].slice(0, 6);
    return draft;
  });
}

function setSequenceStart(
  kind: keyof EditorDocumentSettings['sequence'],
  value: number,
) {
  applyMutation((draft) => {
    draft.settings = normalizeSettings({
      ...draft.settings,
      sequence: { ...draft.settings.sequence, [kind]: Math.max(1, value) },
    });
    draft.cascadeNotifications = [
      nextNotification(
        'sequence',
        'Sirali numaralandirma baslangic degerleri guncellendi.',
      ),
      ...draft.cascadeNotifications,
    ].slice(0, 6);
    return draft;
  });
}

function dismissCascade(notificationId: string) {
  state = {
    ...state,
    cascadeNotifications: state.cascadeNotifications.filter(
      (n) => n.id !== notificationId,
    ),
  };
}

function undo() {
  const previous = state.historyPast[state.historyPast.length - 1];
  if (!previous) {
    return;
  }
  const current = cloneSnapshot(state);
  const restored = JSON.parse(JSON.stringify(previous)) as EditorSnapshot;
  state = {
    ...state,
    blocks: restored.blocks,
    settings: restored.settings,
    cascadeNotifications: restored.cascadeNotifications,
    historyPast: state.historyPast.slice(0, -1),
    historyFuture: [current, ...state.historyFuture].slice(0, 40),
    selectedBlockId:
      restored.blocks.find((b) => b.id === state.selectedBlockId)?.id ??
      restored.blocks[0]?.id ??
      null,
  };
}

function redo() {
  const next = state.historyFuture[0];
  if (!next) {
    return;
  }
  const current = cloneSnapshot(state);
  const restored = JSON.parse(JSON.stringify(next)) as EditorSnapshot;
  state = {
    ...state,
    blocks: restored.blocks,
    settings: restored.settings,
    cascadeNotifications: restored.cascadeNotifications,
    historyPast: [...state.historyPast, current].slice(-40),
    historyFuture: state.historyFuture.slice(1),
    selectedBlockId:
      restored.blocks.find((b) => b.id === state.selectedBlockId)?.id ??
      restored.blocks[0]?.id ??
      null,
  };
}

function setMode(mode: 'split' | 'wysiwyg') {
  state = { ...state, mode };
}

function selectBlock(blockId: string | null) {
  state = { ...state, selectedBlockId: blockId };
}

function getState(): EditorState {
  return state;
}

function makeBlock(
  overrides: Partial<ParsedDocumentBlock> & { orderIndex: number },
): ParsedDocumentBlock {
  return {
    blockType: 'PARAGRAPH',
    semanticSectionType: 'BODY',
    title: null,
    text: overrides.text ?? 'Sample text',
    level: null,
    confidenceScore: 0.8,
    numberingPattern: null,
    lineLengthScore: 0.5,
    hasCitation: false,
    hasFootnote: false,
    hasEquation: false,
    tableOrFigureLabel: null,
    templateSlot: null,
    numberingOverride: null,
    manualSequenceNumber: null,
    ...overrides,
  };
}

describe('Editor Store (Task 140)', () => {
  beforeEach(() => {
    resetState();
  });

  describe('setDocument', () => {
    it('loads blocks and sets documentId', () => {
      const blocks: ParsedDocumentBlock[] = [
        makeBlock({
          orderIndex: 0,
          text: 'Abstract',
          blockType: 'HEADING',
          level: 1,
        }),
        makeBlock({ orderIndex: 1, text: 'Body content' }),
      ];

      setDocument('doc_1', blocks);

      expect(getState().documentId).toBe('doc_1');
      expect(getState().blocks).toHaveLength(2);
      expect(getState().blocks[0].blockType).toBe('HEADING');
    });

    it('applies custom settings', () => {
      const customSettings: EditorDocumentSettings = {
        pageNumbering: {
          frontMatterStyle: 'arabic',
          bodyStyle: 'roman',
          bodyStartPage: 5,
          bodyStartNumber: 10,
          unnumberedPages: [1, 2, 3],
        },
        sequence: { tableStart: 3, figureStart: 2, equationStart: 1 },
      };

      setDocument('doc_1', [makeBlock({ orderIndex: 0 })], customSettings);

      expect(getState().settings.pageNumbering.bodyStartPage).toBe(5);
      expect(getState().settings.sequence.tableStart).toBe(3);
    });
  });

  describe('updateBlockText', () => {
    it('updates block text', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'Old text' })]);
      const blockId = getState().blocks[0].id;

      updateBlockText(blockId, 'New text');

      expect(getState().blocks[0].text).toBe('New text');
    });
  });

  describe('updateHeadingLevel', () => {
    it('changes block to heading with level', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'My Heading' })]);
      const blockId = getState().blocks[0].id;

      updateHeadingLevel(blockId, 2);

      expect(getState().blocks[0].blockType).toBe('HEADING');
      expect(getState().blocks[0].level).toBe(2);
    });

    it('converts heading back to paragraph when level is null', () => {
      setDocument('doc_1', [
        makeBlock({
          orderIndex: 0,
          text: 'My Heading',
          blockType: 'HEADING',
          level: 1,
        }),
      ]);
      const blockId = getState().blocks[0].id;

      updateHeadingLevel(blockId, null);

      expect(getState().blocks[0].blockType).toBe('PARAGRAPH');
      expect(getState().blocks[0].level).toBeNull();
    });

    it('generates cascade notification', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'Heading' })]);
      const blockId = getState().blocks[0].id;

      updateHeadingLevel(blockId, 1);

      expect(getState().cascadeNotifications.length).toBeGreaterThan(0);
      expect(getState().cascadeNotifications[0].type).toBe('heading-numbering');
    });
  });

  describe('updateHeadingNumbering', () => {
    it('sets custom numbering', () => {
      setDocument('doc_1', [
        makeBlock({
          orderIndex: 0,
          text: 'Heading',
          blockType: 'HEADING',
          level: 1,
        }),
      ]);
      const blockId = getState().blocks[0].id;

      updateHeadingNumbering(blockId, 'CUSTOM', 'A.1');

      expect(getState().blocks[0].numberingOverride?.mode).toBe('CUSTOM');
      expect(getState().blocks[0].numberingOverride?.customValue).toBe('A.1');
    });

    it('removes numbering with REMOVE mode', () => {
      setDocument('doc_1', [
        makeBlock({
          orderIndex: 0,
          text: 'Heading',
          blockType: 'HEADING',
          level: 1,
        }),
      ]);
      const blockId = getState().blocks[0].id;

      updateHeadingNumbering(blockId, 'REMOVE');

      expect(getState().blocks[0].numberingOverride?.mode).toBe('REMOVE');
    });
  });

  describe('moveBlock', () => {
    it('moves block to new position', () => {
      setDocument('doc_1', [
        makeBlock({ orderIndex: 0, text: 'First' }),
        makeBlock({ orderIndex: 1, text: 'Second' }),
        makeBlock({ orderIndex: 2, text: 'Third' }),
      ]);

      const blockId = getState().blocks[0].id;
      moveBlock(blockId, 2);

      expect(getState().blocks[2].text).toBe('First');
    });

    it('generates section-order cascade notification', () => {
      setDocument('doc_1', [
        makeBlock({ orderIndex: 0, text: 'First' }),
        makeBlock({ orderIndex: 1, text: 'Second' }),
      ]);

      const blockId = getState().blocks[0].id;
      moveBlock(blockId, 1);

      expect(
        getState().cascadeNotifications.some(
          (n: EditorCascadeNotification) => n.type === 'section-order',
        ),
      ).toBe(true);
    });
  });

  describe('mergeWithPrevious', () => {
    it('merges current block with previous', () => {
      setDocument('doc_1', [
        makeBlock({ orderIndex: 0, text: 'First part' }),
        makeBlock({ orderIndex: 1, text: 'Second part' }),
      ]);

      const secondBlockId = getState().blocks[1].id;
      mergeWithPrevious(secondBlockId);

      expect(getState().blocks).toHaveLength(1);
      expect(getState().blocks[0].text).toContain('First part');
      expect(getState().blocks[0].text).toContain('Second part');
    });

    it('does nothing when merging first block', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'Only block' })]);

      const blockId = getState().blocks[0].id;
      mergeWithPrevious(blockId);

      expect(getState().blocks).toHaveLength(1);
    });
  });

  describe('splitBlock', () => {
    it('splits block into two', () => {
      setDocument('doc_1', [
        makeBlock({ orderIndex: 0, text: 'Long text to split' }),
      ]);

      const blockId = getState().blocks[0].id;
      splitBlock(blockId, 9);

      expect(getState().blocks).toHaveLength(2);
      expect(getState().blocks[0].text).toBe('Long text');
      expect(getState().blocks[1].text).toBe('to split');
    });
  });

  describe('markAsParagraph', () => {
    it('converts heading to paragraph', () => {
      setDocument('doc_1', [
        makeBlock({
          orderIndex: 0,
          text: 'Heading',
          blockType: 'HEADING',
          level: 1,
        }),
      ]);

      const blockId = getState().blocks[0].id;
      markAsParagraph(blockId);

      expect(getState().blocks[0].blockType).toBe('PARAGRAPH');
      expect(getState().blocks[0].level).toBeNull();
      expect(getState().blocks[0].title).toBeNull();
    });
  });

  describe('setPageNumbering', () => {
    it('updates page numbering settings', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0 })]);

      setPageNumbering({ bodyStartPage: 5 });

      expect(getState().settings.pageNumbering.bodyStartPage).toBe(5);
    });

    it('generates page-numbering cascade notification', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0 })]);

      setPageNumbering({ bodyStyle: 'roman' });

      expect(
        getState().cascadeNotifications.some(
          (n: EditorCascadeNotification) => n.type === 'page-numbering',
        ),
      ).toBe(true);
    });
  });

  describe('setSequenceStart', () => {
    it('updates sequence start values', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0 })]);

      setSequenceStart('tableStart', 5);

      expect(getState().settings.sequence.tableStart).toBe(5);
    });
  });

  describe('dismissCascade', () => {
    it('removes notification by id', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0 })]);
      setPageNumbering({ bodyStartPage: 3 });

      const notificationId = getState().cascadeNotifications[0].id;
      dismissCascade(notificationId);

      expect(
        getState().cascadeNotifications.some(
          (n: EditorCascadeNotification) => n.id === notificationId,
        ),
      ).toBe(false);
    });
  });

  describe('undo/redo', () => {
    it('undoes text update', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'Original' })]);
      const blockId = getState().blocks[0].id;

      updateBlockText(blockId, 'Modified');
      expect(getState().blocks[0].text).toBe('Modified');

      undo();
      expect(getState().blocks[0].text).toBe('Original');
    });

    it('redoes after undo', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'Original' })]);
      const blockId = getState().blocks[0].id;

      updateBlockText(blockId, 'Modified');
      undo();
      redo();

      expect(getState().blocks[0].text).toBe('Modified');
    });

    it('does nothing when undo stack is empty', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'Original' })]);

      undo();

      expect(getState().blocks[0].text).toBe('Original');
    });

    it('does nothing when redo stack is empty', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'Original' })]);

      redo();

      expect(getState().blocks[0].text).toBe('Original');
    });

    it('clears redo stack on new mutation', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0, text: 'Original' })]);
      const blockId = getState().blocks[0].id;

      updateBlockText(blockId, 'Modified');
      undo();
      updateBlockText(blockId, 'New value');

      expect(getState().historyFuture).toHaveLength(0);
    });
  });

  describe('cascade heading numbering', () => {
    it('auto-numbers headings sequentially', () => {
      setDocument('doc_1', [
        makeBlock({
          orderIndex: 0,
          text: 'Chapter 1',
          blockType: 'HEADING',
          level: 1,
        }),
        makeBlock({
          orderIndex: 1,
          text: 'Section 1.1',
          blockType: 'HEADING',
          level: 2,
        }),
        makeBlock({
          orderIndex: 2,
          text: 'Section 1.2',
          blockType: 'HEADING',
          level: 2,
        }),
        makeBlock({
          orderIndex: 3,
          text: 'Chapter 2',
          blockType: 'HEADING',
          level: 1,
        }),
      ]);

      expect(getState().blocks[0].numberingPattern).toBe('1');
      expect(getState().blocks[1].numberingPattern).toBe('1.1');
      expect(getState().blocks[2].numberingPattern).toBe('1.2');
      expect(getState().blocks[3].numberingPattern).toBe('2');
    });
  });

  describe('cascade sequence numbers', () => {
    it('auto-numbers tables sequentially', () => {
      setDocument('doc_1', [
        makeBlock({
          orderIndex: 0,
          text: 'Table 1 content',
          blockType: 'TABLE',
        }),
        makeBlock({ orderIndex: 1, text: 'Some text' }),
        makeBlock({
          orderIndex: 2,
          text: 'Table 2 content',
          blockType: 'TABLE',
        }),
      ]);

      expect(getState().blocks[0].manualSequenceNumber).toBe(1);
      expect(getState().blocks[2].manualSequenceNumber).toBe(2);
    });

    it('respects manual sequence overrides', () => {
      setDocument('doc_1', [
        makeBlock({ orderIndex: 0, text: 'Table content', blockType: 'TABLE' }),
        makeBlock({
          orderIndex: 1,
          text: 'Table content 2',
          blockType: 'TABLE',
        }),
      ]);

      const firstBlockId = getState().blocks[0].id;
      updateBlockSequenceNumber(firstBlockId, 5);

      expect(getState().blocks[0].manualSequenceNumber).toBe(5);
      expect(getState().blocks[1].manualSequenceNumber).toBe(2);
    });
  });

  describe('mode switching', () => {
    it('toggles between split and wysiwyg', () => {
      expect(getState().mode).toBe('split');

      setMode('wysiwyg');
      expect(getState().mode).toBe('wysiwyg');

      setMode('split');
      expect(getState().mode).toBe('split');
    });
  });

  describe('selectBlock', () => {
    it('sets selected block', () => {
      setDocument('doc_1', [makeBlock({ orderIndex: 0 })]);
      const blockId = getState().blocks[0].id;

      selectBlock(blockId);
      expect(getState().selectedBlockId).toBe(blockId);
    });
  });
});
