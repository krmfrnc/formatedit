import type { LegalDocumentPageRecord } from '@formatedit/shared';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type LegalDocumentSlug = 'TERMS' | 'PRIVACY' | 'KVKK' | 'GDPR' | 'COOKIES';

const legalFallbacks: Record<LegalDocumentSlug, { title: string; summary: string }> = {
  TERMS: {
    title: 'Kullanim Sozlesmesi',
    summary:
      'Platformu kullanirken hizmet kapsamimizi, odeme akisini ve teslim sorumluluklarini belirleyen ana metin.',
  },
  PRIVACY: {
    title: 'Gizlilik Politikasi',
    summary:
      'Kisisel verilerin hangi amaclarla toplandigini, nasil saklandigini ve kimlerle paylasildigini aciklar.',
  },
  KVKK: {
    title: 'KVKK Aydinlatma Metni',
    summary:
      '6698 sayili Kanun kapsaminda veri sorumlusu olarak yerine getirdigimiz aydinlatma ve basvuru surecini ozetler.',
  },
  GDPR: {
    title: 'GDPR Bilgilendirmesi',
    summary:
      'AB veri koruma ilkeleri, veri sahibinin haklari ve sinir otesi veri isleme esaslarini aciklar.',
  },
  COOKIES: {
    title: 'Cerez Politikasi',
    summary:
      'Zorunlu ve tercihe bagli cerezleri, bunlarin amaclarini ve tercih yonetimini aciklar.',
  },
};

export async function getLegalDocument(
  slug: LegalDocumentSlug,
  locale = 'tr',
): Promise<LegalDocumentPageRecord | null> {
  try {
    const response = await fetch(`${apiUrl}/legal/${slug}?locale=${locale}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LegalDocumentPageRecord | null;
  } catch {
    return null;
  }
}

export function getLegalFallback(slug: LegalDocumentSlug) {
  return legalFallbacks[slug];
}
