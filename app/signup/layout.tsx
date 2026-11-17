import type { Metadata } from 'next';

// Page details for search engines and the browser tab
export const metadata: Metadata = {
  title: 'Create a free account',
  description:
    'Create a free OrbinexaCSV account and get AI titles, keywords and upload-ready CSV files for Adobe Stock, Shutterstock and Freepik.',
  alternates: { canonical: '/signup' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
