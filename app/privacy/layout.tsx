import type { Metadata } from 'next';

// Page details for search engines and the browser tab
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How OrbinexaCSV collects, uses and protects your data.',
  alternates: { canonical: '/privacy' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
