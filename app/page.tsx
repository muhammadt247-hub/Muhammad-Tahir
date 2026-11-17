import type { Metadata } from 'next';
import Landing from '@/components/landing/Landing';
import { SITE_CONFIG } from '@/config/site';

// Public home page. Logged-in users are sent to /generator by the middleware before this renders.
export const metadata: Metadata = {
  title: { absolute: 'OrbinexaCSV | AI metadata, CSV export and image tools for stock contributors' },
  description:
    'Titles, keywords and upload-ready CSV files for Adobe Stock, Shutterstock and Freepik, plus a background remover, SVG vectorizer and more.',
  alternates: { canonical: '/' },
};

// Facts about the site for search engines (no ratings, prices or claims that are not on the page)
const base = SITE_CONFIG.SITE_URL.replace(/\/+$/, '');
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': base + '/#organization',
      name: SITE_CONFIG.BRAND_NAME,
      url: base + '/',
      logo: base + '/icon.svg',
      email: SITE_CONFIG.SUPPORT_EMAIL,
    },
    {
      '@type': 'WebSite',
      '@id': base + '/#website',
      name: SITE_CONFIG.BRAND_NAME,
      url: base + '/',
      publisher: { '@id': base + '/#organization' },
      inLanguage: 'en',
    },
    {
      '@type': 'WebApplication',
      name: SITE_CONFIG.BRAND_NAME,
      url: base + '/',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any (web browser)',
      description:
        'AI titles, descriptions and keywords with upload-ready CSV files for Adobe Stock, Shutterstock and Freepik contributors, plus image tools.',
      publisher: { '@id': base + '/#organization' },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // fixed text written above (no user input), with "<" escaped so it can never close the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <Landing />
    </>
  );
}
