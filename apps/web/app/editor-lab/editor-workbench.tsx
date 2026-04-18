'use client';

import { useEffect, useMemo, useState } from 'react';
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

function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => `<p>${line || '<br />'}</p>`)
    .join('');
}

function htmlToText(html: string): string {
  return html
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
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
  const [token, setToken] = useState('');
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
        heading: false,
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
    <main className="editor-shell" style={{ padding: '2rem', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <section className="editor-hero glass-panel" style={{ padding: '2.5rem', borderRadius: '24px' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600 }}>Batch 6 · FormatEdit Pro</p>
        <h1 className="text-gradient" style={{ fontSize: '2.8rem', marginTop: '0.5rem', marginBottom: '1rem' }}>SaaS Editor Laboratuvarı</h1>
        <p className="editor-copy" style={{ color: 'var(--muted)', fontSize: '1.1rem', maxWidth: '800px' }}>
          Yapay zeka tarafından parse edilmiş belge bloklarını Tiptap ve Zustand ile düzenleyin; Outline (İçindekiler), otomatik numaralandırma, versiyon geçmişi ve canlı önizleme tek ekranda toplandı.
        </p>
      </section>

      <section className="editor-toolbar glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem', borderRadius: '20px', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '200px' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Dev Token</span>
          <input
            type="password"
            style={{ padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="JWT access token"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '200px' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Document ID</span>
          <input
            style={{ padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
            value={documentIdInput}
            onChange={(event) => setDocumentIdInput(event.target.value)}
            placeholder="document_123"
          />
        </label>
        <div style={{ display: 'flex', gap: '0.8rem', marginTop: 'auto', marginBottom: '2px' }}>
          <button className="btn-primary" type="button" onClick={() => void loadDocument()} disabled={isLoading} style={{ padding: '0.7rem 1.5rem', width: 'auto' }}>
            {isLoading ? 'Yükleniyor...' : 'Editoru Aç'}
          </button>
          <button className="btn-secondary" type="button" onClick={() => setMode(mode === 'split' ? 'wysiwyg' : 'split')} style={{ width: 'auto' }}>
            {mode === 'split' ? 'WYSIWYG e Geç' : 'Split View'}
          </button>
          <button className="btn-secondary" type="button" onClick={() => undo()} disabled={!historyPast.length} style={{ width: 'auto', padding: '0.7rem' }}>
            ↩
          </button>
          <button className="btn-secondary" type="button" onClick={() => redo()} disabled={!historyFuture.length} style={{ width: 'auto', padding: '0.7rem' }}>
            ↪
          </button>
        </div>
      </section>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <p className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', margin: 0, fontSize: '0.9rem', color: status.includes('hata') ? '#ef4444' : 'inherit' }}>
          <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Durum:</span>{status}
        </p>
        <p className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', margin: 0, fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Kayıt:</span>
          {saveStatus === 'idle' ? '🟢 Hazır' : saveStatus === 'saving' ? '⏳ Kaydediliyor' : saveStatus === 'saved' ? '✅ Senkronize' : '🚨 Hata'}
        </p>
        {errorMessage ? <p className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', margin: 0, fontSize: '0.9rem', color: '#ef4444', border: '1px solid #ef444455' }}>{errorMessage}</p> : null}
      </div>

      <section className={`editor-grid editor-grid-${mode}`} style={{ display: 'grid', gridTemplateColumns: mode === 'split' ? '280px 1fr 1fr' : '280px 1fr', gap: '1.5rem', height: 'calc(100vh - 300px)' }}>
        {/* OUTLINE PANEL */}
        <aside className="editor-panel glass-panel outline-panel" style={{ display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
          <div className="panel-head" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <div>
              <p className="eyebrow" style={{ margin: 0, fontSize: '0.75rem' }}>Navigator</p>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Bölüm Ağacı</h2>
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
                  padding: '0.7rem 1rem', paddingLeft: `${1 + (block.level ?? 1) * 0.75}rem`,
                  background: block.id === selectedBlockId ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                  border: block.id === selectedBlockId ? '1px solid var(--accent)' : '1px solid transparent',
                  borderRadius: '12px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '4px',
                  transition: 'all 0.2s',
                  color: 'var(--text)'
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
                <strong style={{ fontSize: '0.9rem', marginBottom: '2px' }}>{formatBlockLabel(block)}</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                  {block.blockType} · G: {Math.round(block.confidenceScore * 100)}%
                </span>
              </button>
            ))}
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Versiyon Geçmişi</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', flex: 1, fontSize: '0.8rem' }}
                value={snapshotLabel}
                onChange={(event) => setSnapshotLabel(event.target.value)}
                placeholder="Örn: Final Draft"
              />
              <button type="button" className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => void createSnapshot()}>Kaydet</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
              {versionHistory.slice(0,5).map((version) => (
                <div key={version.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <span>{version.label ?? version.id.slice(0,6)}</span>
                  <div>
                    <button style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginRight: '5px' }} onClick={() => void showDiff(version.id)}>Fark</button>
                    <button style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => void restoreVersion(version.id)}>Geri Yükle</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* MAIN EDITOR PANEL */}
        <section className="editor-panel glass-panel" style={{ display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
          <div className="panel-head" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <div>
              <p className="eyebrow" style={{ margin: 0, fontSize: '0.75rem' }}>Main Workspace</p>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{documentId ?? 'Belge Seçilmedi'}</h2>
            </div>
          </div>

          {selectedBlock ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="editor-actions" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Başlık Tipi</span>
                  <select
                    style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent' }}
                    value={selectedBlock.level ?? 0}
                    onChange={(event) => {
                      const nextLevel = Number(event.target.value);
                      updateHeadingLevel(selectedBlock.id, nextLevel === 0 ? null : nextLevel);
                    }}
                  >
                    <option value={0}>Normal Metin</option>
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Numaratör</span>
                  <select
                    style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent' }}
                    value={selectedHeadingMode}
                    onChange={(event) => {
                      const nextMode = event.target.value as EditorBlockNumberingMode;
                      updateHeadingNumbering(selectedBlock.id, nextMode, nextMode === 'CUSTOM' ? customNumberingValue : null);
                    }}
                    disabled={selectedBlock.blockType !== 'HEADING'}
                  >
                    <option value="INHERIT">Miras Al</option>
                    <option value="RENUMBER">Sıfırdan</option>
                    <option value="REMOVE">Kaldır</option>
                    <option value="CUSTOM">Özel</option>
                  </select>
                </label>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => splitBlock(selectedBlock.id)}>Bloku Böl</button>
                  <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => mergeWithPrevious(selectedBlock.id)}>Üsttekiyle Birleştir</button>
                  <span style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', background: 'var(--accent)', color: '#fff', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {selectedBlock.blockType} / {selectedBlock.numberingPattern ?? 'No-Num'}
                  </span>
                </div>
              </div>

              <div className="tiptap-frame" style={{ flex: 1, padding: '2rem', overflowY: 'auto', fontSize: '1.05rem', lineHeight: 1.6 }}>
                <EditorContent editor={editor} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', flex: 1, color: 'var(--muted)' }}>
              <p>Düzenlemek İçin Soldan Bir Node Seçin.</p>
            </div>
          )}
        </section>

        {/* SPLIT PREVIEW PANEL */}
        {mode === 'split' && (
          <aside className="editor-panel glass-panel" style={{ display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
            <div className="panel-head" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, fontSize: '0.75rem' }}>Live Preview</p>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Çıktı Kalıbı</h2>
              </div>
            </div>
            
            <div className="preview-sheet" style={{ padding: '2rem', overflowY: 'auto', flex: 1, background: 'var(--admin-surface)', color: 'var(--text)', fontFamily: 'serif' }}>
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
                      padding: selectedBlock?.orderIndex === block.orderIndex ? '0.5rem' : '0',
                      background: selectedBlock?.orderIndex === block.orderIndex ? 'rgba(217, 119, 6, 0.05)' : 'transparent',
                      borderLeft: selectedBlock?.orderIndex === block.orderIndex ? '4px solid var(--accent)' : '4px solid transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Tag style={{ margin: 0, fontWeight: isHeading ? 700 : 'normal' }}>{label}</Tag>
                    {!isHeading && <p style={{ margin: 0, marginTop: '0.5rem' }}>{'displayText' in block ? block.displayText : block.text}</p>}
                  </article>
                );
              })}
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}
