'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { TemplateParameterSet, TemplateRecord, WorkTypeSettingRecord } from '@formatedit/shared';
import {
  emptyTemplateParameters,
  sectionFieldMap,
  sectionLabels,
  type TemplateSectionKey,
} from '../template-form-config';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface WizardDraft {
  name: string;
  description: string;
  baseTemplateId?: string;
  templateParameters: TemplateParameterSet;
}

const steps = Object.keys(sectionLabels) as TemplateSectionKey[];

const defaultDraft: WizardDraft = {
  name: '',
  description: '',
  baseTemplateId: undefined,
  templateParameters: emptyTemplateParameters,
};

export function TemplateWizard() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('Hazir');
  const [officialTemplates, setOfficialTemplates] = useState<TemplateRecord[]>([]);
  const [workTypeSettings, setWorkTypeSettings] = useState<WorkTypeSettingRecord[]>([]);
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(defaultDraft);

  const currentStep = steps[currentStepIndex];
  const progress = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  const selectedBaseTemplate = useMemo(
    () => officialTemplates.find((template) => template.id === draft.baseTemplateId) ?? null,
    [draft.baseTemplateId, officialTemplates],
  );

  async function loadTemplates() {
    setStatus('Resmi sablonlar yukleniyor...');
    try {
      const [templatesResponse, workTypesResponse] = await Promise.all([
        fetch(`${apiUrl}/templates${workTypeFilter ? `?workType=${encodeURIComponent(workTypeFilter)}` : ''}`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/template-work-types`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
      ]);

      if (!templatesResponse.ok || !workTypesResponse.ok) {
        setStatus('Resmi sablonlar alinamadi.');
        return;
      }

      const body = (await templatesResponse.json()) as TemplateRecord[];
      const workTypes = (await workTypesResponse.json()) as WorkTypeSettingRecord[];
      setOfficialTemplates(body);
      setWorkTypeSettings(workTypes);
      setStatus(`✅ ${body.length} sablon yuklendi`);
    } catch {
      setStatus('🚨 API baglanti hatasi!');
    }
  }

  function applyBaseTemplate(templateId: string) {
    const baseTemplate = officialTemplates.find((template) => template.id === templateId);
    if (!baseTemplate) {
      setDraft((current) => ({
        ...current,
        baseTemplateId: undefined,
      }));
      return;
    }

    setDraft((current) => ({
      ...current,
      baseTemplateId: baseTemplate.id,
      templateParameters: baseTemplate.templateParameters,
      name: current.name || `${baseTemplate.name} ozel`,
      description: current.description || (baseTemplate.description ?? ''),
    }));
    setStatus(`✨ Baz sablon ayarlandi: ${baseTemplate.name}`);
  }

  function updateTopLevel<K extends keyof Omit<WizardDraft, 'templateParameters'>>(key: K, value: WizardDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateSectionField(section: TemplateSectionKey, fieldKey: string, value: string | number | boolean) {
    setDraft((current) => ({
      ...current,
      templateParameters: {
        ...current.templateParameters,
        [section]: {
          ...current.templateParameters[section],
          [fieldKey]: value,
        },
      },
    }));
  }

  async function saveTemplate() {
    if (!draft.name.trim()) {
      setStatus('🚨 Sablon adi girilmelidir!');
      return;
    }

    setStatus('Kisisel sablon kaydediliyor⏳');
    try {
      const response = await fetch(`${apiUrl}/templates/me/custom`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description.trim() || undefined,
          baseTemplateId: draft.baseTemplateId,
          templateParameters: draft.templateParameters,
        }),
      });

      if (!response.ok) {
        setStatus('🚨 Sablon kaydi basarisiz oldu');
        return;
      }

      setStatus('🎉 Kisisel sablon basariyla kaydedildi!');
    } catch {
      setStatus('🚨 Kayit sirasinda baglanti koptu');
    }
  }

  return (
    <main style={{ maxWidth: '1300px', margin: '0 auto', padding: '2rem' }}>
      <section className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px', marginBottom: '2rem' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600 }}>Custom Template Wizard</p>
        <h1 className="text-gradient" style={{ fontSize: '2.8rem', lineHeight: 1.1, marginBottom: '1rem', marginTop: '0.5rem' }}>
          Akademik Formatınızı Tasarlayın
        </h1>
        <p className="copy admin-copy" style={{ color: 'var(--muted)', fontSize: '1.1rem', maxWidth: '800px' }}>
          Resmi bir şablonu baz alabilir veya 11 adımlık detaylı ayar sihirbazı ile tez biçiminizi sıfırdan milimetrik hassasiyetle yapılandırabilirsiniz. Sihirbaz sonunda oluşturduğunuz konfigürasyon "Kişisel Şablonlarım" arasına kaydedilir.
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <Link href="/templates/workspace" className="btn-secondary" style={{ padding: '0.8rem 1.6rem', textDecoration: 'none' }}>
            Workspace
          </Link>
          <Link href="/templates/me" className="btn-secondary" style={{ padding: '0.8rem 1.6rem', textDecoration: 'none' }}>
            Kişisel Şablonlarım
          </Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Adım İlerlemesi</span>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <strong style={{ fontSize: '1.8rem' }}>{currentStepIndex + 1} <span style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>/ {steps.length}</span></strong>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, background: 'var(--accent)', height: '100%', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </div>
          </div>
        </article>
        
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Ağ Durumu</span>
          <strong style={{ display: 'block', marginTop: '1rem', fontSize: '1.15rem', color: status.includes('🚨') ? '#ef4444' : status.includes('🎉') ? '#10b981' : 'inherit' }}>
            {status}
          </strong>
        </article>
        
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Referans Şablon</span>
          <strong style={{ display: 'block', marginTop: '1rem', fontSize: '1.15rem' }}>
            {selectedBaseTemplate?.name ?? 'Sıfırdan Özel Tasarım'}
          </strong>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', alignItems: 'start' }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '100px' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '1.2rem' }}>Geliştirici Token (Geçici)</h3>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <input
                type="password"
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.5)', color: 'var(--text)', outline: 'none' }}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="JWT access token"
              />
            </label>
            <button type="button" className="btn-secondary" style={{ width: '100%', padding: '0.7rem' }} onClick={() => void loadTemplates()}>
              Dev: Şablonları Getir
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Şablon Ayarları</h3>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Şablon Adı *</span>
              <input 
                style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.5)', outline: 'none' }}
                value={draft.name} onChange={(event) => updateTopLevel('name', event.target.value)} 
                placeholder="Örn: ITU Tez Ozel"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Açıklama</span>
              <textarea
                rows={2}
                style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.5)', resize: 'vertical', outline: 'none' }}
                value={draft.description}
                onChange={(event) => updateTopLevel('description', event.target.value)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Enstitü Filtresi</span>
              <select 
                style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', outline: 'none' }}
                value={workTypeFilter} onChange={(event) => setWorkTypeFilter(event.target.value)}
              >
                <option value="">Tümü</option>
                {workTypeSettings.map((setting) => (
                  <option key={setting.id} value={setting.slug}>{setting.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Baz Biçim (Klonla)</span>
              <select
                style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', outline: 'none' }}
                value={draft.baseTemplateId ?? ''}
                onChange={(event) => applyBaseTemplate(event.target.value)}
              >
                <option value="">(Sıfırdan Başla - Boş Form)</option>
                {officialTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
          </div>
          
          <div className="glass-panel" style={{ padding: '1rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {steps.map((step, index) => (
              <button
                key={step}
                type="button"
                style={{
                  textAlign: 'left',
                  padding: '0.9rem 1.2rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: index === currentStepIndex ? 'var(--accent)' : 'transparent',
                  color: index === currentStepIndex ? '#fff' : 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: index === currentStepIndex ? 600 : 500,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: index === currentStepIndex ? 'translateX(4px)' : 'none',
                }}
                onClick={() => setCurrentStepIndex(index)}
              >
                {index + 1}. {sectionLabels[step]}
              </button>
            ))}
          </div>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, marginBottom: '0.6rem', color: 'var(--muted)' }}>Şablon Form Alanı</p>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>{sectionLabels[currentStep]}</h2>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCurrentStepIndex((current) => Math.max(0, current - 1))}
                  disabled={currentStepIndex === 0}
                  style={{ opacity: currentStepIndex === 0 ? 0.5 : 1 }}
                >
                  <span style={{ marginRight: '0.4rem' }}>←</span> Geri
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setCurrentStepIndex((current) => Math.min(steps.length - 1, current + 1))}
                  disabled={currentStepIndex === steps.length - 1}
                  style={{ width: 'auto', opacity: currentStepIndex === steps.length - 1 ? 0.5 : 1 }}
                >
                  İleri <span style={{ marginLeft: '0.4rem' }}>→</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              {sectionFieldMap[currentStep].map((field) => {
                const value = draft.templateParameters[currentStep][field.key];

                if (field.type === 'checkbox') {
                  return (
                    <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.2rem 1.5rem', background: 'rgba(255,255,255,0.4)', border: '1px solid var(--border)', borderRadius: '16px', gridColumn: '1 / -1', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <input
                        type="checkbox"
                        style={{ width: '22px', height: '22px', accentColor: 'var(--accent)' }}
                        checked={Boolean(value)}
                        onChange={(event) => updateSectionField(currentStep, field.key, event.target.checked)}
                      />
                      <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{field.label}</span>
                    </label>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 600 }}>{field.label}</span>
                      <textarea
                        rows={4}
                        style={{ padding: '1.2rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.6)', color: 'var(--text)', resize: 'vertical', outline: 'none', transition: 'border-color 0.2s' }}
                        value={typeof value === 'string' ? value : ''}
                        placeholder={field.placeholder}
                        onChange={(event) => updateSectionField(currentStep, field.key, event.target.value)}
                      />
                    </label>
                  );
                }

                return (
                  <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 600 }}>{field.label}</span>
                    <input
                      type={field.type}
                      style={{ padding: '1.2rem 1.2rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.6)', color: 'var(--text)', outline: 'none', transition: 'border-color 0.2s' }}
                      value={
                        field.type === 'number'
                          ? Number(typeof value === 'number' ? value : 0)
                          : typeof value === 'string'
                            ? value
                            : ''
                      }
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        updateSectionField(
                          currentStep,
                          field.key,
                          field.type === 'number' ? Number(event.target.value) : event.target.value,
                        )
                      }
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px' }}>
            <h3 style={{ margin: '0 0 2rem 0', fontSize: '1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Canlı Parametre Önizlemesi</span>
              <button className="btn-primary" type="button" onClick={() => void saveTemplate()} style={{ padding: '0.8rem 2rem', fontSize: '1rem', width: 'auto' }}>
                Kişisel Şablonu Kaydet
              </button>
            </h3>
            <pre style={{ 
              background: '#0f172a', 
              color: '#34d399', 
              padding: '2rem', 
              borderRadius: '20px', 
              overflowX: 'auto',
              fontFamily: '"Fira Code", monospace',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)'
            }}>
{JSON.stringify(draft.templateParameters[currentStep], null, 2)}
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}
