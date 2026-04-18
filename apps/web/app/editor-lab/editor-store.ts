'use client';

import { create } from 'zustand';
import type {
  EditorBlockNumberingMode,
  EditorCascadeNotification,
  EditorDocumentSettings,
  ParsedDocumentBlock,
} from '@formatedit/shared';

export type EditorMode = 'split' | 'wysiwyg';

export interface EditorBlock extends ParsedDocumentBlock {
  id: string;
}

interface EditorSnapshot {
  blocks: EditorBlock[];
  settings: EditorDocumentSettings;
  cascadeNotifications: EditorCascadeNotification[];
}

interface EditorDocumentState {
  documentId: string | null;
  blocks: EditorBlock[];
  selectedBlockId: string | null;
  mode: EditorMode;
  settings: EditorDocumentSettings;
  cascadeNotifications: EditorCascadeNotification[];
  historyPast: EditorSnapshot[];
  historyFuture: EditorSnapshot[];
  setDocument: (
    documentId: string,
    blocks: ParsedDocumentBlock[],
    settings?: EditorDocumentSettings,
    cascadeNotifications?: EditorCascadeNotification[],
  ) => void;
  selectBlock: (blockId: string | null) => void;
  setMode: (mode: EditorMode) => void;
  updateBlockText: (blockId: string, text: string) => void;
  updateHeadingLevel: (blockId: string, level: number | null) => void;
  updateHeadingNumbering: (
    blockId: string,
    mode: EditorBlockNumberingMode,
    customValue?: string | null,
  ) => void;
  updateBlockSequenceNumber: (blockId: string, value: number | null) => void;
  moveBlock: (blockId: string, toIndex: number) => void;
  mergeWithPrevious: (blockId: string) => void;
  splitBlock: (blockId: string, cursorPosition?: number) => void;
  markAsParagraph: (blockId: string) => void;
  setPageNumbering: (input: Partial<EditorDocumentSettings['pageNumbering']>) => void;
  setSequenceStart: (kind: keyof EditorDocumentSettings['sequence'], value: number) => void;
  dismissCascade: (notificationId: string) => void;
  undo: () => void;
  redo: () => void;
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

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    blocks: snapshot.blocks.map((block) => ({ ...block })),
    settings: {
      pageNumbering: {
        ...snapshot.settings.pageNumbering,
        unnumberedPages: [...snapshot.settings.pageNumbering.unnumberedPages],
      },
      sequence: { ...snapshot.settings.sequence },
    },
    cascadeNotifications: snapshot.cascadeNotifications.map((notification) => ({ ...notification })),
  };
}

function buildSnapshot(state: Pick<EditorDocumentState, 'blocks' | 'settings' | 'cascadeNotifications'>) {
  return cloneSnapshot({
    blocks: state.blocks,
    settings: state.settings,
    cascadeNotifications: state.cascadeNotifications,
  });
}

function nextNotification(
  type: EditorCascadeNotification['type'],
  message: string,
  severity: EditorCascadeNotification['severity'] = 'info',
): EditorCascadeNotification {
  return {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity,
    message,
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

function normalizeSettings(settings?: EditorDocumentSettings): EditorDocumentSettings {
  return {
    pageNumbering: {
      ...defaultSettings.pageNumbering,
      ...settings?.pageNumbering,
      unnumberedPages: [...(settings?.pageNumbering?.unnumberedPages ?? defaultSettings.pageNumbering.unnumberedPages)].sort(
        (left, right) => left - right,
      ),
    },
    sequence: {
      ...defaultSettings.sequence,
      ...settings?.sequence,
    },
  };
}

function normalizeBlock(block: EditorBlock, index: number): EditorBlock {
  const text = block.text.trim();
  const blockType = block.blockType;

  return {
    ...block,
    orderIndex: index,
    text,
    title: blockType === 'HEADING' ? text || block.title : null,
    level: blockType === 'HEADING' ? Math.min(Math.max(block.level ?? 1, 1), 5) : null,
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
        numberingPattern: block.numberingOverride?.mode === 'REMOVE' ? null : block.numberingPattern,
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
      numberingPattern = counters.slice(1, level + 1).filter(Boolean).join('.');
    }

    return {
      ...block,
      level,
      numberingPattern,
    };
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
    if (block.blockType !== 'TABLE' && block.blockType !== 'FIGURE' && block.blockType !== 'EQUATION') {
      return block;
    }

    const nextCounter = counters[block.blockType];
    const manual = block.manualSequenceNumber;
    const effectiveNumber = manual && manual > 0 ? manual : nextCounter;
    counters[block.blockType] = effectiveNumber + 1;

    return {
      ...block,
      manualSequenceNumber: effectiveNumber,
    };
  });
}

function recalculateDocument(blocks: EditorBlock[], settings: EditorDocumentSettings): EditorBlock[] {
  const normalized = blocks.map((block, index) => normalizeBlock(block, index));
  const withHeadingNumbers = cascadeHeadingNumbering(normalized);
  return cascadeSequenceNumbers(withHeadingNumbers, settings);
}

function applyMutation(
  state: EditorDocumentState,
  mutate: (draft: EditorSnapshot) => EditorSnapshot,
): Partial<EditorDocumentState> {
  const currentSnapshot = buildSnapshot(state);
  const mutated = mutate(cloneSnapshot(currentSnapshot));
  const settings = normalizeSettings(mutated.settings);
  const blocks = recalculateDocument(mutated.blocks, settings);

  return {
    blocks,
    settings,
    cascadeNotifications: mutated.cascadeNotifications,
    historyPast: [...state.historyPast.slice(-39), currentSnapshot],
    historyFuture: [],
  };
}

export const useEditorStore = create<EditorDocumentState>((set, get) => ({
  documentId: null,
  blocks: [],
  selectedBlockId: null,
  mode: 'split',
  settings: defaultSettings,
  cascadeNotifications: [],
  historyPast: [],
  historyFuture: [],
  setDocument: (documentId, blocks, settings, cascadeNotifications) => {
    const nextSettings = normalizeSettings(settings);
    const nextBlocks = recalculateDocument(toEditorBlocks(blocks), nextSettings);
    set({
      documentId,
      blocks: nextBlocks,
      settings: nextSettings,
      cascadeNotifications: cascadeNotifications ?? [],
      selectedBlockId: nextBlocks[0]?.id ?? null,
      mode: 'split',
      historyPast: [],
      historyFuture: [],
    });
  },
  selectBlock: (blockId) => {
    set({ selectedBlockId: blockId });
  },
  setMode: (mode) => {
    set({ mode });
  },
  updateBlockText: (blockId, text) => {
    set((state) =>
      applyMutation(state, (draft) => {
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
      }),
    );
  },
  updateHeadingLevel: (blockId, level) => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.blocks = draft.blocks.map((block) =>
          block.id === blockId
            ? {
                ...block,
                level,
                blockType: level ? 'HEADING' : 'PARAGRAPH',
                title: level ? block.text.trim() : null,
                numberingOverride: level ? { mode: 'RENUMBER', customValue: null } : null,
              }
            : block,
        );
        draft.cascadeNotifications = [
          nextNotification('heading-numbering', 'Baslik hiyerarsisi guncellendi; numaralandirma yeniden hesaplandi.'),
          ...draft.cascadeNotifications,
        ].slice(0, 6);
        return draft;
      }),
    );
  },
  updateHeadingNumbering: (blockId, mode, customValue) => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.blocks = draft.blocks.map((block) =>
          block.id === blockId
            ? {
                ...block,
                numberingOverride:
                  mode === 'INHERIT'
                    ? null
                    : {
                        mode,
                        customValue: mode === 'CUSTOM' ? customValue?.trim() || null : null,
                      },
              }
            : block,
        );
        draft.cascadeNotifications = [
          nextNotification('heading-numbering', 'Baslik numaralandirmasi duzeltildi ve outline senkronize edildi.'),
          ...draft.cascadeNotifications,
        ].slice(0, 6);
        return draft;
      }),
    );
  },
  updateBlockSequenceNumber: (blockId, value) => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.blocks = draft.blocks.map((block) =>
          block.id === blockId
            ? {
                ...block,
                manualSequenceNumber: value && value > 0 ? value : null,
              }
            : block,
        );
        draft.cascadeNotifications = [
          nextNotification('sequence', 'Tablo/sekil/denklem numaralari kaskad olarak guncellendi.'),
          ...draft.cascadeNotifications,
        ].slice(0, 6);
        return draft;
      }),
    );
  },
  moveBlock: (blockId, toIndex) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const currentIndex = draft.blocks.findIndex((block) => block.id === blockId);
        if (currentIndex === -1 || currentIndex === toIndex) {
          return draft;
        }

        const boundedIndex = Math.max(0, Math.min(toIndex, draft.blocks.length - 1));
        const [moved] = draft.blocks.splice(currentIndex, 1);
        draft.blocks.splice(boundedIndex, 0, moved);
        draft.cascadeNotifications = [
          nextNotification('section-order', 'Bolum sirasi degisti; outline ve preview yeniden duzenlendi.'),
          ...draft.cascadeNotifications,
        ].slice(0, 6);
        return draft;
      }),
    );
  },
  mergeWithPrevious: (blockId) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const currentIndex = draft.blocks.findIndex((block) => block.id === blockId);
        if (currentIndex <= 0) {
          return draft;
        }

        const previous = draft.blocks[currentIndex - 1];
        const current = draft.blocks[currentIndex];
        draft.blocks[currentIndex - 1] = {
          ...previous,
          text: `${previous.text} ${current.text}`.trim(),
          title: previous.blockType === 'HEADING' ? `${previous.text} ${current.text}`.trim() : previous.title,
        };
        draft.blocks.splice(currentIndex, 1);
        return draft;
      }),
    );
  },
  splitBlock: (blockId, cursorPosition) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const currentIndex = draft.blocks.findIndex((block) => block.id === blockId);
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
      }),
    );
  },
  markAsParagraph: (blockId) => {
    set((state) =>
      applyMutation(state, (draft) => {
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
      }),
    );
  },
  setPageNumbering: (input) => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.settings = normalizeSettings({
          ...draft.settings,
          pageNumbering: {
            ...draft.settings.pageNumbering,
            ...input,
            unnumberedPages: [...(input.unnumberedPages ?? draft.settings.pageNumbering.unnumberedPages)],
          },
        });
        draft.cascadeNotifications = [
          nextNotification('page-numbering', 'Sayfa numaralandirma bolgeleri ve gecis noktasi guncellendi.'),
          ...draft.cascadeNotifications,
        ].slice(0, 6);
        return draft;
      }),
    );
  },
  setSequenceStart: (kind, value) => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.settings = normalizeSettings({
          ...draft.settings,
          sequence: {
            ...draft.settings.sequence,
            [kind]: Math.max(1, value),
          },
        });
        draft.cascadeNotifications = [
          nextNotification('sequence', 'Sirali numaralandirma baslangic degerleri guncellendi.'),
          ...draft.cascadeNotifications,
        ].slice(0, 6);
        return draft;
      }),
    );
  },
  dismissCascade: (notificationId) => {
    set((state) => ({
      cascadeNotifications: state.cascadeNotifications.filter(
        (notification) => notification.id !== notificationId,
      ),
    }));
  },
  undo: () => {
    const state = get();
    const previous = state.historyPast[state.historyPast.length - 1];
    if (!previous) {
      return;
    }

    const current = buildSnapshot(state);
    const restored = cloneSnapshot(previous);
    set({
      blocks: restored.blocks,
      settings: restored.settings,
      cascadeNotifications: restored.cascadeNotifications,
      historyPast: state.historyPast.slice(0, -1),
      historyFuture: [current, ...state.historyFuture].slice(0, 40),
      selectedBlockId: restored.blocks.find((block) => block.id === state.selectedBlockId)?.id ?? restored.blocks[0]?.id ?? null,
    });
  },
  redo: () => {
    const state = get();
    const next = state.historyFuture[0];
    if (!next) {
      return;
    }

    const current = buildSnapshot(state);
    const restored = cloneSnapshot(next);
    set({
      blocks: restored.blocks,
      settings: restored.settings,
      cascadeNotifications: restored.cascadeNotifications,
      historyPast: [...state.historyPast, current].slice(-40),
      historyFuture: state.historyFuture.slice(1),
      selectedBlockId: restored.blocks.find((block) => block.id === state.selectedBlockId)?.id ?? restored.blocks[0]?.id ?? null,
    });
  },
}));
