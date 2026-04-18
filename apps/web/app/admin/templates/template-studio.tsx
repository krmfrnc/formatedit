'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import type {
  TemplateExportBundle,
  TemplateImportResult,
  TemplateParameterSet,
  TemplateRecord,
  TemplateStats,
  UserTemplateRecord,
  WorkTypeSettingRecord,
} from '@formatedit/shared';
import {
  emptyTemplateParameters,
  sectionFieldMap,
  sectionLabels,
  type SectionField,
  type TemplateSectionKey,
} from '../../templates/template-form-config';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface TemplateDraft {
  slug: string;
  name: string;
  description: string;
  category: string;
  workType: string;
  isActive: boolean;
  templateParameters: TemplateParameterSet;
}


const emptyDraft: TemplateDraft = {
  slug: '',
  name: '',
  description: '',
  category: 'University',
  workType: 'thesis',
  isActive: true,
  templateParameters: emptyTemplateParameters,
};

function toDraft(template: TemplateRecord): TemplateDraft {
  return {
    slug: template.slug,
    name: template.name,
    description: template.description ?? '',
    category: template.category,
    workType: template.workType,
    isActive: template.isActive,
    templateParameters: template.templateParameters,
  };
}

function toPayload(draft: TemplateDraft) {
  return {
    ...draft,
    description: draft.description.trim() || undefined,
  };
}

export function TemplateStudio() {
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [token, setToken] = useState('');
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserTemplateRecord[]>([]);
  const [workTypeSettings, setWorkTypeSettings] = useState<WorkTypeSettingRecord[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedUserTemplateId, setSelectedUserTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [status, setStatus] = useState('Hazir');
  const [activeSection, setActiveSection] = useState<TemplateSectionKey>('pageLayout');
  const [importPayload, setImportPayload] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [promoteDraft, setPromoteDraft] = useState({
    slug: '',
    category: 'University',
    workType: 'thesis',
    name: '',
    description: '',
  });
  const [workTypeDraft, setWorkTypeDraft] = useState({
    id: null as string | null,
    slug: '',
    label: '',
    isActive: true,
    requiredFixedPages: 'abstract',
    optionalFixedPages: 'acknowledgements, cv',
  });

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const selectedUserTemplate = useMemo(
    () => userTemplates.find((template) => template.id === selectedUserTemplateId) ?? null,
    [selectedUserTemplateId, userTemplates],
  );

  async function loadTemplates() {
    setStatus('Sablonlar yukleniyor');
    try {
      const [templatesResponse, statsResponse, exportResponse, workTypesResponse] = await Promise.all([
        fetch(`${apiUrl}/admin/templates`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/admin/templates/stats`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/admin/templates/export`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/admin/template-work-types`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
      ]);

      if (!templatesResponse.ok || !statsResponse.ok || !exportResponse.ok || !workTypesResponse.ok) {
        setStatus('Admin template listesi alinamadi');
        return;
      }

      const templatesBody = (await templatesResponse.json()) as TemplateRecord[];
      const statsBody = (await statsResponse.json()) as TemplateStats;
      const exportBody = (await exportResponse.json()) as TemplateExportBundle;
      const workTypesBody = (await workTypesResponse.json()) as WorkTypeSettingRecord[];

      setTemplates(templatesBody);
      setStats(statsBody);
      setUserTemplates(exportBody.userTemplates);
      setWorkTypeSettings(workTypesBody);
      if (templatesBody[0] && !selectedTemplateId) {
        setSelectedTemplateId(templatesBody[0].id);
        setDraft(toDraft(templatesBody[0]));
      }
      if (exportBody.userTemplates[0] && !selectedUserTemplateId) {
        const firstUserTemplate = exportBody.userTemplates[0];
        setSelectedUserTemplateId(firstUserTemplate.id);
        setPromoteDraft({
          slug: `${firstUserTemplate.name.toLowerCase().replace(/\s+/g, '-')}-official`,
          category: 'University',
          workType: 'thesis',
          name: firstUserTemplate.name,
          description: firstUserTemplate.description ?? '',
        });
      }
      setStatus(`${templatesBody.length} resmi sablon, ${exportBody.userTemplates.length} kullanici sablonu yuklendi`);
    } catch {
      setStatus('Template API baglantisi kurulamadi');
    }
  }

  function selectTemplate(templateId: string | null) {
    if (!templateId) {
      setSelectedTemplateId(null);
      setDraft(emptyDraft);
      setStatus('Yeni sablon moduna gecildi');
      return;
    }

    const template = templates.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }

    setSelectedTemplateId(template.id);
    setDraft(toDraft(template));
    setStatus(`Secili sablon: ${template.name}`);
  }

  function updateTopLevel<K extends keyof Omit<TemplateDraft, 'templateParameters'>>(key: K, value: TemplateDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateSectionField(section: TemplateSectionKey, field: SectionField, rawValue: string | boolean) {
    setDraft((current) => ({
      ...current,
      templateParameters: {
        ...current.templateParameters,
        [section]: {
          ...current.templateParameters[section],
          [field.key]:
            field.type === 'number'
              ? Number(rawValue)
              : field.type === 'checkbox'
                ? Boolean(rawValue)
                : rawValue,
        },
      },
    }));
  }

  async function saveTemplate() {
    setStatus(selectedTemplateId ? 'Sablon guncelleniyor' : 'Sablon olusturuluyor');
    try {
      const response = await fetch(
        selectedTemplateId ? `${apiUrl}/admin/templates/${selectedTemplateId}` : `${apiUrl}/admin/templates`,
        {
          method: selectedTemplateId ? 'PATCH' : 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(toPayload(draft)),
        },
      );

      if (!response.ok) {
        setStatus('Sablon kaydi basarisiz');
        return;
      }

      const body = (await response.json()) as TemplateRecord;
      setTemplates((current) => {
        const others = current.filter((entry) => entry.id !== body.id);
        return [body, ...others];
      });
      setSelectedTemplateId(body.id);
      setDraft(toDraft(body));
      setStatus(`Sablon kaydedildi: ${body.name}`);
    } catch {
      setStatus('Sablon kaydi sirasinda baglanti hatasi');
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) {
      return;
    }

    setStatus('Sablon siliniyor');
    try {
      const response = await fetch(`${apiUrl}/admin/templates/${selectedTemplateId}`, {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setStatus('Sablon silinemedi');
        return;
      }

      setTemplates((current) => current.filter((entry) => entry.id !== selectedTemplateId));
      setSelectedTemplateId(null);
      setDraft(emptyDraft);
      setStatus('Sablon silindi');
    } catch {
      setStatus('Silme sirasinda baglanti hatasi');
    }
  }

  function selectWorkTypeSetting(settingId: string) {
    const setting = workTypeSettings.find((entry) => entry.id === settingId);
    if (!setting) {
      return;
    }

    setWorkTypeDraft({
      id: setting.id,
      slug: setting.slug,
      label: setting.label,
      isActive: setting.isActive,
      requiredFixedPages: setting.requiredFixedPages.join(', '),
      optionalFixedPages: setting.optionalFixedPages.join(', '),
    });
    setStatus(`Secili work type: ${setting.label}`);
  }

  function resetWorkTypeDraft() {
    setWorkTypeDraft({
      id: null,
      slug: '',
      label: '',
      isActive: true,
      requiredFixedPages: 'abstract',
      optionalFixedPages: 'acknowledgements, cv',
    });
  }

  function splitCommaList(value: string) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  async function saveWorkTypeSetting() {
    setStatus(workTypeDraft.id ? 'Work type guncelleniyor' : 'Work type olusturuluyor');
    try {
      const response = await fetch(
        workTypeDraft.id
          ? `${apiUrl}/admin/template-work-types/${workTypeDraft.id}`
          : `${apiUrl}/admin/template-work-types`,
        {
          method: workTypeDraft.id ? 'PATCH' : 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            slug: workTypeDraft.slug,
            label: workTypeDraft.label,
            isActive: workTypeDraft.isActive,
            requiredFixedPages: splitCommaList(workTypeDraft.requiredFixedPages),
            optionalFixedPages: splitCommaList(workTypeDraft.optionalFixedPages),
          }),
        },
      );

      if (!response.ok) {
        setStatus('Work type kaydi basarisiz');
        return;
      }

      const body = (await response.json()) as WorkTypeSettingRecord;
      setWorkTypeSettings((current) => [body, ...current.filter((entry) => entry.id !== body.id)]);
      selectWorkTypeSetting(body.id);
      setStatus(`Work type kaydedildi: ${body.label}`);
    } catch {
      setStatus('Work type kaydi sirasinda baglanti hatasi');
    }
  }

  async function deleteWorkTypeSetting() {
    if (!workTypeDraft.id) {
      return;
    }

    setStatus('Work type siliniyor');
    try {
      const response = await fetch(`${apiUrl}/admin/template-work-types/${workTypeDraft.id}`, {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setStatus('Work type silinemedi');
        return;
      }

      setWorkTypeSettings((current) => current.filter((entry) => entry.id !== workTypeDraft.id));
      resetWorkTypeDraft();
      setStatus('Work type silindi');
    } catch {
      setStatus('Work type silme sirasinda baglanti hatasi');
    }
  }

  function selectUserTemplate(userTemplateId: string) {
    const template = userTemplates.find((entry) => entry.id === userTemplateId);
    if (!template) {
      return;
    }

    setSelectedUserTemplateId(template.id);
    setPromoteDraft({
      slug: `${template.name.toLowerCase().replace(/\s+/g, '-')}-official`,
      category: 'University',
      workType: 'thesis',
      name: template.name,
      description: template.description ?? '',
    });
    setStatus(`Secili kullanici sablonu: ${template.name}`);
  }

  async function promoteUserTemplate() {
    if (!selectedUserTemplateId) {
      setStatus('Promote icin once bir kullanici sablonu secin');
      return;
    }

    setStatus('Kullanici sablonu resmi sablona tasiniyor');
    try {
      const response = await fetch(`${apiUrl}/admin/templates/promote/${selectedUserTemplateId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(promoteDraft),
      });

      if (!response.ok) {
        setStatus('Promote islemi basarisiz');
        return;
      }

      const body = (await response.json()) as TemplateRecord;
      setTemplates((current) => [body, ...current.filter((entry) => entry.id !== body.id)]);
      setUserTemplates((current) =>
        current.map((entry) =>
          entry.id === selectedUserTemplateId ? { ...entry, isPromoted: true } : entry,
        ),
      );
      setSelectedTemplateId(body.id);
      setDraft(toDraft(body));
      setStatus(`Resmi sablona tasindi: ${body.name}`);
      await loadTemplates();
    } catch {
      setStatus('Promote sirasinda baglanti hatasi');
    }
  }

  async function exportTemplates() {
    setStatus('Template export hazirlaniyor');
    try {
      const response = await fetch(`${apiUrl}/admin/templates/export`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        setStatus('Export alinamadi');
        return;
      }

      const body = (await response.json()) as TemplateExportBundle;
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `templates-export-${new Date().toISOString()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('Template export indirildi');
    } catch {
      setStatus('Export sirasinda baglanti hatasi');
    }
  }

  async function importTemplates() {
    setStatus('Template import baslatiliyor');
    try {
      const parsed = JSON.parse(importPayload) as Partial<TemplateExportBundle> & {
        officialTemplates?: TemplateRecord[];
      };

      if (!parsed.officialTemplates?.length) {
        setStatus('Import icin officialTemplates dizisi gerekli');
        return;
      }

      const response = await fetch(`${apiUrl}/admin/templates/import`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          overwriteExisting,
          officialTemplates: parsed.officialTemplates.map((template) => ({
            slug: template.slug,
            name: template.name,
            description: template.description ?? undefined,
            category: template.category,
            workType: template.workType,
            isActive: template.isActive,
            templateParameters: template.templateParameters,
          })),
        }),
      });

      if (!response.ok) {
        setStatus('Template import basarisiz');
        return;
      }

      const body = (await response.json()) as TemplateImportResult;
      setStatus(
        `Import tamamlandi: ${body.createdCount} olustu, ${body.updatedCount} guncellendi, ${body.skippedCount} atlandi`,
      );
      await loadTemplates();
    } catch {
      setStatus('Import JSON okunamadi veya baglanti kurulamadi');
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const fileContents = await file.text();
      setImportPayload(fileContents);
      setStatus(`Import dosyasi hazir: ${file.name}`);
    } catch {
      setStatus('Import dosyasi okunamadi');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <main className="admin-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', minHeight: '100vh', background: 'var(--admin-bg)' }}>
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>Template Studio</p>
          <h1 className="text-gradient" style={{ fontSize: '3.2rem', marginTop: '0.5rem', marginBottom: '1rem', lineHeight: 1.1 }}>
            Şablon Yönetim Merkezi
          </h1>
          <p className="copy admin-copy" style={{ color: 'var(--muted)', fontSize: '1.15rem', maxWidth: '700px' }}>
            Resmi şablonları listeleyin, detaylı parametre sekmelerinde düzenlemeler yapın, yeni kalıpları import edin veya kullanıcıların draftlarını kalıcı topluluk şablonlarına dönüştürün.
          </p>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Resmi Şablon</span>
          <strong style={{ display: 'block', fontSize: '2rem', marginTop: '0.5rem', color: 'var(--text)' }}>{templates.length}</strong>
        </article>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Aktif Şablon</span>
          <strong style={{ display: 'block', fontSize: '2rem', marginTop: '0.5rem', color: '#10b981' }}>{templates.filter((t) => t.isActive).length}</strong>
        </article>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Seçili Ver.</span>
          <strong style={{ display: 'block', fontSize: '1.5rem', marginTop: '0.8rem', color: 'var(--accent)' }}>{selectedTemplate?.version ?? 'Yeni'}</strong>
        </article>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>C. Template</span>
          <strong style={{ display: 'block', fontSize: '2rem', marginTop: '0.5rem', color: 'var(--text)' }}>{stats?.userTemplateCount ?? userTemplates.length}</strong>
        </article>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Promoted</span>
          <strong style={{ display: 'block', fontSize: '2rem', marginTop: '0.5rem', color: '#8b5cf6' }}>{stats?.promotedUserTemplateCount ?? userTemplates.filter((t) => t.isPromoted).length}</strong>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: '2rem', alignItems: 'start' }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '100px' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '1rem', color: 'var(--muted)' }}>Erişim Yönetimi</h3>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <input
                type="password"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin API Token"
              />
            </label>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button className="btn-primary" type="button" onClick={() => void loadTemplates()}>Verileri Eşitle</button>
              <button className="btn-secondary" type="button" onClick={() => void exportTemplates()}>JSON İndir</button>
              <button className="btn-secondary" type="button" onClick={() => selectTemplate(null)}>+ Yeni Sıfır Şablon</button>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: status.includes('hata') ? '#ef4444' : 'var(--accent)', fontWeight: 600 }}>{status}</p>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                style={{
                  textAlign: 'left', padding: '1rem', borderRadius: '12px',
                  border: template.id === selectedTemplateId ? '1px solid var(--accent)' : '1px solid transparent',
                  background: template.id === selectedTemplateId ? 'rgba(217,119,6,0.1)' : 'transparent',
                  color: 'var(--text)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '0.3rem'
                }}
                onClick={() => selectTemplate(template.id)}
              >
                <strong style={{ fontSize: '0.9rem' }}>{template.name}</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{template.category} · {template.workType}</span>
              </button>
            ))}
          </div>
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* TEMPLATE META */}
          <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px' }}>
             <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: 'var(--text)' }}>Temel Meta Verileri</h3>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
               <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Slug ID</span>
                 <input style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)' }} value={draft.slug} onChange={(e) => updateTopLevel('slug', e.target.value)} />
               </label>
               <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Sunum İsmi</span>
                 <input style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)' }} value={draft.name} onChange={(e) => updateTopLevel('name', e.target.value)} />
               </label>
               <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Kategori</span>
                 <input style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)' }} value={draft.category} onChange={(e) => updateTopLevel('category', e.target.value)} />
               </label>
               <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Çalışma Platform Tipi</span>
                 <select style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)' }} value={draft.workType} onChange={(e) => updateTopLevel('workType', e.target.value)}>
                   {workTypeSettings.map((s) => <option key={s.id} value={s.slug}>{s.label}</option>)}
                   {!workTypeSettings.some((s) => s.slug === draft.workType) && <option value={draft.workType}>{draft.workType}</option>}
                 </select>
               </label>
               <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: '1 / -1' }}>
                 <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Şablon Açıklaması</span>
                 <textarea style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)' }} value={draft.description} onChange={(e) => updateTopLevel('description', e.target.value)} rows={3} />
               </label>
               <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', gridColumn: '1 / -1', cursor: 'pointer' }}>
                 <input type="checkbox" style={{ accentColor: 'var(--accent)', width: '18px', height: '18px' }} checked={draft.isActive} onChange={(e) => updateTopLevel('isActive', e.target.checked)} />
                 <span style={{ fontWeight: 600 }}>Uygulama İçinde Aktif Yayında</span>
               </label>
             </div>
          </div>

          {/* PARAMETERS SECTION B*/}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
            {(Object.keys(sectionLabels) as TemplateSectionKey[]).map((sectionKey) => (
              <button
                key={sectionKey} type="button"
                style={{
                  padding: '0.8rem 1.2rem', borderRadius: '12px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  background: activeSection === sectionKey ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                  color: activeSection === sectionKey ? '#fff' : 'var(--text)',
                  fontWeight: activeSection === sectionKey ? 600 : 500, transition: 'all 0.2s'
                }}
                onClick={() => setActiveSection(sectionKey)}
              >
                {sectionLabels[sectionKey]}
              </button>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>{sectionLabels[activeSection]} Ayarları</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {sectionFieldMap[activeSection].map((field) => {
                const value = draft.templateParameters[activeSection][field.key];
                if (field.type === 'checkbox') {
                  return (
                    <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', gridColumn: '1 / -1', cursor: 'pointer' }}>
                      <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} checked={Boolean(value)} onChange={(e) => updateSectionField(activeSection, field, e.target.checked)} />
                      <span style={{ fontWeight: 500 }}>{field.label}</span>
                    </label>
                  );
                }
                if (field.type === 'textarea') {
                  return (
                    <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>{field.label}</span>
                      <textarea rows={4} style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)' }} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={(e) => updateSectionField(activeSection, field, e.target.value)} />
                    </label>
                  );
                }
                return (
                  <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>{field.label}</span>
                    <input type={field.type} style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)' }} value={field.type === 'number' ? Number(typeof value === 'number' ? value : 0) : typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={(e) => updateSectionField(activeSection, field, e.target.value)} />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
             <h3 style={{ margin: '0 0 1rem 0' }}>Anlık JSON Durumu</h3>
             <pre style={{ background: '#0f172a', color: '#34d399', padding: '1.5rem', borderRadius: '16px', overflowX: 'auto', fontSize: '0.85rem' }}>
                {JSON.stringify(draft.templateParameters[activeSection], null, 2)}
             </pre>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn-secondary" type="button" onClick={() => void deleteTemplate()} disabled={!selectedTemplateId} style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>Secili Şablonu Yok Et</button>
            <button className="btn-primary" type="button" onClick={() => void saveTemplate()}>{selectedTemplateId ? 'Değişiklikleri Veritabanına Yaz' : 'Yeni Şablon Olarak Sentezle'}</button>
          </div>

          <hr style={{ borderColor: 'var(--border)', margin: '2rem 0' }} />

          {/* IMPORT/EXPORT & COMMUNITY SECTION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text)' }}>JSON Bundle İçeri Aktar</h3>
              <input ref={importFileInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => void handleImportFileChange(e)} />
              <textarea rows={8} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)', marginBottom: '1rem' }} value={importPayload} placeholder='{"officialTemplates":[...]}' onChange={(e) => setImportPayload(e.target.value)} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', marginBottom: '1rem' }}>
                <input type="checkbox" style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }} checked={overwriteExisting} onChange={(e) => setOverwriteExisting(e.target.checked)} />
                <span>Mevcut Sablon Sluglarini Ezen Guncelleme (Overwrite)</span>
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-secondary" type="button" onClick={() => importFileInputRef.current?.click()} style={{ flex: 1 }}>Dosya Seç</button>
                <button className="btn-primary" type="button" onClick={() => void importTemplates()} style={{ flex: 1 }}>Sisteme İşle</button>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
               <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text)' }}>Community Intake / Promote</h3>
               <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                 {selectedUserTemplate ? `Hedef kaynak: ${selectedUserTemplate.name}` : 'Aşağıdaki listeden hedef kullanıcı draftı belirleyin.'}
               </p>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.5rem' }}>
                 {userTemplates.map((t) => (
                    <button key={t.id} type="button" onClick={() => selectUserTemplate(t.id)} style={{ textAlign: 'left', padding: '0.8rem', borderRadius: '8px', border: 'none', background: t.id === selectedUserTemplateId ? 'rgba(217, 119, 6, 0.1)' : 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                       <strong>{t.name}</strong> <span style={{ fontSize: '0.75rem', float: 'right', color: t.isPromoted ? '#10b981' : 'var(--muted)' }}>{t.isPromoted ? 'Promoted' : 'Bekliyor'}</span>
                    </button>
                 ))}
               </div>
               
               {selectedUserTemplateId && (
                 <div style={{ display: 'grid', gap: '0.8rem', marginBottom: '1.5rem' }}>
                    <input style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }} placeholder="Resmi Slug" value={promoteDraft.slug} onChange={(e) => setPromoteDraft(c => ({...c, slug: e.target.value}))} />
                    <input style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }} placeholder="Resmi İsim" value={promoteDraft.name} onChange={(e) => setPromoteDraft(c => ({...c, name: e.target.value}))} />
                 </div>
               )}
               <button className="btn-primary" style={{ width: '100%', background: '#8b5cf6', borderColor: '#8b5cf6' }} type="button" onClick={() => void promoteUserTemplate()} disabled={!selectedUserTemplateId}>Resmi Şablon Olarak İlan Et</button>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px', marginTop: '1rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
               <span>Çalışma Tipleri (Work Types)</span>
               <button className="btn-secondary" style={{ fontSize: '0.8rem' }} type="button" onClick={() => resetWorkTypeDraft()}>+ Yeni Tip</button>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                 {workTypeSettings.map((setting) => (
                    <button key={setting.id} type="button" onClick={() => selectWorkTypeSetting(setting.id)} style={{ textAlign: 'left', padding: '1rem', borderRadius: '12px', border: setting.id === workTypeDraft.id ? '1px solid var(--accent)' : '1px solid transparent', background: setting.id === workTypeDraft.id ? 'rgba(217, 119, 6, 0.1)' : 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                       <strong>{setting.label}</strong> <br/><span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{setting.slug}</span>
                    </button>
                 ))}
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignContent: 'start' }}>
                 <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                   <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Slug</span>
                   <input style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent' }} value={workTypeDraft.slug} onChange={(e) => setWorkTypeDraft(c => ({ ...c, slug: e.target.value }))} />
                 </label>
                 <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                   <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Etiket İsim</span>
                   <input style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent' }} value={workTypeDraft.label} onChange={(e) => setWorkTypeDraft(c => ({ ...c, label: e.target.value }))} />
                 </label>
                 <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: '1 / -1' }}>
                   <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Zorunlu Sayfalar (virgülle ayır)</span>
                   <input style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent' }} value={workTypeDraft.requiredFixedPages} onChange={(e) => setWorkTypeDraft(c => ({ ...c, requiredFixedPages: e.target.value }))} />
                 </label>
                 <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: '1 / -1' }}>
                   <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Opsiyonel Sayfalar (virgülle ayır)</span>
                   <input style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent' }} value={workTypeDraft.optionalFixedPages} onChange={(e) => setWorkTypeDraft(c => ({ ...c, optionalFixedPages: e.target.value }))} />
                 </label>
                 
                 <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                   <button className="btn-secondary" style={{ color: '#ef4444', borderColor: '#ef444455' }} type="button" onClick={() => void deleteWorkTypeSetting()} disabled={!workTypeDraft.id}>Tipi Sil</button>
                   <button className="btn-primary" type="button" onClick={() => void saveWorkTypeSetting()}>{workTypeDraft.id ? 'Güncelle' : 'Yarat'}</button>
                 </div>
               </div>
            </div>
          </div>

        </section>
      </section>
    </main>
  );
}
