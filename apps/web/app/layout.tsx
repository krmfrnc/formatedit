import type { Metadata } from 'next';
import './globals.css';
import { CookieConsentBanner } from './_components/cookie-consent-banner';
import { LanguageProvider } from './_lib/i18n/LanguageContext';

export const metadata: Metadata = {
  title: 'FormatEdit',
  description: 'Akademik formatlama ve analiz platformu',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = window.localStorage.getItem('formatedit-theme-preference');
                  var theme = stored === 'light' || stored === 'dark' || stored === 'system'
                    ? stored
                    : 'system';
                  document.documentElement.dataset.theme = theme;
                } catch (error) {
                  document.documentElement.dataset.theme = 'system';
                }
              })();
            `,
          }}
        />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif" }}>
        <LanguageProvider>
          {children}
          <CookieConsentBanner />
        </LanguageProvider>
      </body>
    </html>
  );
}
