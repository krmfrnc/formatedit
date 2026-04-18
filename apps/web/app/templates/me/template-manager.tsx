'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { TemplateParameterSet, UserTemplateRecord } from '@formatedit/shared';
import {
  emptyTemplateParameters,
  sectionFieldMap,
  sectionLabels,
  type TemplateSectionKey,
} from '../template-form-config';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface UserTemplateDraft {
  id: string | null;
  name: string;
  description: string;
  templateParameters: TemplateParameterSet;
}

const emptyDraft: UserTemplateDraft = {
  id: null,
  name: '',
  description: '',
  templateParameters: emptyTemplateParameters,
};

function toDraft(template: UserTemplateRecord): UserTemplateDraft {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    templateParameters: template.templateParameters,
  };
}

export function TemplateManager() {
  const [token, setToken] = useState('');
  const [templates, setTemplates] = useState<UserTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserTemplateDraft>(emptyDraft);
  const [activeSection, setActiveSection] = useState<TemplateSectionKey>('pageLayout');
  const [status, setStatus] = useState('Hazir');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  async function loadTemplates() {
    setStatus('Kisisel sablonlar yukleniyor⏳');
    try {
      const response = await fetch(`${apiUrl}/templates/me/custom`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        setStatus('🚨 Kisisel sablonlar alinamadi');
        return;
      }

      const body = (await response.json()) as UserTemplateRecord[];
      setTemplates(body);
      if (body[0]) {
        setSelectedTemplateId(body[0].id);
        setDraft(toDraft(body[0]));
      }
      setStatus(`✅ ${body.length} kisisel sablon yuklendi`);
    } catch {
      setStatus('🚨 API baglantisi kurulamadi');
    }
  }

  function selectTemplate(templateId: string) {
    const template = templates.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }

    setSelectedTemplateId(template.id);
    setDraft(toDraft(template));
    setStatus(`✨ Secili sablon: ${template.name}`);
  }

  function updateTopLevel(key: 'name' | 'description', value: string) {
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
    if (!draft.id) {
      setStatus('🚨 Duzenlemek icin once bir sablon secin');
      return;
    }

    setStatus('Kisisel sablon guncelleniyor⏳');
    try {
      const response = await fetch(`${apiUrl}/templates/me/custom/${draft.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description.trim() || undefined,
          templateParameters: draft.templateParameters,
        }),
      });

      if (!response.ok) {
        setStatus('🚨 Sablon guncellenemedi');
        return;
      }

      const body = (await response.json()) as UserTemplateRecord;
      setTemplates((current) => current.map((entry) => (entry.id === body.id ? body : entry)));
      setDraft(toDraft(body));
      setStatus(`🎉 Guncellendi: ${body.name}`);
    } catch {
      setStatus('🚨 Baglanti hatasi');
    }
  }

  async function archiveTemplate() {
    if (!draft.id) {
      setStatus('🚨 Arsivlemek icin once secim yapin');
      return;
    }

    setStatus('Sablon arsivleniyor⏳');
    try {
      const response = await fetch(`${apiUrl}/templates/me/custom/${draft.id}`, {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setStatus('🚨 Sablon arsivlenemedi');
        return;
      }

      const remaining = templates.filter((entry) => entry.id !== draft.id);
      setTemplates(remaining);
      setSelectedTemplateId(remaining[0]?.id ?? null);
      setDraft(remaining[0] ? toDraft(remaining[0]) : emptyDraft);
      setStatus('🗑️ Sablon arsive tasindi');
    } catch {
      setStatus('🚨 Arsivleme sirasinda hata');
    }
  }

  return (
    <>
      <section className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px', marginBottom: '2rem' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600 }}>My Templates</p>
        <h1 className="text-gradient" style={{ fontSize: '2.8rem', lineHeight: 1.1, marginBottom: '1rem', marginTop: '0.5rem' }}>
          Kişisel Şablonlarını Yönet
        </h1>
        <p className="copy admin-copy" style={{ color: 'var(--muted)', fontSize: '1.1rem', maxWidth: '800px' }}>
          Sihirbaz (Wizard) ile oluşturduğun kalıpları burada detaylıca düzenleyebilir, özel ayarlamalarını yapabilir ve kullanmadığın formları arşive taşıyabilirsin.
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <Link href="/templates/workspace" className="btn-secondary" style={{ padding: '0.8rem 1.6rem', textDecoration: 'none' }}>
            Workspace
          </Link>
          <Link href="/templates/wizard" className="btn-primary" style={{ padding: '0.8rem 1.6rem', textDecoration: 'none' }}>
            Yeni Şablon Yarat
          </Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Kayıtlı Portföy</span>
          <strong style={{ display: 'block', marginTop: '1rem', fontSize: '1.8rem' }}>
            {templates.length} <span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 400 }}>kalıp</span>
          </strong>
        </article>
        
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Aktif Düzenleme</span>
          <strong style={{ display: 'block', marginTop: '1rem', fontSize: '1.2rem' }}>
            {selectedTemplate?.name ?? 'Kalıp Seçilmedi'}
          </strong>
        </article>

        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', borderLeft: status.includes('🚨') ? '4px solid #ef4444' : '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em' }}>İşlem Durumu</span>
          <strong style={{ display: 'block', marginTop: '1rem', fontSize: '1.1rem', color: status.includes('🚨') ? '#ef4444' : status.includes('🎉') ? '#10b981' : 'var(--text)' }}>
            {status}
          </strong>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', alignItems: 'start' }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '100px' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '1.2rem' }}>Güvenlik Token'i</h3>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <input
                type="password"
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', outline: 'none' }}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="JWT access token"
              />
            </label>
            <button type="button" className="btn-secondary" style={{ width: '100%', padding: '0.7rem' }} onClick={() => void loadTemplates()}>
              Bulut'tan Eşitle
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '500px', overflowY: 'auto' }}>
            {templates.length === 0 ? (
              <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>Henüz şablon eklemediniz.</p>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  style={{
                    textAlign: 'left',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: template.id === selectedTemplateId ? '1px solid var(--accent)' : '1px solid transparent',
                    background: template.id === selectedTemplateId ? 'rgba(217,119,6,0.1)' : 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}
                  onClick={() => selectTemplate(template.id)}
                >
                  <strong style={{ fontSize: '0.95rem' }}>{template.name}</strong>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: template.isPromoted ? '#10b98122' : 'rgba(255,255,255,0.1)', color: template.isPromoted ? '#10b981' : 'var(--muted)', borderRadius: '4px', width: 'fit-content' }}>
                    {template.isPromoted ? '⭐ Promoted' : '🔧 Custom'}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {selectedTemplateId ? (
            <>
              <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Revize Şablon Adı</span>
                  <input 
                    style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', outline: 'none' }}
                    value={draft.name} onChange={(event) => updateTopLevel('name', event.target.value)} 
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Yeni Açıklama</span>
                  <textarea
                    rows={2}
                    style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', resize: 'vertical', outline: 'none' }}
                    value={draft.description}
                    onChange={(event) => updateTopLevel('description', event.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
                {(Object.keys(sectionLabels) as TemplateSectionKey[]).map((sectionKey) => (
                  <button
                    key={sectionKey}
                    type="button"
                    style={{
                      padding: '0.8rem 1.2rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: activeSection === sectionKey ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                      color: activeSection === sectionKey ? '#fff' : 'var(--text)',
                      fontWeight: activeSection === sectionKey ? 600 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => setActiveSection(sectionKey)}
                  >
                    {sectionLabels[sectionKey]}
                  </button>
                ))}
              </div>

              <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px' }}>
                <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <p className="eyebrow" style={{ margin: 0, marginBottom: '0.2rem' }}>Aktif Kesit Düzenleyici</p>
                  <h2 style={{ margin: 0, fontSize: '1.6rem' }}>{sectionLabels[activeSection]}</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                  {sectionFieldMap[activeSection].map((field) => {
                    const value = draft.templateParameters[activeSection][field.key];

                    if (field.type === 'checkbox') {
                      return (
                        <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '16px', gridColumn: '1 / -1', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }}
                            checked={Boolean(value)}
                            onChange={(event) => updateSectionField(activeSection, field.key, event.target.checked)}
                          />
                          <span style={{ fontWeight: 500 }}>{field.label}</span>
                        </label>
                      );
                    }

                    if (field.type === 'textarea') {
                      return (
                        <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>{field.label}</span>
                          <textarea
                            rows={4}
                            style={{ padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', outline: 'none' }}
                            value={typeof value === 'string' ? value : ''}
                            placeholder={field.placeholder}
                            onChange={(event) => updateSectionField(activeSection, field.key, event.target.value)}
                          />
                        </label>
                      );
                    }

                    return (
                      <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>{field.label}</span>
                        <input
                          type={field.type}
                          style={{ padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', outline: 'none' }}
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
                              activeSection,
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

              <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Canlı Raw JSON</span>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn-secondary" style={{ padding: '0.6rem 1.2rem', color: '#ef4444', borderColor: '#ef444433' }} type="button" onClick={() => void archiveTemplate()} disabled={!draft.id}>
                      Yokedici Arşivle
                    </button>
                    <button className="btn-primary" style={{ padding: '0.6rem 1.5rem' }} type="button" onClick={() => void saveTemplate()} disabled={!draft.id}>
                      Tüm Değişiklikleri Kaydet
                    </button>
                  </div>
                </h3>
                <pre style={{ background: '#0f172a', color: '#10b981', padding: '1.5rem', borderRadius: '16px', overflowX: 'auto', fontSize: '0.9rem', fontFamily: '"Fira Code", monospace' }}>
{JSON.stringify(draft.templateParameters[activeSection], null, 2)}
                </pre>
              </div>
            </>
          ) : (
             <div className="glass-panel" style={{ display: 'grid', placeItems: 'center', height: '400px', borderRadius: '24px', color: 'var(--muted)' }}>
               <div style={{ textAlign: 'center' }}>
                 <p style={{ fontSize: '3rem', margin: 0, marginBottom: '1rem' }}>🔖</p>
                 <p>Düzenlemek İçin Soldan Bir Şablon Seçin.</p>
               </div>
             </div>
          )}
        </section>
      </section>
    </>
  );
}
