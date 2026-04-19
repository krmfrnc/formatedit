import { BookOpen, AlertCircle, CheckCircle } from 'lucide-react';
import type { ParsedDocumentBlock, CitationInfo } from '@formatedit/shared';
import { useMemo } from 'react';

interface CitationManagerProps {
  blocks: ParsedDocumentBlock[];
}

export function CitationManager({ blocks }: CitationManagerProps) {
  const citations = useMemo(() => {
    const list: Array<{ blockId: string; citation: CitationInfo }> = [];
    blocks.forEach((b) => {
      if (b.hasCitation && b.citations && b.citations.length > 0) {
        b.citations.forEach((c) => {
          list.push({ blockId: b.id ?? Math.random().toString(), citation: c });
        });
      }
    });
    return list;
  }, [blocks]);

  if (citations.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', textAlign: 'center' }}>
        <BookOpen size={32} color="var(--muted)" style={{ opacity: 0.5 }} />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Kaynakça Zekası Aktif</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
          Belgenizde henüz metin içi atıf tespit edilmedi. APA veya IEEE formatında atıfları otomatik algılarız.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem' }}>
        <BookOpen size={20} color="var(--accent)" />
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Otomatik Atıflar</h3>
        <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}>
          {citations.length} Bulundu
        </span>
      </div>
      
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
        Cümle içindeki atıflar referans formatiniza göre kontrol edilmektedir.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '400px', overflowY: 'auto' }}>
        {citations.map(({ blockId, citation }, idx) => (
          <li key={`${blockId}-${idx}`} style={{ padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
            {citation.style === 'unknown' ? (
               <AlertCircle size={16} color="#f59e0b" style={{ marginTop: '3px', flexShrink: 0 }} />
            ) : (
               <CheckCircle size={16} color="#10b981" style={{ marginTop: '3px', flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.3 }}>
                {citation.raw}
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Stil: <strong>{citation.style.toUpperCase()}</strong>
                </span>
                {citation.authors && citation.authors.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {citation.authors[0]} {citation.year ? `(${citation.year})` : ''}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
