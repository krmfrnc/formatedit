import Link from 'next/link';
import { getLegalDocument, getLegalFallback } from '../_lib/legal-documents';
import type { LegalDocumentSlug } from '../_lib/legal-documents';

interface LegalPageProps {
  slug: LegalDocumentSlug;
  eyebrow: string;
}

export async function LegalPage({ slug, eyebrow }: LegalPageProps) {
  const document = await getLegalDocument(slug);
  const fallback = getLegalFallback(slug);

  return (
    <main className="shell">
      <article className="hero legal-page">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{document?.title ?? fallback.title}</h1>
        <p className="copy">{fallback.summary}</p>

        <div className="legal-page__meta">
          <span>Durum: {document ? 'Yayinda' : 'Taslak bekleniyor'}</span>
          <span>Locale: {document?.locale ?? 'tr'}</span>
          {document ? <span>Versiyon: v{document.version}</span> : null}
        </div>

        <section className="legal-page__body">
          {document ? (
            document.content.split(/\n{2,}/).map((paragraph, index) => (
              <p key={`${slug}-${index}`}>{paragraph}</p>
            ))
          ) : (
            <div role="alert">
              Bu metnin yayindaki surumu henuz bulunamadi. Admin panelinden belge yayina
              alindiginda bu sayfa otomatik guncellenir.
            </div>
          )}
        </section>

        <div className="panel-actions legal-page__actions">
          <Link href="/">Ana sayfaya don</Link>
          <Link href="/cookies">Cerez politikasi</Link>
          <Link href="/privacy">Gizlilik politikasi</Link>
        </div>
      </article>
    </main>
  );
}
