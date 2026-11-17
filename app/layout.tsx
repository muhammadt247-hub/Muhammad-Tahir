import type { Metadata } from 'next';
import { Playfair_Display, Poppins } from 'next/font/google';
import './globals.css';
import './hover-pop.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AppShell } from '@/components/layout/AppShell';
import { CasualProtection } from '@/components/security/CasualProtection';
import { SITE_CONFIG } from '@/config/site';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

// Elegant serif for headings (h1, h2 and the font-serif class)
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  // full addresses for canonical links and share images
  metadataBase: new URL(SITE_CONFIG.SITE_URL),
  // pages set a short title ("Log in"); the brand is added after it: "Log in | OrbinexaCSV"
  title: { default: SITE_CONFIG.PAGE_TITLE, template: '%s | ' + SITE_CONFIG.BRAND_NAME },
  description: SITE_CONFIG.PAGE_DESCRIPTION,
  applicationName: SITE_CONFIG.BRAND_NAME,
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: SITE_CONFIG.PAGE_TITLE,
    description: SITE_CONFIG.PAGE_DESCRIPTION,
    url: SITE_CONFIG.SITE_URL,
    siteName: SITE_CONFIG.BRAND_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_CONFIG.PAGE_TITLE,
    description: SITE_CONFIG.PAGE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${playfair.variable}`}>
      <body className="antialiased font-sans text-foreground bg-background" suppressHydrationWarning>
        <CasualProtection />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          // new key (was "theme"): old saved light/dark choices are ignored, so everyone starts in the new Ember theme
          storageKey="orbinexa-theme"
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
