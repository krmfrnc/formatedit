/**
 * Smoke test for the editor Zustand store (F2 harness verification).
 *
 * Deeper coverage of editor behavior lives in the backend e2e spec
 * `test/editor-store.e2e-spec.ts`; this file exists to confirm Vitest,
 * jsdom, and the shared-package alias are wired correctly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../app/editor-lab/editor-store';
import type { ParsedDocumentBlock } from '@formatedit/shared';

const sampleBlocks: ParsedDocumentBlock[] = [
  {
    blockType: 'HEADING',
    text: 'Introduction',
    level: 1,
    runs: [],
    numberingPattern: '1',
    hasCitation: false,
    hasFootnote: false,
    hasTableLabel: false,
    hasFigureLabel: false,
    hasEquation: false,
    tableOrFigureLabel: null,
    semanticSectionType: 'INTRODUCTION',
    templateSlot: 'introduction',
    confidenceScore: 0.9,
    title: 'Introduction',
  } as unknown as ParsedDocumentBlock,
  {
    blockType: 'PARAGRAPH',
    text: 'Body text here.',
    level: null,
    runs: [],
    numberingPattern: null,
    hasCitation: false,
    hasFootnote: false,
    hasTableLabel: false,
    hasFigureLabel: false,
    hasEquation: false,
    tableOrFigureLabel: null,
    semanticSectionType: null,
    templateSlot: null,
    confidenceScore: 0.4,
    title: null,
  } as unknown as ParsedDocumentBlock,
];

describe('useEditorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
      documentId: null,
      blocks: [],
      selectedBlockId: null,
      historyPast: [],
      historyFuture: [],
      cascadeNotifications: [],
    });
  });

  it('hydrates a document and assigns stable block ids', () => {
    useEditorStore.getState().setDocument('doc-1', sampleBlocks);

    const { documentId, blocks } = useEditorStore.getState();
    expect(documentId).toBe('doc-1');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].id).toBeTruthy();
    expect(blocks[1].id).toBeTruthy();
    expect(blocks[0].id).not.toBe(blocks[1].id);
  });

  it('toggles between split and wysiwyg modes', () => {
    const store = useEditorStore.getState();
    expect(store.mode).toBe('split');

    store.setMode('wysiwyg');
    expect(useEditorStore.getState().mode).toBe('wysiwyg');

    store.setMode('split');
    expect(useEditorStore.getState().mode).toBe('split');
  });

  it('supports undo after mutating a block', () => {
    useEditorStore.getState().setDocument('doc-1', sampleBlocks);
    const firstBlockId = useEditorStore.getState().blocks[0].id;

    useEditorStore.getState().updateBlockText(firstBlockId, 'Changed heading');
    expect(useEditorStore.getState().blocks[0].text).toBe('Changed heading');

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().blocks[0].text).toBe('Introduction');
  });
});
