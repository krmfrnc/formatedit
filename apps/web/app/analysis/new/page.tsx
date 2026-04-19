'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnalysisCategoryRecord, AnalysisTicketRecord } from '@formatedit/shared';
import { useAuthContext } from '../../_lib/AuthContext';
import { useTranslation } from '../../_lib/i18n/useTranslation';
import { analysisApiUrl } from '../_shared';

type WizardStep = 'category' | 'details' | 'files' | 'review';
const steps: WizardStep[] = ['category', 'details', 'files', 'review'];

interface WizardDraft {
  categorySlug: string;
  title: string;
  brief: string;
  deliveryMode: 'STANDARD' | 'EXPRESS';
  dataFile: File | null;
  descriptionFile: File | null;
  sampleFile: File | null;
}

const emptyDraft: WizardDraft = {
  categorySlug: '',
  title: '',
  brief: '',
  deliveryMode: 'STANDARD',
  dataFile: null,
  descriptionFile: null,
  sampleFile: null,
};

export default function AnalysisWizardPage() {
  const { t } = useTranslation();
  const { authFetch, isAuthenticated } = useAuthContext();
  const router = useRouter();

  const [categories, setCategories] = useState<AnalysisCategoryRecord[]>([]);
  const [catError, setCatError] = useState<string | null>(null);
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    void (async () => {
      try {
        const res = await authFetch(`${analysisApiUrl}/analysis-categories`);
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as AnalysisCategoryRecord[];
        setCategories(data);
      } catch {
        setCatError(t('analysis.wizard.error_categories'));
      }
    })();
  }, [authFetch, isAuthenticated, t]);

  const currentStep = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  const canAdvance = useMemo(() => {
    if (currentStep === 'category') return Boolean(draft.categorySlug);
    if (currentStep === 'details') {
      return draft.title.trim().length >= 3 && draft.brief.trim().length >= 10;
    }
    return true;
  }, [currentStep, draft]);

  const update = useCallback(<K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const createRes = await authFetch(`${analysisApiUrl}/analysis/tickets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          categorySlug: draft.categorySlug,
          title: draft.title.trim(),
          brief: draft.brief.trim(),
          deliveryMode: draft.deliveryMode,
        }),
      });
      if (!createRes.ok) throw new Error('create failed');
      const ticket = (await createRes.json()) as AnalysisTicketRecord;

      const uploads: Array<[File | null, 'data' | 'description' | 'sample', string]> = [
        [draft.dataFile, 'data', 'dataFile'],
        [draft.descriptionFile, 'description', 'descriptionFile'],
        [draft.sampleFile, 'sample', 'sampleFile'],
      ];
      for (const [file, route, field] of uploads) {
        if (!file) continue;
        const form = new FormData();
        form.append(field, file);
        await authFetch(`${analysisApiUrl}/analysis/tickets/${ticket.id}/files/${route}`, {
          method: 'POST',
          body: form,
        });
      }

      router.push(`/analysis/${ticket.id}`);
    } catch {
      setSubmitError(t('analysis.wizard.error_create'));
      setSubmitting(false);
    }
  }, [authFetch, draft, router, t]);

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <section
        className="glass-panel"
        style={{ padding: '2rem', borderRadius: '24px', marginBottom: '1.5rem' }}
      >
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          {t('analysis.eyebrow')}
        </p>
        <h1 className="text-gradient" style={{ fontSize: '2.2rem', margin: '0.5rem 0' }}>
          {t('analysis.wizard.title')}
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>{t('analysis.wizard.subtitle')}</p>

        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '8px',
              background: 'rgba(0,0,0,0.1)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.3s',
              }}
            />
          </div>
          <strong style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            {stepIndex + 1} / {steps.length}
          </strong>
        </div>
      </section>

      <section
        className="glass-panel"
        style={{ padding: '2rem', borderRadius: '24px', marginBottom: '1.5rem' }}
      >
        <h2 style={{ marginTop: 0 }}>{t(`analysis.wizard.step_${currentStep}`)}</h2>

        {currentStep === 'category' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              {t('analysis.wizard.category_hint')}
            </p>
            {catError && (
              <p role="alert" style={{ color: '#ef4444', margin: 0 }}>
                {catError}
              </p>
            )}
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {categories.map((cat) => {
                const selected = draft.categorySlug === cat.slug;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => update('categorySlug', cat.slug)}
                    style={{
                      textAlign: 'left',
                      padding: '1rem 1.25rem',
                      borderRadius: '14px',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      background: selected
                        ? 'rgba(166, 75, 42, 0.08)'
                        : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                      {cat.name}
                    </strong>
                    {cat.description && (
                      <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                        {cat.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)' }}>
                {t('analysis.wizard.title_label')}
              </span>
              <input
                value={draft.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder={t('analysis.wizard.title_placeholder')}
                maxLength={200}
                style={{
                  padding: '0.8rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.6)',
                  outline: 'none',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)' }}>
                {t('analysis.wizard.brief_label')}
              </span>
              <textarea
                value={draft.brief}
                onChange={(e) => update('brief', e.target.value)}
                placeholder={t('analysis.wizard.brief_placeholder')}
                rows={8}
                maxLength={10_000}
                style={{
                  padding: '0.8rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.6)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)' }}>
                {t('analysis.wizard.delivery_label')}
              </span>
              <select
                value={draft.deliveryMode}
                onChange={(e) =>
                  update('deliveryMode', e.target.value as WizardDraft['deliveryMode'])
                }
                style={{
                  padding: '0.8rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.8)',
                  outline: 'none',
                }}
              >
                <option value="STANDARD">{t('analysis.delivery.STANDARD')}</option>
                <option value="EXPRESS">{t('analysis.delivery.EXPRESS')}</option>
              </select>
            </label>
          </div>
        )}

        {currentStep === 'files' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              {t('analysis.wizard.files_hint')}
            </p>
            <FileRow
              label={t('analysis.wizard.file_data')}
              file={draft.dataFile}
              onChange={(f) => update('dataFile', f)}
            />
            <FileRow
              label={t('analysis.wizard.file_description')}
              file={draft.descriptionFile}
              onChange={(f) => update('descriptionFile', f)}
            />
            <FileRow
              label={t('analysis.wizard.file_sample')}
              file={draft.sampleFile}
              onChange={(f) => update('sampleFile', f)}
            />
          </div>
        )}

        {currentStep === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <ReviewRow
              label={t('analysis.wizard.category_label')}
              value={
                categories.find((c) => c.slug === draft.categorySlug)?.name ?? draft.categorySlug
              }
            />
            <ReviewRow label={t('analysis.wizard.title_label')} value={draft.title} />
            <ReviewRow label={t('analysis.wizard.brief_label')} value={draft.brief} multiline />
            <ReviewRow
              label={t('analysis.wizard.delivery_label')}
              value={t(`analysis.delivery.${draft.deliveryMode}`)}
            />
            <ReviewRow
              label={t('analysis.wizard.file_data')}
              value={draft.dataFile?.name ?? '—'}
            />
            <ReviewRow
              label={t('analysis.wizard.file_description')}
              value={draft.descriptionFile?.name ?? '—'}
            />
            <ReviewRow
              label={t('analysis.wizard.file_sample')}
              value={draft.sampleFile?.name ?? '—'}
            />
            {submitError && (
              <p role="alert" style={{ color: '#ef4444', margin: 0 }}>
                {submitError}
              </p>
            )}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <Link
          href="/analysis"
          className="btn-secondary"
          style={{ padding: '0.7rem 1.4rem', textDecoration: 'none' }}
        >
          {t('common.cancel')}
        </Link>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            style={{ opacity: stepIndex === 0 ? 0.5 : 1 }}
          >
            {t('analysis.wizard.back')}
          </button>
          {currentStep === 'review' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void submit()}
              disabled={submitting}
              style={{ width: 'auto' }}
            >
              {submitting ? t('analysis.wizard.creating') : t('analysis.wizard.submit')}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
              disabled={!canAdvance}
              style={{ width: 'auto', opacity: canAdvance ? 1 : 0.5 }}
            >
              {t('analysis.wizard.next')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function FileRow({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1rem 1.25rem',
        borderRadius: '14px',
        border: '1px dashed var(--border)',
        background: 'rgba(255,255,255,0.4)',
        cursor: 'pointer',
      }}
    >
      <span>
        <strong style={{ display: 'block' }}>{label}</strong>
        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : '—'}
        </span>
      </span>
      <input
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function ReviewRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: '1rem',
        alignItems: 'start',
        paddingBottom: '0.6rem',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ whiteSpace: multiline ? 'pre-wrap' : 'normal', wordBreak: 'break-word' }}>
        {value || '—'}
      </span>
    </div>
  );
}
