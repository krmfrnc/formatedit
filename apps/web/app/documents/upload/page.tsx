'use client';

import { useCallback, useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { useTranslation } from '../../_lib/i18n/useTranslation';
import { useAuthContext } from '../../_lib/AuthContext';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

const ACCEPTED_EXTENSIONS = ['.docx', '.doc', '.pdf', '.txt', '.rtf', '.odt'];

export default function DocumentsUploadPage() {
  const { t } = useTranslation();
  const { token } = useAuthContext();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle', progress: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const first = 'item' in files ? files[0] : files[0];
    if (!first) return;
    setFile(first);
    setState({ status: 'idle', progress: 0 });
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const startUpload = useCallback(() => {
    if (!file) return;

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', `${apiUrl}/documents/upload`);
    xhr.withCredentials = true;
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      setState({ status: 'uploading', progress: Math.round((event.loaded / event.total) * 100) });
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { id?: string; documentId?: string };
          setState({
            status: 'success',
            progress: 100,
            documentId: data.id ?? data.documentId,
          });
        } catch {
          setState({ status: 'success', progress: 100 });
        }
      } else if (xhr.status === 401) {
        setState({ status: 'error', progress: 0, error: t('upload.error_unauthorized') });
      } else {
        setState({ status: 'error', progress: 0, error: `${t('upload.error_generic')} (${xhr.status})` });
      }
    });

    xhr.addEventListener('error', () => {
      setState({ status: 'error', progress: 0, error: t('upload.error_network') });
    });

    xhr.addEventListener('abort', () => {
      setState({ status: 'idle', progress: 0 });
    });

    const form = new FormData();
    form.append('file', file);
    setState({ status: 'uploading', progress: 0 });
    xhr.send(form);
  }, [file, token, t]);

  const cancelUpload = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setState({ status: 'idle', progress: 0 });
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return (
    <main className="auth-shell" style={{ paddingTop: '4rem' }}>
      <section className="glass-panel" style={{ maxWidth: 720, width: '100%', padding: '2.5rem', borderRadius: 24, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <header>
          <p className="eyebrow" style={{ color: 'var(--accent)' }}>{t('upload.eyebrow')}</p>
          <h1 className="text-gradient" style={{ margin: '0.5rem 0 0.75rem', fontSize: '2.5rem', lineHeight: 1.1 }}>{t('upload.title')}</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>{t('upload.subtitle')}</p>
        </header>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 18,
            padding: '3rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(166, 75, 42, 0.06)' : 'transparent',
            transition: 'border-color 0.2s, background 0.2s',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            style={{ display: 'none' }}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
          />
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
          <strong style={{ display: 'block', marginBottom: '0.4rem' }}>
            {file ? file.name : t('upload.dropzone_title')}
          </strong>
          <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
              : t('upload.dropzone_hint')}
          </span>
        </label>

        {state.status === 'uploading' && (
          <div aria-live="polite">
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${state.progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s' }} />
            </div>
            <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
              {t('upload.uploading')} — {state.progress}%
            </p>
          </div>
        )}

        {state.status === 'success' && (
          <p role="status" style={{ color: '#10b981', margin: 0 }}>
            ✓ {t('upload.success')}
          </p>
        )}

        {state.status === 'error' && (
          <p role="alert" style={{ color: '#ef4444', margin: 0 }}>
            {state.error ?? t('upload.error_generic')}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          {state.status === 'uploading' ? (
            <button type="button" className="btn-secondary" onClick={cancelUpload}>
              {t('common.cancel')}
            </button>
          ) : (
            <>
              {file && (
                <button type="button" className="btn-secondary" onClick={reset}>
                  {t('upload.reset')}
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={!file || state.status === 'success'}
                onClick={startUpload}
              >
                {t('upload.submit')}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
