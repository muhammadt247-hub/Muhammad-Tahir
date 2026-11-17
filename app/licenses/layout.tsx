import type { Metadata } from 'next';

// Page details for search engines and the browser tab
export const metadata: Metadata = {
  title: 'Open-source licenses',
  description: 'Open-source software used by OrbinexaCSV and its licenses.',
  alternates: { canonical: '/licenses' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
