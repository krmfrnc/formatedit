import {
  AcademicTitle,
  CitationStyleFamily,
  LegalDocumentSlug,
  PrismaClient,
  ThemePreference,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('supersecret', 12);

  const citationStyles = [
    {
      slug: 'apa-7',
      name: 'APA 7',
      family: CitationStyleFamily.AUTHOR_DATE,
      description: 'American Psychological Association 7th edition',
    },
    {
      slug: 'apa-6',
      name: 'APA 6',
      family: CitationStyleFamily.AUTHOR_DATE,
      description: 'American Psychological Association 6th edition',
    },
    {
      slug: 'vancouver',
      name: 'Vancouver',
      family: CitationStyleFamily.NUMERIC,
      description: 'Numeric medical and scientific referencing style',
    },
    {
      slug: 'ieee',
      name: 'IEEE',
      family: CitationStyleFamily.NUMERIC,
      description: 'Institute of Electrical and Electronics Engineers style',
    },
    {
      slug: 'mdpi',
      name: 'MDPI',
      family: CitationStyleFamily.NUMERIC,
      description: 'MDPI/Nutrients journal reference style',
    },
    {
      slug: 'chicago-author-date',
      name: 'Chicago Author-Date',
      family: CitationStyleFamily.AUTHOR_DATE,
      description: 'Chicago author-date format',
    },
    {
      slug: 'chicago-notes-bibliography',
      name: 'Chicago Notes-Bibliography',
      family: CitationStyleFamily.NOTES_BIBLIOGRAPHY,
      description: 'Chicago notes and bibliography format',
    },
    {
      slug: 'harvard',
      name: 'Harvard',
      family: CitationStyleFamily.AUTHOR_DATE,
      description: 'Harvard author-date format',
    },
    {
      slug: 'mla',
      name: 'MLA',
      family: CitationStyleFamily.AUTHOR_DATE,
      description: 'Modern Language Association format',
    },
  ];

  const legalDocuments = [
    {
      slug: LegalDocumentSlug.TERMS,
      locale: 'tr',
      title: 'Kullanim Sozlesmesi',
      content:
        'FormatEdit hizmetlerini kullanarak platform kurallarini, odeme kosullarini ve belge isleme akislarini kabul etmis olursunuz. Hizmet kapsamindaki teslimatlar ilgili siparis kaydina gore saglanir.',
    },
    {
      slug: LegalDocumentSlug.PRIVACY,
      locale: 'tr',
      title: 'Gizlilik Politikasi',
      content:
        'FormatEdit hesap, belge ve odeme verilerini hizmeti sunmak, guvenligi saglamak ve yasal yukumlulukleri yerine getirmek icin isler. Kisisel veriler yalnizca yetkili ekipler ve onayli saglayicilar tarafindan erisilir.',
    },
    {
      slug: LegalDocumentSlug.KVKK,
      locale: 'tr',
      title: 'KVKK Aydinlatma Metni',
      content:
        '6698 sayili KVKK kapsaminda veri sorumlusu olarak; kimlik, iletisim, odeme ve belge icerigi verilerini siparis yonetimi, destek surecleri ve yasal yukumlulukler amaciyla isleriz. Taleplerinizi destek kanallari uzerinden iletebilirsiniz.',
    },
    {
      slug: LegalDocumentSlug.GDPR,
      locale: 'tr',
      title: 'GDPR Bilgilendirmesi',
      content:
        'AB Genel Veri Koruma Tuzuğu kapsaminda; veri minimu, amacla sinirlilik ve veri tasinabilirligi ilkelerine uygun hareket ederiz. GDPR talepleri icin kimlik dogrulamasindan sonra veri erisim, duzeltme veya silme islemleri baslatilir.',
    },
    {
      slug: LegalDocumentSlug.COOKIES,
      locale: 'tr',
      title: 'Cerez Politikasi',
      content:
        'FormatEdit; oturum, guvenlik ve tercihleri korumak icin zorunlu cerezler kullanir. Analitik veya pazarlama amacli cerezler acik riza olmadan aktif edilmez ve tercihlerinizi banner uzerinden yonetebilirsiniz.',
    },
  ];

  for (const citationStyle of citationStyles) {
    await prisma.citationStyle.upsert({
      where: { slug: citationStyle.slug },
      update: {
        name: citationStyle.name,
        family: citationStyle.family,
        description: citationStyle.description,
        isActive: true,
      },
      create: citationStyle,
    });
  }

  for (const document of legalDocuments) {
    await prisma.legalDocument.upsert({
      where: {
        slug_locale_version: {
          slug: document.slug,
          locale: document.locale,
          version: 1,
        },
      },
      update: {
        title: document.title,
        content: document.content,
        isActive: true,
        publishedAt: new Date(),
      },
      create: {
        ...document,
        version: 1,
        isActive: true,
        publishedAt: new Date(),
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {
      passwordHash,
      fullName: 'Test User',
      academicTitle: AcademicTitle.MASTERS_STUDENT,
      preferredLanguage: 'tr',
      themePreference: ThemePreference.SYSTEM,
    },
    create: {
      email: 'user@example.com',
      passwordHash,
      fullName: 'Test User',
      role: UserRole.USER,
      academicTitle: AcademicTitle.MASTERS_STUDENT,
      preferredLanguage: 'tr',
      themePreference: ThemePreference.SYSTEM,
      notificationPreference: {
        create: {
          emailEnabled: true,
          inAppEnabled: true,
          whatsappEnabled: false,
          telegramEnabled: false,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash,
      fullName: 'Platform Admin',
      academicTitle: AcademicTitle.PROFESSOR,
      preferredLanguage: 'en',
      themePreference: ThemePreference.DARK,
      role: UserRole.ADMIN,
    },
    create: {
      email: 'admin@example.com',
      passwordHash,
      fullName: 'Platform Admin',
      role: UserRole.ADMIN,
      academicTitle: AcademicTitle.PROFESSOR,
      preferredLanguage: 'en',
      themePreference: ThemePreference.DARK,
      notificationPreference: {
        create: {
          emailEnabled: true,
          inAppEnabled: true,
          whatsappEnabled: true,
          telegramEnabled: true,
        },
      },
    },
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
