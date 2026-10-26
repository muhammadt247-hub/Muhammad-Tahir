import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
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

export const metadata: Metadata = {
  title: SITE_CONFIG.PAGE_TITLE,
  description: SITE_CONFIG.PAGE_DESCRIPTION,
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
    <html lang="en" suppressHydrationWarning className={poppins.variable}>
      <body className="antialiased font-sans text-foreground bg-background" suppressHydrationWarning>
        <CasualProtection />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          storageKey="theme"
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
