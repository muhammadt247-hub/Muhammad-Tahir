import type { Metadata } from 'next';

// Page details for search engines and the browser tab
export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to OrbinexaCSV to generate titles, keywords and CSV files for your stock photos, videos and vectors.',
  alternates: { canonical: '/login' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
