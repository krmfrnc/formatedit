'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../_lib/auth/AuthContext';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { io, type Socket } from 'socket.io-client';
import type {
  DocumentCitationValidationReport,
  DocumentPreviewState,
  DocumentVersionDiff,
  DocumentVersionRecord,
  EditorBlockNumberingMode,
  EditorDocumentVersionState,
  ParsedDocumentBlock,
  ParsedDocumentDiagnostics,
  ParsedDocumentResult,
} from '@formatedit/shared';
import { useEditorStore } from './editor-store';
import { EditorToolbar } from './components/editor-toolbar';
import { CitationManager } from './components/citation-manager';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';

function textToHtml(text: string): string {
  if (text.includes('</p>') || text.includes('</h1>') || text.includes('</h2>')) {
    return text;
  }
  return text
    .split('\n')
    .map((line) => `<p>${line || '<br />'}</p>`)
    .join('');
}

function htmlToText(html: string): string {
  // If we want to keep rich formatting, we should return html directly.
  return html;
}

function formatBlockLabel(block: Pick<ParsedDocumentBlock, 'blockType' | 'title' | 'text' | 'numberingPattern'>) {
  const baseTitle = block.title ?? (block.text.slice(0, 48) || 'Bos blok');
  return block.numberingPattern ? `${block.numberingPattern} ${baseTitle}` : baseTitle;
}

function parsePageList(value: string): number[] {
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((page) => Number.isInteger(page) && page > 0)
    .sort((left, right) => left - right);
}

export function EditorWorkbench() {
  const { token } = useAuth();
  const [documentIdInput, setDocumentIdInput] = useState('');
  const [status, setStatus] = useState('Parser sonucu yuklenmeye hazir.');
  const [diagnostics, setDiagnostics] = useState<ParsedDocumentDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [versionHistory, setVersionHistory] = useState<DocumentVersionRecord[]>([]);
  const [diffResult, setDiffResult] = useState<DocumentVersionDiff | null>(null);
  const [previewState, setPreviewState] = useState<DocumentPreviewState | null>(null);
  const [citationValidation, setCitationValidation] = useState<DocumentCitationValidationReport | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [lastLoadedVersionId, setLastLoadedVersionId] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [pageSkipDraft, setPageSkipDraft] = useState('');
  const [customNumberingValue, setCustomNumberingValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    documentId,
    blocks,
    selectedBlockId,
    mode,
    settings,
    cascadeNotifications,
    historyPast,
    historyFuture,
    setDocument,
    selectBlock,
    setMode,
    updateBlockText,
    updateHeadingLevel,
    updateHeadingNumbering,
    updateBlockSequenceNumber,
    moveBlock,
    mergeWithPrevious,
    splitBlock,
    markAsParagraph,
    setPageNumbering,
    setSequenceStart,
    dismissCascade,
    undo,
    redo,
  } = useEditorStore();

  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ?? null;
  const selectedHeadingMode: EditorBlockNumberingMode =
    selectedBlock?.numberingOverride?.mode ?? 'INHERIT';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const realtimeBaseUrl = process.env.NEXT_PUBLIC_WS_URL ?? apiBaseUrl;
  const previewBlocks = useMemo(() => previewState?.blocks ?? [], [previewState]);
  const citationBlockOrderIndexes = useMemo(
    () => new Set(citationValidation?.citationBlockOrderIndexes ?? []),
    [citationValidation],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Bu bolumu duzenlemeye baslayin...',
      }),
    ],
    content: selectedBlock ? textToHtml(selectedBlock.text) : '<p></p>',
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      if (!selectedBlockId) {
        return;
      }

      updateBlockText(selectedBlockId, htmlToText(currentEditor.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.commands.setContent(selectedBlock ? textToHtml(selectedBlock.text) : '<p></p>', {
      emitUpdate: false,
    });
  }, [editor, selectedBlock]);

  useEffect(() => {
    setPageSkipDraft(settings.pageNumbering.unnumberedPages.join(', '));
  }, [settings.pageNumbering.unnumberedPages]);

  useEffect(() => {
    setCustomNumberingValue(selectedBlock?.numberingOverride?.customValue ?? '');
  }, [selectedBlock?.id, selectedBlock?.numberingOverride?.customValue]);

  useEffect(() => {
    if (!token || !documentId || !blocks.length || !lastLoadedVersionId) {
      return;
    }

    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`${apiBaseUrl}/documents/${documentId}/working-version`, {
            method: 'PATCH',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              label: 'Autosaved from editor-lab',
              settings,
              cascadeNotifications,
              blocks: blocks.map((block) => ({
                blockType: block.blockType,
                semanticSectionType: block.semanticSectionType,
                title: block.title,
                text: block.text,
                level: block.level,
                numberingPattern: block.numberingPattern,
                numberingOverride: block.numberingOverride,
                manualSequenceNumber: block.manualSequenceNumber,
              })),
            }),
          });

          if (!response.ok) {
            setSaveStatus('error');
            setErrorMessage('Autosave basarisiz oldu.');
            return;
          }

          const workingState = (await response.json()) as EditorDocumentVersionState;
          setLastLoadedVersionId(workingState.versionId);
          setSaveStatus('saved');
          setErrorMessage(null);
          void loadVersionHistory(documentId, token);
          void loadPreviewState(documentId, token);
          void loadCitationValidationState(documentId, token);
        } catch {
          setSaveStatus('error');
          setErrorMessage('Autosave sirasinda baglanti hatasi olustu.');
        }
      })();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    apiBaseUrl,
    blocks,
    cascadeNotifications,
    documentId,
    lastLoadedVersionId,
    settings,
    token,
  ]);

  useEffect(() => {
    if (!token || !documentId) {
      return;
    }

    const socket: Socket = io(`${realtimeBaseUrl}/documents`, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      void socket.emit('document:join', {
        documentId,
        token,
      });
    });

    socket.on('preview:updated', (payload: { documentId: string; preview: DocumentPreviewState }) => {
      if (payload.documentId !== documentId) {
        return;
      }

      setPreviewState(payload.preview);
      setStatus(`Canli preview guncellendi: ${new Date(payload.preview.updatedAt).toLocaleTimeString()}`);
      void loadCitationValidationState(documentId, token);
    });

    socket.on('connect_error', () => {
      setStatus('Canli preview baglantisi kurulamadi, HTTP fallback kullaniliyor.');
    });

    return () => {
      void socket.emit('document:leave', { documentId });
      socket.disconnect();
    };
  }, [documentId, realtimeBaseUrl, token]);

  async function loadVersionHistory(activeDocumentId: string, activeToken: string): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/documents/${activeDocumentId}/versions`, {
      headers: {
        authorization: `Bearer ${activeToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return;
    }

    const history = (await response.json()) as DocumentVersionRecord[];
    setVersionHistory(history);
  }

  async function loadPreviewState(activeDocumentId: string, activeToken: string): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/documents/${activeDocumentId}/preview-state`, {
      headers: {
        authorization: `Bearer ${activeToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      setPreviewState(null);
      return;
    }

    const preview = (await response.json()) as DocumentPreviewState;
    setPreviewState(preview);
  }

  async function loadCitationValidationState(activeDocumentId: string, activeToken: string): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/documents/${activeDocumentId}/citation-validation`, {
      headers: {
        authorization: `Bearer ${activeToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      setCitationValidation(null);
      return;
    }

    const validation = (await response.json()) as DocumentCitationValidationReport;
    setCitationValidation(validation);
  }

  async function loadDocument(): Promise<void> {
    if (!token || !documentIdInput) {
      setStatus('Token ve document id gerekli.');
      return;
    }

    setIsLoading(true);
    setStatus('Parse sonucu ve diagnostics yukleniyor...');
    setErrorMessage(null);
    setCitationValidation(null);

    try {
      const [parseResponse, diagnosticsResponse, editorStateResponse, previewStateResponse, citationValidationResponse] =
        await Promise.all([
          fetch(`${apiBaseUrl}/documents/${documentIdInput}/parse-result`, {
            headers: {
              authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          }),
          fetch(`${apiBaseUrl}/documents/${documentIdInput}/parse-diagnostics`, {
            headers: {
              authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          }),
          fetch(`${apiBaseUrl}/documents/${documentIdInput}/editor-state`, {
            headers: {
              authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          }),
          fetch(`${apiBaseUrl}/documents/${documentIdInput}/preview-state`, {
            headers: {
              authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          }),
          fetch(`${apiBaseUrl}/documents/${documentIdInput}/citation-validation`, {
            headers: {
              authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          }),
        ]);

      if (!parseResponse.ok) {
        setStatus('Parse sonucu alinamadi. Token veya document id kontrol edilmeli.');
        setErrorMessage('Belge yuklenemedi.');
        return;
      }

      const parseResult = (await parseResponse.json()) as ParsedDocumentResult;
      const diagnosticsResult = diagnosticsResponse.ok
        ? ((await diagnosticsResponse.json()) as ParsedDocumentDiagnostics)
        : null;
      const editorState = editorStateResponse.ok
        ? ((await editorStateResponse.json()) as EditorDocumentVersionState)
        : null;
      const nextPreviewState = previewStateResponse.ok
        ? ((await previewStateResponse.json()) as DocumentPreviewState)
        : null;
      const nextCitationValidation = citationValidationResponse.ok
        ? ((await citationValidationResponse.json()) as DocumentCitationValidationReport)
        : null;

      setDocument(
        parseResult.summary.documentId,
        editorState?.blocks ?? parseResult.blocks,
        editorState?.settings,
        editorState?.cascadeNotifications,
      );
      setDiagnostics(diagnosticsResult);
      setPreviewState(nextPreviewState);
      setCitationValidation(nextCitationValidation);
      setLastLoadedVersionId(editorState?.versionId ?? parseResult.summary.documentVersionId);
      setSaveStatus('idle');
      setDiffResult(null);
      await loadVersionHistory(parseResult.summary.documentId, token);
      await loadCitationValidationState(parseResult.summary.documentId, token);
      setStatus(`${parseResult.blocks.length} blok yuklendi. Editor hazir.`);
    } catch {
      setStatus('Editor verisi yuklenirken hata olustu.');
      setErrorMessage('API yaniti okunamadi.');
    } finally {
      setIsLoading(false);
    }
  }

  async function createSnapshot(): Promise<void> {
    if (!token || !documentId) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/documents/${documentId}/snapshots`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        label: snapshotLabel || undefined,
      }),
    });

    if (!response.ok) {
      setStatus('Snapshot olusturulamadi.');
      setErrorMessage('Snapshot istegi basarisiz oldu.');
      return;
    }

    const snapshot = (await response.json()) as EditorDocumentVersionState;
    setLastLoadedVersionId(snapshot.versionId);
    setSnapshotLabel('');
    setStatus(`Snapshot olustu: ${snapshot.label ?? snapshot.versionId}`);
    setErrorMessage(null);
    await loadVersionHistory(documentId, token);
    await loadPreviewState(documentId, token);
    await loadCitationValidationState(documentId, token);
  }

  async function showDiff(compareVersionId: string): Promise<void> {
    if (!token || !documentId || !lastLoadedVersionId) {
      return;
    }

    const response = await fetch(
      `${apiBaseUrl}/documents/${documentId}/versions/${compareVersionId}/diff/${lastLoadedVersionId}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      setStatus('Diff alinamadi.');
      setErrorMessage('Versiyon farki hesabi basarisiz oldu.');
      return;
    }

    const diff = (await response.json()) as DocumentVersionDiff;
    setDiffResult(diff);
    setErrorMessage(null);
  }

  async function restoreVersion(versionId: string): Promise<void> {
    if (!token || !documentId) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/documents/${documentId}/versions/${versionId}/restore`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      setStatus('Versiyon geri yuklenemedi.');
      setErrorMessage('Restore islemi basarisiz oldu.');
      return;
    }

    const restored = (await response.json()) as EditorDocumentVersionState;
    setDocument(documentId, restored.blocks, restored.settings, restored.cascadeNotifications);
    setLastLoadedVersionId(restored.versionId);
    setStatus(`Versiyon geri yuklendi: ${restored.label ?? restored.versionId}`);
    setDiffResult(null);
    setErrorMessage(null);
    await loadVersionHistory(documentId, token);
    await loadPreviewState(documentId, token);
    await loadCitationValidationState(documentId, token);
  }

  return (
    <main className="premium-main" style={{ padding: 'calc(var(--nav-height) + 1.5rem) 2rem 2rem', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* Editor Header / Toolbar area */}
      <header className="glass-panel" style={{ padding: '1rem 2rem', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', position: 'sticky', top: 'calc(var(--nav-height) + 1rem)', zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Editor Lab</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)' }}>Workbench</span>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', height: '40px' }}></div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px', alignItems: 'center' }}>
          <input
            style={{ width: '100%', maxWidth: '300px', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', color: 'var(--text)', transition: 'border-color 0.2s', outline: 'none' }}
            value={documentIdInput}
            onChange={(event) => setDocumentIdInput(event.target.value)}
            placeholder="Belge Kodu (Örn: doc_123)"
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
          <button className="btn-glow" type="button" onClick={() => void loadDocument()} disabled={isLoading} style={{ padding: '0.6rem 1.5rem', borderRadius: '12px' }}>
            {isLoading ? 'Yükleniyor...' : 'Ortamı Yükle'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <button className="btn-ghost" type="button" onClick={() => setMode(mode === 'split' ? 'wysiwyg' : 'split')} style={{ border: '1px solid var(--border)' }}>
            {mode === 'split' ? 'Tam Ekran Modu' : 'Split View Modu'}
          </button>
          <div style={{ display: 'flex', gap: '0.4rem', borderLeft: '1px solid var(--border)', paddingLeft: '0.8rem' }}>
            <button className="btn-ghost" type="button" onClick={() => undo()} disabled={!historyPast.length} style={{ padding: '0.6rem', border: '1px solid var(--border)', opacity: !historyPast.length ? 0.5 : 1 }}>
              ↩
            </button>
            <button className="btn-ghost" type="button" onClick={() => redo()} disabled={!historyFuture.length} style={{ padding: '0.6rem', border: '1px solid var(--border)', opacity: !historyFuture.length ? 0.5 : 1 }}>
              ↪
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ padding: '0.6rem 1.2rem', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.includes('hata') || status.includes('gerekli') ? '#ef4444' : '#10b981' }}></span>
          <span style={{ color: 'var(--muted)' }}>Bağlantı:</span> 
          <strong style={{ fontWeight: 500 }}>{status}</strong>
        </div>
        <div className="glass-panel" style={{ padding: '0.6rem 1.2rem', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--muted)' }}>Bulut Senkronizasyonu:</span>
          <strong style={{ fontWeight: 500, color: saveStatus === 'idle' ? 'var(--text)' : saveStatus === 'error' ? '#ef4444' : '#10b981' }}>
            {saveStatus === 'idle' ? 'Bekliyor' : saveStatus === 'saving' ? 'Kaydediliyor...' : saveStatus === 'saved' ? 'Senkronize' : 'Ağ Hatası'}
          </strong>
        </div>
        {errorMessage && (
          <div className="glass-panel" style={{ padding: '0.6rem 1.2rem', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <strong style={{ color: '#ef4444' }}>{errorMessage}</strong>
          </div>
        )}
      </div>

      <section className={`editor-grid editor-grid-${mode}`} style={{ display: 'grid', gridTemplateColumns: mode === 'split' ? '280px 1fr 1fr' : '280px 1fr', gap: '1.5rem', height: 'calc(100vh - 300px)' }}>
        {/* OUTLINE PANEL */}
        <aside className="editor-panel glass-panel outline-panel" style={{ display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
          <div className="panel-head" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'radial-gradient(ellipse at top left, rgba(99,102,241,0.05), transparent)' }}>
            <div>
              <p className="eyebrow" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--accent)' }}>Navigator</p>
              <h2 style={{ margin: '0.3rem 0 0', fontSize: '1.2rem', fontWeight: 600 }}>Bölüm Ağacı</h2>
            </div>
          </div>
          <div className="outline-list" style={{ overflowY: 'auto', flex: 1, padding: '1rem' }}>
            {blocks.map((block, index) => (
              <button
                key={block.id}
                type="button"
                draggable
                className={`outline-item ${block.id === selectedBlockId ? 'outline-item-active' : ''} ${citationBlockOrderIndexes.has(block.orderIndex) ? 'outline-item-warning' : ''}`}
                style={{ 
                  padding: '0.8rem 1rem', paddingLeft: `${1 + (block.level ?? 1) * 0.75}rem`,
                  background: block.id === selectedBlockId ? 'var(--accent)' : 'transparent',
                  border: '1px solid transparent',
                  borderRadius: '12px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '4px',
                  transition: 'all 0.2s',
                  color: block.id === selectedBlockId ? '#fff' : 'var(--text)'
                }}
                onClick={() => selectBlock(block.id)}
                onDragStart={() => setDraggedBlockId(block.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedBlockId) {
                    moveBlock(draggedBlockId, index);
                    setDraggedBlockId(null);
                  }
                }}
              >
                <strong style={{ fontSize: '0.9rem', marginBottom: '4px', lineHeight: 1.3 }}>{formatBlockLabel(block)}</strong>
                <span style={{ fontSize: '0.7rem', color: block.id === selectedBlockId ? 'rgba(255,255,255,0.7)' : 'var(--muted)' }}>
                  {block.blockType} · AI Güveni: %{Math.round(block.confidenceScore * 100)}
                </span>
              </button>
            ))}
          </div>

          <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
            <h3 style={{ fontSize: '0.85rem', margin: '0 0 0.8rem 0', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Versiyon Kalıpları</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', flex: 1, fontSize: '0.8rem', outline: 'none' }}
                value={snapshotLabel}
                onChange={(event) => setSnapshotLabel(event.target.value)}
                placeholder="Örn: Final Draft V2"
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
              <button type="button" className="btn-secondary" style={{ padding: '0.6rem', fontSize: '0.8rem' }} onClick={() => void createSnapshot()}>Anı Yakala</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
              {versionHistory.slice(0,5).map((version) => (
                <div key={version.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 500 }}>{version.label ?? version.id.slice(0,6)}</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }} onClick={() => void showDiff(version.id)}>Kıyasla</button>
                    <button style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }} onClick={() => void restoreVersion(version.id)}>Dön</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* MAIN EDITOR PANEL */}
        <section className="editor-panel glass-panel" style={{ display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
          <div className="panel-head" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'radial-gradient(ellipse at top left, rgba(99,102,241,0.05), transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div style={{ padding: '0.5rem', background: 'rgba(99,102,241,0.1)', borderRadius: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
              </div>
              <div>
                <p className="eyebrow" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--accent)' }}>Main Workspace</p>
                <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 600 }}>{documentId ?? 'Belge Seçilmedi'}</h2>
              </div>
            </div>
          </div>
          {selectedBlock ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="editor-actions" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.01)' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Öğe Formatı</span>
                  <select
                    style={{ padding: '0.5rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--background)', outline: 'none', color: 'var(--text)', fontSize: '0.85rem' }}
                    value={selectedBlock.level ?? 0}
                    onChange={(event) => {
                      const nextLevel = Number(event.target.value);
                      updateHeadingLevel(selectedBlock.id, nextLevel === 0 ? null : nextLevel);
                    }}
                  >
                    <option value={0}>Normal Metin</option>
                    <option value={1}>H1 — Ana Bölüm</option>
                    <option value={2}>H2 — Alt Bölüm</option>
                    <option value={3}>H3 — Alt-Alt Bölüm</option>
                    <option value={4}>H4</option>
                    <option value={5}>H5</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Numara Motifi</span>
                  <select
                     style={{ padding: '0.5rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--background)', outline: 'none', color: 'var(--text)', fontSize: '0.85rem' }}
                    value={selectedHeadingMode}
                    onChange={(event) => {
                      const nextMode = event.target.value as EditorBlockNumberingMode;
                      updateHeadingNumbering(selectedBlock.id, nextMode, nextMode === 'CUSTOM' ? customNumberingValue : null);
                    }}
                    disabled={selectedBlock.blockType !== 'HEADING'}
                  >
                    <option value="INHERIT">Miras Al (Otomatik)</option>
                    <option value="RENUMBER">Sıfırdan Numara</option>
                    <option value="REMOVE">Kaldır (No-Num)</option>
                    <option value="CUSTOM">Özel (Custom)</option>
                  </select>
                </label>

                {selectedHeadingMode === 'CUSTOM' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Özel Numara</span>
                    <input
                      style={{ padding: '0.5rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--background)', width: '80px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
                      value={customNumberingValue}
                      onChange={(event) => {
                         setCustomNumberingValue(event.target.value);
                         updateHeadingNumbering(selectedBlock.id, 'CUSTOM', event.target.value);
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                      placeholder="Örn: A.1"
                    />
                  </label>
                )}

                {(selectedBlock.blockType === 'TABLE' || selectedBlock.blockType === 'FIGURE' || selectedBlock.blockType === 'EQUATION') && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Sınıflandırma Sırası</span>
                    <input
                      type="number"
                      min={1}
                      style={{ padding: '0.5rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--background)', width: '80px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
                      value={selectedBlock.manualSequenceNumber ?? ''}
                      onChange={(event) => updateBlockSequenceNumber(selectedBlock.id, Number(event.target.value) || null)}
                    />
                  </label>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginLeft: 'auto' }}>
                  <button type="button" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => splitBlock(selectedBlock.id)}>Bloku Böl</button>
                  <button type="button" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => mergeWithPrevious(selectedBlock.id)}>Üsttekiyle Birleştir</button>
                  <button type="button" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => markAsParagraph(selectedBlock.id)} disabled={selectedBlock.blockType === 'PARAGRAPH'}>Paragrafa İndirge</button>
                  <div style={{ display: 'flex', marginLeft: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem', background: 'var(--accent)', color: '#fff', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
                    {selectedBlock.blockType} / {selectedBlock.numberingPattern ?? 'Tanımlanmadı'}
                  </div>
                </div>
              </div>

              {editor && (
                <div style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <EditorToolbar editor={editor} />
                </div>
              )}

              <div className="tiptap-frame" style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', fontSize: '1.05rem', lineHeight: 1.7, background: 'var(--admin-surface)' }}>
                <EditorContent editor={editor} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--muted)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '1rem' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 500, color: 'var(--text)' }}>Odak Belirlenmedi</h3>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Düzenlemeye başlamak için sol panelden bir nod (bölüm) seçin.</p>
            </div>
          )}
        </section>

        {/* SPLIT PREVIEW PANEL */}
        {mode === 'split' && (
          <aside className="editor-panel glass-panel" style={{ display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
            <div className="panel-head" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'radial-gradient(ellipse at top right, rgba(99,102,241,0.05), transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(99,102,241,0.1)', borderRadius: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </div>
                <div>
                  <p className="eyebrow" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--accent)' }}>Live Preview</p>
                  <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 600 }}>Çıktı Kalıbı</h2>
                </div>
              </div>
            </div>
            
            <div className="preview-sheet" style={{ padding: '2.5rem', overflowY: 'auto', flex: 1, background: '#fff', color: '#111827', fontFamily: '"Georgia", serif', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.02)' }}>
              {(previewBlocks.length ? previewBlocks : blocks).map((block) => {
                const matchedBlock = blocks.find((entry) => entry.orderIndex === block.orderIndex);
                const isHeading = block.blockType === 'HEADING';
                const headingLevel = matchedBlock?.level ?? 2;
                const Tag = isHeading ? (`h${Math.min(headingLevel, 5)}` as any) : 'p';
                const label = matchedBlock ? formatBlockLabel(matchedBlock) : block.title ?? ('displayText' in block ? block.displayText : block.text);

                return (
                  <article
                    key={`${block.orderIndex}-${block.blockType}`}
                    style={{
                      marginBottom: isHeading ? '1rem' : '1.5rem',
                      marginTop: isHeading ? '2rem' : '0',
                      padding: selectedBlock?.orderIndex === block.orderIndex ? '0.5rem 1rem' : '0.5rem',
                      background: selectedBlock?.orderIndex === block.orderIndex ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      borderLeft: selectedBlock?.orderIndex === block.orderIndex ? '4px solid #6366f1' : '4px solid transparent',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      borderRadius: '0 8px 8px 0',
                    }}
                  >
                    <Tag style={{ margin: 0, fontWeight: isHeading ? 700 : 'normal', lineHeight: 1.4 }}>{label}</Tag>
                    {!isHeading && <p style={{ margin: 0, marginTop: '0.5rem', lineHeight: 1.7 }}>{'displayText' in block ? block.displayText : block.text}</p>}
                  </article>
                );
              })}
            </div>
          </aside>
        )}
      </section>

      {/* CASCADE NOTIFICATIONS */}
      {cascadeNotifications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {cascadeNotifications.map((notification) => (
            <div
              key={notification.id}
              className="glass-panel"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderLeft: `4px solid ${notification.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`,
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>{notification.message}</span>
              <button
                type="button"
                onClick={() => dismissCascade(notification.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS + DIAGNOSTICS PANELS */}
      {documentId && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* PAGE NUMBERING SETTINGS */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <p className="eyebrow" style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Sayfa Numaralandırma</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span>Ön Sayfa Stili</span>
                <select
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', outline: 'none' }}
                  value={settings.pageNumbering.frontMatterStyle}
                  onChange={(event) => setPageNumbering({ frontMatterStyle: event.target.value as 'roman' | 'arabic' })}
                >
                  <option value="roman">Roman (i, ii, iii)</option>
                  <option value="arabic">Arap (1, 2, 3)</option>
                </select>
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span>Ana Gövde Stili</span>
                <select
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', outline: 'none' }}
                  value={settings.pageNumbering.bodyStyle}
                  onChange={(event) => setPageNumbering({ bodyStyle: event.target.value as 'roman' | 'arabic' })}
                >
                  <option value="arabic">Arap (1, 2, 3)</option>
                  <option value="roman">Roman (i, ii, iii)</option>
                </select>
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span>Gövde Başlangıç Sayfa</span>
                <input
                  type="number"
                  min={1}
                  style={{ width: '60px', padding: '0.3rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}
                  value={settings.pageNumbering.bodyStartPage}
                  onChange={(event) => setPageNumbering({ bodyStartPage: Math.max(1, Number(event.target.value) || 1) })}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span>Atlanan Sayfalar</span>
                <input
                  style={{ width: '120px', padding: '0.3rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.8rem' }}
                  value={pageSkipDraft}
                  onChange={(event) => setPageSkipDraft(event.target.value)}
                  onBlur={() => setPageNumbering({ unnumberedPages: parsePageList(pageSkipDraft) })}
                  placeholder="ör: 1, 2, 3"
                />
              </label>
            </div>
          </div>

          {/* SEQUENCE NUMBERING SETTINGS */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <p className="eyebrow" style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Sıralı Numaralandırma</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span>Tablo Başlangıç</span>
                <input
                  type="number"
                  min={1}
                  style={{ width: '60px', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', outline: 'none' }}
                  value={settings.sequence.tableStart}
                  onChange={(event) => setSequenceStart('tableStart', Number(event.target.value) || 1)}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span>Şekil Başlangıç</span>
                <input
                  type="number"
                  min={1}
                  style={{ width: '60px', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', outline: 'none' }}
                  value={settings.sequence.figureStart}
                  onChange={(event) => setSequenceStart('figureStart', Number(event.target.value) || 1)}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span>Denklem Başlangıç</span>
                <input
                  type="number"
                  min={1}
                  style={{ width: '60px', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', outline: 'none' }}
                  value={settings.sequence.equationStart}
                  onChange={(event) => setSequenceStart('equationStart', Number(event.target.value) || 1)}
                />
              </label>
            </div>
          </div>

          {/* DIAGNOSTICS PANEL */}
          {diagnostics && (
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
              <p className="eyebrow" style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Parse Diagnostics</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Parse Kaynağı</span>
                  <span>{diagnostics.parseSource}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>AI Destekli</span>
                  <span>{diagnostics.aiAssisted ? '✅ Evet' : '❌ Hayır'}</span>
                </div>
                {diagnostics.lowConfidenceBlocks.length > 0 && (
                  <div>
                    <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>⚠ {diagnostics.lowConfidenceBlocks.length} düşük güvenli blok</span>
                    <ul style={{ margin: '0.3rem 0 0 1rem', padding: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {diagnostics.lowConfidenceBlocks.slice(0, 5).map((block) => (
                        <li key={block.orderIndex}>
                          #{block.orderIndex} {block.blockType} — %{Math.round(block.confidenceScore * 100)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CITATION MANAGER */}
          <CitationManager blocks={blocks} />

          {/* CITATION VALIDATION PANEL */}
          {citationValidation && (
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
              <p className="eyebrow" style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Atıf Doğrulama</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Toplam Atıf</span>
                  <span>{citationValidation.report?.entryCount ?? citationValidation.citationBlockOrderIndexes.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Sorunlu Blok Sayısı</span>
                  <span style={{ color: (citationValidation.citationBlockOrderIndexes?.length ?? 0) > 0 ? '#f59e0b' : 'inherit' }}>
                    {citationValidation.citationBlockOrderIndexes?.length ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* DIFF RESULT PANEL */}
      {diffResult && (
        <section className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <p className="eyebrow" style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, margin: 0 }}>Versiyon Karşılaştırma</p>
              <h3 style={{ margin: '0.3rem 0 0 0', fontSize: '1.1rem' }}>Diff Sonucu</h3>
            </div>
            <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setDiffResult(null)}>Kapat</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
            {(diffResult.changes ?? []).map((change, index) => (
              <div
                key={index}
                style={{
                  padding: '0.7rem 1rem',
                  borderRadius: '8px',
                  background: change.changeType === 'added' ? 'rgba(34, 197, 94, 0.1)' : change.changeType === 'removed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  borderLeft: `4px solid ${change.changeType === 'added' ? '#22c55e' : change.changeType === 'removed' ? '#ef4444' : '#6b7280'}`,
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ fontWeight: 600, marginRight: '0.5rem', textTransform: 'uppercase', fontSize: '0.7rem', color: change.changeType === 'added' ? '#22c55e' : change.changeType === 'removed' ? '#ef4444' : '#6b7280' }}>
                  {change.changeType === 'added' ? 'EKLENDİ' : change.changeType === 'removed' ? 'SİLİNDİ' : 'DEĞİŞTİ'}
                </span>
                <span style={{ color: 'var(--muted)' }}>Blok #{change.orderIndex} ({change.blockType})</span>
                {change.beforeText && <div style={{ marginTop: '0.3rem', color: '#ef4444', textDecoration: 'line-through', fontSize: '0.8rem' }}>{change.beforeText.slice(0, 120)}</div>}
                {change.afterText && <div style={{ marginTop: '0.2rem', color: '#22c55e', fontSize: '0.8rem' }}>{change.afterText.slice(0, 120)}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
